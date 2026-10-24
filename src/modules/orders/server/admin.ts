import 'server-only';
import { chunk, fetchAll } from '@/lib/supabase/paginate';
import type { StaffContext } from '@/modules/auth/server';
import type { ReservationState } from '../domain/labels';
import { incidentOpen } from '../domain/labels';
import type { FulfillmentType, OrderStatus } from '../domain/status';

/*
 * Lecturas de los pedidos web con la sesión de quien mira: la RLS exige
 * orders.view y, para el contacto, también customers.view. Sin ese permiso ni
 * siquiera se pide el contacto (withCustomer). Nada de costes ni proveedores.
 */

type Supabase = StaffContext['supabase'];

export type WebOrderRow = {
  id: string;
  number: number;
  status: OrderStatus;
  reservation: ReservationState;
  fulfillment: FulfillmentType;
  totalCents: number;
  createdAt: string;
  units: number;
  hasIncident: boolean;
  /** null sin customers.view. */
  customerName: string | null;
};

export async function listWebOrders(
  supabase: Supabase,
  filter: { fulfillment?: FulfillmentType; from?: string; to?: string },
  options: { withCustomer: boolean },
): Promise<WebOrderRow[]> {
  const rows = await fetchAll((from, to) => {
    let query = supabase
      .from('orders')
      .select(
        'id, number, status, reservation, fulfillment, total_cents, created_at, order_lines(quantity), order_events(from_status, to_status)',
      )
      .eq('order_events.kind', 'payment_review');
    if (filter.fulfillment) query = query.eq('fulfillment', filter.fulfillment);
    if (filter.from) query = query.gte('created_at', filter.from);
    if (filter.to) query = query.lt('created_at', filter.to);
    return query
      .order('created_at', { ascending: false })
      .order('id')
      .range(from, to);
  });
  const names = new Map<string, string>();
  if (options.withCustomer && rows.length > 0) {
    // `.in()` viaja en la URL: tramos de 100 ids (unos 4 KB) para no pasar
    // del límite de longitud de la petición.
    for (const ids of chunk(
      rows.map((row) => row.id),
      100,
    )) {
      const { data, error } = await supabase
        .from('order_contacts')
        .select('order_id, full_name')
        .in('order_id', ids);
      if (error) throw new Error(error.message);
      for (const contact of data ?? []) {
        names.set(contact.order_id, contact.full_name);
      }
    }
  }
  return rows.map((row) => ({
    id: row.id,
    number: row.number,
    status: row.status as OrderStatus,
    reservation: row.reservation as ReservationState,
    fulfillment: row.fulfillment as FulfillmentType,
    totalCents: row.total_cents,
    createdAt: row.created_at,
    units: row.order_lines.reduce((sum, line) => sum + line.quantity, 0),
    // Incidencias que no cambiaron el estado: siguen abiertas (incidentOpen).
    hasIncident: row.order_events.some((e) => e.from_status === e.to_status),
    customerName: names.get(row.id) ?? null,
  }));
}

/** Pedidos que piden trabajo, para el inicio del panel. */
export async function countOpenWebOrders(
  supabase: Supabase,
): Promise<{ toPrepare: number; attention: number; pickup: number }> {
  const count = async (statuses: OrderStatus[]) => {
    const { count: total, error } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .in('status', statuses);
    if (error) throw new Error(error.message);
    return total ?? 0;
  };
  const [toPrepare, attention, pickup] = await Promise.all([
    count(['paid', 'processing']),
    count(['needs_attention']),
    count(['ready_for_pickup']),
  ]);
  return { toPrepare, attention, pickup };
}

