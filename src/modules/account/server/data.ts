import 'server-only';
import type { AccountOrder, AccountOrderSummary } from '../domain/status';
import { customerOrderStatus } from '../domain/status';
import type { CustomerSession } from './session';
import { accountsEnabled, getCustomerSession } from './session';

/** Ficha de la cuenta: lo guardado en customer_accounts y lo que sabe Auth. */
export type AccountProfile = {
  email: string;
  emailVerified: boolean;
  /** Formas de entrar de la cuenta: email (contraseña) y google. */
  providers: string[];
  fullName: string;
  phone: string;
  locale: 'es' | 'ca' | 'en' | null;
  address: {
    addressLine1: string;
    addressLine2: string;
    postalCode: string;
    city: string;
    province: string;
  } | null;
};

function metadataName(session: CustomerSession): string {
  const meta = session.user.user_metadata as Record<string, unknown>;
  const name = meta.full_name ?? meta.name;
  return typeof name === 'string' ? name.trim().slice(0, 120) : '';
}

export async function getAccountProfile(
  session: CustomerSession,
): Promise<AccountProfile> {
  const { data, error } = await session.supabase
    .from('customer_accounts')
    .select('*')
    .eq('user_id', session.user.id)
    .maybeSingle();
  if (error)
    console.error('[cuenta] ficha del cliente', error.code, error.message);
  const providers = session.user.app_metadata.providers;
  return {
    email: session.user.email ?? '',
    emailVerified: Boolean(session.user.email_confirmed_at),
    providers: Array.isArray(providers)
      ? providers.filter((p): p is string => typeof p === 'string')
      : [],
    // Sin ficha guardada, el nombre que dio al registrarse o el de Google.
    fullName: data?.full_name ?? metadataName(session),
    phone: data?.phone ?? '',
    locale:
      data?.locale === 'es' || data?.locale === 'ca' || data?.locale === 'en'
        ? data.locale
        : null,
    address: data?.address_line1
      ? {
          addressLine1: data.address_line1,
          addressLine2: data.address_line2 ?? '',
          postalCode: data.postal_code ?? '',
          city: data.city ?? '',
          province: data.province ?? '',
        }
      : null,
  };
}

export async function listAccountOrders(
  session: CustomerSession,
): Promise<AccountOrderSummary[] | null> {
  const { data, error } = await session.supabase.rpc('customer_orders');
  if (error) {
    console.error('[cuenta] pedidos', error.code, error.message);
    return null;
  }
  return data.map((row) => ({
    number: row.number,
    status: customerOrderStatus(row.status),
    fulfillment: row.fulfillment === 'shipping' ? 'shipping' : 'click_collect',
    totalCents: row.total_cents,
    units: row.units,
    createdAt: row.created_at,
  }));
}

type OrderRow = {
  number: number;
  status: string;
  fulfillment: string;
  items_cents: number;
  discount_cents: number;
  discount_code: string | null;
  shipping_cents: number;
  total_cents: number;
  refunded_cents: number;
  created_at: string;
  paid_at: string | null;
  tracking_reference: string | null;
  contact: { full_name: string; email: string; phone: string | null };
  address: {
    address_line1: string | null;
    address_line2: string | null;
    postal_code: string | null;
    city: string | null;
    province: string | null;
  } | null;
  lines: {
    brand_name: string;
    product_name: string;
    variant_label: string | null;
    size_ml: number | null;
    quantity: number;
    unit_price_cents: number;
    line_total_cents: number;
  }[];
};

/** Un pedido de la cuenta, o null si no existe o no es suyo. */
export async function getAccountOrder(
  session: CustomerSession,
  number: number,
): Promise<AccountOrder | null> {
  const { data, error } = await session.supabase.rpc('customer_order', {
    p_number: number,
  });
  if (error) {
    console.error('[cuenta] pedido', error.code, error.message);
    return null;
  }
  if (!data) return null;
  const row = data as unknown as OrderRow;
  return {
    number: row.number,
    status: customerOrderStatus(row.status),
    fulfillment: row.fulfillment === 'shipping' ? 'shipping' : 'click_collect',
    itemsCents: row.items_cents,
    discountCents: row.discount_cents,
    discountCode: row.discount_code,
    shippingCents: row.shipping_cents,
    totalCents: row.total_cents,
    refundedCents: row.refunded_cents,
    createdAt: row.created_at,
    paidAt: row.paid_at,
    trackingReference: row.tracking_reference,
    contact: {
      fullName: row.contact.full_name,
      email: row.contact.email,
      phone: row.contact.phone,
    },
    address: row.address && {
      addressLine1: row.address.address_line1,
      addressLine2: row.address.address_line2,
      postalCode: row.address.postal_code,
      city: row.address.city,
      province: row.address.province,
    },
    lines: row.lines.map((line) => ({
      brandName: line.brand_name,
      productName: line.product_name,
      variantLabel: line.variant_label,
      sizeMl: line.size_ml,
      quantity: line.quantity,
      unitPriceCents: line.unit_price_cents,
      lineTotalCents: line.line_total_cents,
    })),
  };
}

/** Datos con los que el checkout rellena el formulario si hay sesión. */
export type CheckoutPrefill = {
  email: string;
  fullName: string;
  phone: string;
  address: AccountProfile['address'];
};

/**
 * Con la cuenta encendida y la sesión iniciada, sus datos para el checkout;
 * null si no (el checkout sigue como invitado).
 */
export async function getCheckoutPrefill(): Promise<CheckoutPrefill | null> {
  if (!accountsEnabled()) return null;
  const session = await getCustomerSession();
  if (!session) return null;
  const profile = await getAccountProfile(session);
  return {
    email: profile.email,
    fullName: profile.fullName,
    phone: profile.phone,
    address: profile.address,
  };
}

/**
 * Cuenta a la que se vincula un pedido: la de la sesión validada con Supabase
 * Auth, o null (invitado). La base vuelve a comprobar que existe.
 */
export async function orderCustomerId(): Promise<string | null> {
  if (!accountsEnabled()) return null;
  const session = await getCustomerSession();
  return session?.user.id ?? null;
}
