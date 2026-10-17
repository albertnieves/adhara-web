import 'server-only';
import { getTranslations } from 'next-intl/server';
import { cookies } from 'next/headers';
import { createOrdersClient } from '@/lib/supabase/privileged';
import { siteUrl } from '@/modules/i18n/seo';
import { redsysConfig } from '@/modules/payments/server/config';
import type { PaymentForm } from '@/modules/payments/server/redsys';
import { redsysPaymentForm } from '@/modules/payments/server/redsys';
import type { OrderStatusView } from '../domain/order';
import { ORDER_COOKIE, ORDER_MAX_AGE, isOrderId } from '../domain/order';

/** Solo en acciones del servidor: recuerda el pedido en este navegador. */
export async function rememberOrder(orderId: string) {
  (await cookies()).set(ORDER_COOKIE, orderId, {
    path: '/',
    maxAge: ORDER_MAX_AGE,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
  });
}

export async function rememberedOrderId(): Promise<string | null> {
  const value = (await cookies()).get(ORDER_COOKIE)?.value;
  return isOrderId(value) ? value : null;
}

/** Estado del pedido sin datos personales (web_order_status). */
export async function getOrderStatus(
  orderId: string,
): Promise<OrderStatusView | null> {
  const supabase = createOrdersClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('web_order_status', {
    p_order_id: orderId,
  });
  if (error) {
    console.error('[checkout] estado del pedido', error.code, error.message);
    return null;
  }
  if (!data) return null;
  const row = data as {
    order_id: string;
    number: number;
    status: string;
    fulfillment: 'click_collect' | 'shipping';
    locale: 'es' | 'ca' | 'en';
    items_cents: number;
    discount_cents: number;
    discount_code: string | null;
    shipping_cents: number;
    total_cents: number;
    reserved_until: string;
    paid_at: string | null;
    payable: boolean;
  };
  return {
    orderId: row.order_id,
    number: row.number,
    status: row.status,
    fulfillment: row.fulfillment,
    locale: row.locale,
    itemsCents: row.items_cents,
    discountCents: row.discount_cents,
    discountCode: row.discount_code,
    shippingCents: row.shipping_cents,
    totalCents: row.total_cents,
    reservedUntil: row.reserved_until,
    paidAt: row.paid_at,
    payable: row.payable,
  };
}

/** Hay pago con tarjeta si el TPV está configurado (REDSYS_*). */
export function paymentsEnabled(): boolean {
  return redsysConfig() !== null;
}

/**
 * Formulario para pagar un intento en el banco, con la referencia y el
 * importe que dio la base. null sin TPV configurado.
 */
export async function paymentFormFor(attempt: {
  reference: string;
  totalCents: number;
  number: number;
  locale: 'es' | 'ca' | 'en';
}): Promise<PaymentForm | null> {
  const config = redsysConfig();
  if (!config) return null;
  const base = siteUrl();
  const back = (result: 'ok' | 'ko') =>
    new URL(
      `/api/pagos/redsys/retorno?resultado=${result}&idioma=${attempt.locale}`,
      base,
    ).toString();
  const t = await getTranslations({
    locale: attempt.locale,
    namespace: 'order',
  });
  return redsysPaymentForm(config, {
    reference: attempt.reference,
    amountCents: attempt.totalCents,
    locale: attempt.locale,
    description: t('bankDescription', { number: attempt.number }),
    notificationUrl: new URL('/api/pagos/redsys', base).toString(),
    okUrl: back('ok'),
    koUrl: back('ko'),
  });
}