export type WebOrderDetail = {
  order: {
    id: string;
    number: number;
    status: OrderStatus;
    reservation: ReservationState;
    reservedUntil: string;
    fulfillment: FulfillmentType;
    locale: string;
    locationName: string | null;
    itemsCents: number;
    /** Código de descuento aplicado (§149); 0 y null sin código. */
    discountCents: number;
    discountCode: string | null;
    shippingCents: number;
    totalCents: number;
    currency: string;
    paidAt: string | null;
    trackingReference: string | null;
    /** Transacción del cobro del pedido (también si fue incidencia). */
    receivedTransactionId: string | null;
    revision: number;
    createdAt: string;
  };
  lines: {
    variantId: string;
    sku: string | null;
    brandName: string;
    productName: string;
    sizeMl: number | null;
    variantLabel: string | null;
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
  }[];
  /** null sin customers.view. */
  contact: {
    fullName: string;
    email: string;
    phone: string | null;
    address: string[];
  } | null;
  attempts: {
    provider: string;
    reference: string;
    amountCents: number;
    createdAt: string;
  }[];
  payments: {
    /** En revisión: abierta o ya resuelta (incidentOpen); null si no lo está. */
    incidentOpen: boolean | null;
    /** Devuelto de este cobro con respuesta del banco. */
    refundedCents: number;
    id: number;
    provider: string;
    transactionId: string;
    outcome: string;
    amountCents: number;
    currency: string;
    decision: string;
    reason: string | null;
    receivedAt: string;
  }[];
  /** Devoluciones pedidas al banco (P06) y lo que respondió. */
  refunds: {
    id: string;
    paymentId: number;
    toStatus: OrderStatus | null;
    amountCents: number;
    status: 'requested' | 'succeeded' | 'failed' | 'unknown';
    responseCode: string | null;
    error: string | null;
    actorName: string | null;
    createdAt: string;
    /** Última vez que se mandó al banco (al pedirla o al reenviarla). */
    sentAt: string;
    resolvedAt: string | null;
  }[];
  /** Correos al cliente (P06): qué salió y qué espera, sin su contenido. */
  emails: {
    kind: string;
    status: string;
    attempts: number;
    lastError: string | null;
    sentAt: string | null;
    createdAt: string;
  }[];
  events: {
    id: number;
    kind: string;
    fromStatus: OrderStatus | null;
    toStatus: OrderStatus | null;
    detail: Record<string, unknown> | null;
    /** null: el sistema (banco, caducidad). */
    actorName: string | null;
    byStaff: boolean;
    at: string;
  }[];
};

