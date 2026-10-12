/*
 * Página de vuelta del banco (P04, DECISIONS §137). Una cookie técnica httpOnly
 * guarda el identificador del último pedido hecho en este navegador: es lo
 * único que da acceso a su estado (sin datos personales). La URL de vuelta
 * nunca confirma nada: el estado sale de la base, que solo cambia con la
 * notificación firmada del banco.
 */

export const ORDER_COOKIE = 'atelier_pedido';
/** 30 días: lo que dura un pedido entre el pago y la recogida o el envío. */
export const ORDER_MAX_AGE = 60 * 60 * 24 * 30;

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isOrderId(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

export type OrderStatusView = {
  orderId: string;
  number: number;
  status: string;
  fulfillment: 'click_collect' | 'shipping';
  locale: 'es' | 'ca' | 'en';
  itemsCents: number;
  shippingCents: number;
  totalCents: number;
  reservedUntil: string;
  paidAt: string | null;
  /** Se puede (volver a) pagar ahora: pendiente con la reserva en pie. */
  payable: boolean;
};

/** Lo que dijo el banco al volver; solo orienta el mensaje, nunca el estado. */
export type ReturnResult = 'ok' | 'ko' | null;

export type OrderPhase =
  /** Cobrado: en preparación, listo, enviado o entregado. */
  | 'paid'
  /** Volvió del banco con éxito y la notificación aún no ha llegado. */
  | 'confirming'
  /** Volvió del banco sin pagar y aún puede reintentarlo. */
  | 'payment_failed'
  /** Pendiente de pago sin venir del banco. */
  | 'awaiting_payment'
  /** La reserva caducó sin pago. */
  | 'expired'
  /** Cobro recibido que el personal revisa (importe, pago tardío…). */
  | 'review'
  | 'cancelled';

const PAID = new Set([
  'paid',
  'processing',
  'ready_for_pickup',
  'shipped',
  'completed',
]);
const CANCELLED = new Set(['cancelled', 'refunded', 'partially_refunded']);

export function orderPhase(
  order: Pick<OrderStatusView, 'status' | 'payable'>,
  result: ReturnResult,
): OrderPhase {
  if (PAID.has(order.status)) return 'paid';
  if (order.status === 'needs_attention') return 'review';
  if (CANCELLED.has(order.status)) return 'cancelled';
  if (!order.payable) return 'expired';
  if (result === 'ok') return 'confirming';
  if (result === 'ko') return 'payment_failed';
  return 'awaiting_payment';
}

export function readReturnResult(value: unknown): ReturnResult {
  return value === 'ok' || value === 'ko' ? value : null;
}
