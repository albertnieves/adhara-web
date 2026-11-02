import { z } from 'zod';

/*
 * Ficha de cliente del panel (A7, DECISIONS §184). El cliente es su email en
 * minúsculas; el panel lo nombra por una clave opaca (sha256 del email) para
 * no poner el email en las URL. Lo calcula la base: aquí solo se valida lo que
 * devuelve y se ordena para enseñarlo.
 */

export const CUSTOMER_KEY = /^[0-9a-f]{64}$/;
export const CUSTOMERS_PAGE_SIZE = 50;

export function isCustomerKey(value: string): boolean {
  return CUSTOMER_KEY.test(value);
}

export type NewsletterState = 'subscribed' | 'unsubscribed';

export const NEWSLETTER_LABELS: Readonly<Record<NewsletterState, string>> = {
  subscribed: 'Suscrito',
  unsubscribed: 'Baja',
};

export type CustomerRow = {
  key: string;
  email: string;
  name: string | null;
  orders: number;
  paidOrders: number;
  /** Cobrado menos lo devuelto por el banco. */
  netCents: number;
  conversations: number;
  openConversations: number;
  newsletter: NewsletterState | null;
  hasAccount: boolean;
  firstSeenAt: string | null;
  lastActivityAt: string | null;
};

const timestamp = z.string().min(1);

const listRow = z.object({
  customer_key: z.string().regex(CUSTOMER_KEY),
  email: z.string(),
  full_name: z.string().nullable(),
  orders: z.number().int(),
  paid_orders: z.number().int(),
  paid_cents: z.number().int(),
  refunded_cents: z.number().int(),
  conversations: z.number().int(),
  open_conversations: z.number().int(),
  newsletter: z.enum(['subscribed', 'unsubscribed']).nullable(),
  has_account: z.boolean(),
  first_seen_at: timestamp.nullable(),
  last_activity_at: timestamp.nullable(),
  total_count: z.number().int(),
});

/** Lo que enseña la lista: la búsqueda, la página y sus clientes. */
export type CustomerSearchState = {
  search: string;
  page: number;
  customers: CustomerRow[];
  total: number;
};

/** Filas de `admin_customers` y el total de la búsqueda. */
export function parseCustomerList(rows: unknown): {
  customers: CustomerRow[];
  total: number;
} {
  const parsed = z.array(listRow).parse(rows ?? []);
  return {
    total: parsed[0]?.total_count ?? 0,
    customers: parsed.map((row) => ({
      key: row.customer_key,
      email: row.email,
      name: row.full_name,
      orders: row.orders,
      paidOrders: row.paid_orders,
      netCents: row.paid_cents - row.refunded_cents,
      conversations: row.conversations,
      openConversations: row.open_conversations,
      newsletter: row.newsletter,
      hasAccount: row.has_account,
      firstSeenAt: row.first_seen_at,
      lastActivityAt: row.last_activity_at,
    })),
  };
}

const address = {
  address_line1: z.string().nullable(),
  address_line2: z.string().nullable(),
  postal_code: z.string().nullable(),
  city: z.string().nullable(),
  province: z.string().nullable(),
};

const record = z.object({
  key: z.string().regex(CUSTOMER_KEY),
  email: z.string(),
  account: z
    .object({
      full_name: z.string().nullable(),
      phone: z.string().nullable(),
      locale: z.string(),
      created_at: timestamp,
      last_sign_in_at: timestamp.nullable(),
      ...address,
    })
    .nullable(),
  newsletter: z
    .object({
      locale: z.string(),
      source: z.string(),
      consent_version: z.string(),
      consented_at: timestamp,
      unsubscribed_at: timestamp.nullable(),
    })
    .nullable(),
  orders: z.array(
    z.object({
      id: z.string(),
      number: z.number().int(),
      status: z.enum([
        'pending_payment',
        'paid',
        'processing',
        'ready_for_pickup',
        'shipped',
        'completed',
        'cancelled',
        'refunded',
        'partially_refunded',
        'needs_attention',
      ]),
      reservation: z.enum(['active', 'committed', 'consumed', 'released']),
      fulfillment: z.enum(['shipping', 'click_collect']),
      total_cents: z.number().int(),
      refunded_cents: z.number().int(),
      created_at: timestamp,
      paid_at: timestamp.nullable(),
      with_account: z.boolean(),
      full_name: z.string(),
      phone: z.string().nullable(),
      country: z.string().nullable(),
      ...address,
    }),
  ),
  conversations: z.array(
    z.object({
      id: z.string(),
      number: z.number().int(),
      status: z.enum(['open', 'waiting_customer', 'resolved', 'spam']),
      channel: z.enum(['web_form', 'email', 'whatsapp']),
      subject: z.string(),
      created_at: timestamp,
      last_message_at: timestamp,
      full_name: z.string().nullable(),
      order_number: z.number().int().nullable(),
    }),
  ),
});

type RawRecord = z.infer<typeof record>;
export type CustomerRecord = RawRecord;
export type CustomerOrder = RawRecord['orders'][number];
export type CustomerConversation = RawRecord['conversations'][number];

/** La ficha de `admin_customer`; null si la clave no es de nadie. */
export function parseCustomerRecord(value: unknown): CustomerRecord | null {
  if (value === null || value === undefined) return null;
  return record.parse(value);
}

export type ContactLine = {
  label: string;
  value: string;
  /** De dónde sale: la cuenta, un pedido o una consulta. */
  source: string;
};

function addressText(entry: {
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  province: string | null;
}): string | null {
  if (!entry.address_line1) return null;
  const place = [entry.postal_code, entry.city].filter(Boolean).join(' ');
  return [entry.address_line1, entry.address_line2, place, entry.province]
    .filter(Boolean)
    .join(', ');
}

/**
 * Datos de contacto distintos, los más recientes primero: los de la cuenta y
 * luego los de cada pedido (que ya vienen del más reciente) y consulta. Un
 * mismo valor sale una vez, con su origen más reciente.
 */
export function contactLines(customer: CustomerRecord): ContactLine[] {
  const lines: ContactLine[] = [];
  const seen = new Set<string>();
  const add = (label: string, value: string | null, source: string) => {
    const text = value?.trim();
    if (!text) return;
    const id = `${label}:${text.toLowerCase()}`;
    if (seen.has(id)) return;
    seen.add(id);
    lines.push({ label, value: text, source });
  };
  if (customer.account) {
    add('Nombre', customer.account.full_name, 'Cuenta');
    add('Teléfono', customer.account.phone, 'Cuenta');
    add('Dirección', addressText(customer.account), 'Cuenta');
  }
  for (const order of customer.orders) {
    const source = `Pedido Nº ${order.number}`;
    add('Nombre', order.full_name, source);
    add('Teléfono', order.phone, source);
    add('Dirección', addressText(order), source);
  }
  for (const conversation of customer.conversations)
    add('Nombre', conversation.full_name, `Consulta Nº ${conversation.number}`);
  const order = ['Nombre', 'Teléfono', 'Dirección'];
  return lines.sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));
}

/** Nombre para el título: el de la cuenta, el del último pedido o consulta. */
export function displayName(customer: CustomerRecord): string | null {
  return (
    customer.account?.full_name ??
    customer.orders[0]?.full_name ??
    customer.conversations.find((c) => c.full_name)?.full_name ??
    null
  );
}

/** Nombre del archivo de la exportación, sin el email. */
export function exportFileName(key: string, now: Date): string {
  return `cliente-${key.slice(0, 12)}-${now.toISOString().slice(0, 10)}.json`;
}