function must<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export async function getWebOrder(
  supabase: Supabase,
  id: string,
  options: { withCustomer: boolean },
): Promise<WebOrderDetail | null> {
  const order = must(
    await supabase
      .from('orders')
      .select('*, stock_locations(name)')
      .eq('id', id)
      .maybeSingle(),
  );
  if (!order) return null;
  const [
    linesResult,
    contactResult,
    attemptsResult,
    paymentsResult,
    eventsResult,
    emailsResult,
    refundsResult,
  ] = await Promise.all([
    supabase
      .from('order_lines')
      .select('*')
      .eq('order_id', id)
      .order('brand_name')
      .order('product_name')
      .order('variant_id'),
    options.withCustomer
      ? supabase
          .from('order_contacts')
          .select('*')
          .eq('order_id', id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from('order_payment_attempts')
      .select('provider, reference, amount_cents, created_at')
      .eq('order_id', id)
      .order('created_at'),
    supabase
      .from('order_payments')
      .select('*')
      .eq('order_id', id)
      .order('received_at')
      .order('id'),
    supabase
      .from('order_events')
      .select('*')
      .eq('order_id', id)
      .order('at')
      .order('id'),
    supabase
      .from('order_emails')
      .select('kind, status, attempts, last_error, sent_at, created_at')
      .eq('order_id', id)
      .order('id'),
    supabase
      .from('order_refunds')
      .select('*')
      .eq('order_id', id)
      .order('created_at'),
  ]);
  const lines = must(linesResult) ?? [];
  const contact = must(contactResult);
  const attempts = must(attemptsResult) ?? [];
  const payments = must(paymentsResult) ?? [];
  const events = must(eventsResult) ?? [];
  const emails = must(emailsResult) ?? [];
  const refunds = must(refundsResult) ?? [];
  // Lo ya devuelto de cada cobro: un cobro de más devuelto entero cierra su
  // incidencia.
  const refunded = new Map<number, number>();
  for (const refund of refunds)
    if (refund.status === 'succeeded')
      refunded.set(
        refund.payment_id,
        (refunded.get(refund.payment_id) ?? 0) + refund.amount_cents,
      );

  // Cada incidencia por su transacción: ¿cambió el estado del pedido?
  const keptStatus = new Map<string, boolean>();
  for (const event of events) {
    const tx = (event.detail as { transaction_id?: unknown } | null)
      ?.transaction_id;
    if (event.kind === 'payment_review' && typeof tx === 'string') {
      keptStatus.set(tx, event.from_status === event.to_status);
    }
  }

  // Nombres del personal: la RLS solo deja ver la propia ficha salvo con
  // staff.manage; si no se ve, la cronología dice «Personal».
  const actorIds = [
    ...new Set(events.flatMap((e) => (e.actor_id ? [e.actor_id] : []))),
  ];
  const names = new Map<string, string>();
  if (actorIds.length > 0) {
    const staff = must(
      await supabase
        .from('staff_members')
        .select('user_id, display_name')
        .in('user_id', actorIds),
    );
    for (const member of staff ?? []) {
      if (member.display_name) names.set(member.user_id, member.display_name);
    }
  }

  return {
    order: {
      id: order.id,
      number: order.number,
      status: order.status as OrderStatus,
      reservation: order.reservation as ReservationState,
      reservedUntil: order.reserved_until,
      fulfillment: order.fulfillment as FulfillmentType,
      locale: order.locale,
      locationName: order.stock_locations?.name ?? null,
      itemsCents: order.items_cents,
      discountCents: order.discount_cents,
      discountCode: order.discount_code,
      shippingCents: order.shipping_cents,
      totalCents: order.total_cents,
      currency: order.currency,
      paidAt: order.paid_at,
      trackingReference: order.tracking_reference,
      receivedTransactionId: order.received_transaction_id,
      revision: order.revision,
      createdAt: order.created_at,
    },
    lines: lines.map((line) => ({
      variantId: line.variant_id,
      sku: line.sku,
      brandName: line.brand_name,
      productName: line.product_name,
      sizeMl: line.size_ml,
      variantLabel: line.variant_label,
      quantity: line.quantity,
      unitPriceCents: line.unit_price_cents,
      lineTotalCents: line.line_total_cents,
    })),
    contact: contact
      ? {
          fullName: contact.full_name,
          email: contact.email,
          phone: contact.phone,
          address: [
            contact.address_line1,
            contact.address_line2,
            [contact.postal_code, contact.city].filter(Boolean).join(' '),
            [contact.province, contact.country].filter(Boolean).join(', '),
          ].filter((part): part is string => Boolean(part)),
        }
      : null,
    attempts: attempts.map((a) => ({
      provider: a.provider,
      reference: a.reference,
      amountCents: a.amount_cents,
      createdAt: a.created_at,
    })),
    payments: payments.map((p) => ({
      incidentOpen:
        p.decision === 'review'
          ? incidentOpen(order.status as OrderStatus, {
              keptStatus: keptStatus.get(p.transaction_id) ?? true,
            }) && (refunded.get(p.id) ?? 0) < p.amount_cents
          : null,
      refundedCents: refunded.get(p.id) ?? 0,
      id: p.id,
      provider: p.provider,
      transactionId: p.transaction_id,
      outcome: p.outcome,
      amountCents: p.amount_cents,
      currency: p.currency,
      decision: p.decision,
      reason: p.reason,
      receivedAt: p.received_at,
    })),
    refunds: refunds.map((r) => ({
      id: r.id,
      paymentId: r.payment_id,
      toStatus: r.to_status as OrderStatus | null,
      amountCents: r.amount_cents,
      status: r.status as 'requested' | 'succeeded' | 'failed' | 'unknown',
      responseCode: r.response_code,
      error: r.error,
      actorName: r.requested_by
        ? (names.get(r.requested_by) ?? 'Personal')
        : null,
      createdAt: r.created_at,
      // Sin la migración 20261024120000 no hay sent_at: vale la de creación.
      sentAt: r.sent_at ?? r.created_at,
      resolvedAt: r.resolved_at,
    })),
    emails: emails.map((e) => ({
      kind: e.kind,
      status: e.status,
      attempts: e.attempts,
      lastError: e.last_error,
      sentAt: e.sent_at,
      createdAt: e.created_at,
    })),
    events: events.map((e) => ({
      id: e.id,
      kind: e.kind,
      fromStatus: e.from_status as OrderStatus | null,
      toStatus: e.to_status as OrderStatus | null,
      detail:
        e.detail && typeof e.detail === 'object' && !Array.isArray(e.detail)
          ? (e.detail as Record<string, unknown>)
          : null,
      actorName: e.actor_id ? (names.get(e.actor_id) ?? 'Personal') : null,
      byStaff: e.actor_id !== null,
      at: e.at,
    })),
  };
}
