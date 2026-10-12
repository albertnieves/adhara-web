import type { StaffSession } from '@/modules/auth';
import { isAllowed } from '@/modules/auth';
import type { OrderStatus } from './status';
import { ORDER_TRANSITIONS } from './status';

/*
 * Devoluciones desde la ficha (P06, DECISIONS §139). La base decide de nuevo
 * (admin_request_refund): esto solo elige qué botones enseñar y con qué
 * importe. Siempre sobre un cobro concreto y nunca por encima de lo cobrado
 * menos lo ya devuelto.
 */

export type RefundablePayment = {
  id: number;
  outcome: string;
  decision: string;
  transactionId: string;
  amountCents: number;
  refundedCents: number;
};

export type RefundOption = {
  key: string;
  paymentId: number;
  /** null: cobro de más, se devuelve sin cambiar el pedido. */
  to: 'cancelled' | 'refunded' | 'partially_refunded' | null;
  /** Importe fijo; null si lo escribe el personal (parcial, hasta maxCents). */
  amountCents: number | null;
  maxCents: number;
  label: string;
};

const LABELS: Record<NonNullable<RefundOption['to']>, string> = {
  cancelled: 'Cancelar y devolver el dinero',
  refunded: 'Devolver todo',
  partially_refunded: 'Devolver una parte',
};

function remaining(payment: RefundablePayment) {
  return payment.amountCents - payment.refundedCents;
}

function refundable(payment: RefundablePayment) {
  return (
    payment.outcome === 'succeeded' &&
    (payment.decision === 'confirm' || payment.decision === 'review') &&
    remaining(payment) > 0
  );
}

export function refundOptions(
  order: { status: OrderStatus; receivedTransactionId: string | null },
  payments: readonly RefundablePayment[],
  session: StaffSession,
  { pending }: { pending: boolean },
): RefundOption[] {
  if (pending || !isAllowed(session, 'orders.refund')) return [];
  const options: RefundOption[] = [];
  const main = payments.find(
    (p) => p.transactionId === order.receivedTransactionId && refundable(p),
  );
  if (main) {
    const left = remaining(main);
    for (const rule of ORDER_TRANSITIONS) {
      if (rule.from !== order.status || !rule.refund) continue;
      const to = rule.to as NonNullable<RefundOption['to']>;
      // Una parcial deja algo por devolver: hace falta más de un céntimo.
      if (to === 'partially_refunded' && left < 2) continue;
      options.push({
        key: `${main.id}-${to}`,
        paymentId: main.id,
        to,
        amountCents: to === 'partially_refunded' ? null : left,
        maxCents: to === 'partially_refunded' ? left - 1 : left,
        label: LABELS[to],
      });
    }
  }
  for (const payment of payments) {
    if (payment.transactionId === order.receivedTransactionId) continue;
    if (payment.decision !== 'review' || !refundable(payment)) continue;
    options.push({
      key: `${payment.id}-extra`,
      paymentId: payment.id,
      to: null,
      amountCents: remaining(payment),
      maxCents: remaining(payment),
      label: 'Devolver este cobro',
    });
  }
  return options;
}

export const REFUND_STATUS_LABELS: Readonly<
  Record<
    'requested' | 'succeeded' | 'failed' | 'unknown',
    { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }
  >
> = {
  requested: { label: 'Enviada al banco', tone: 'neutral' },
  succeeded: { label: 'Devuelto', tone: 'success' },
  failed: { label: 'Rechazada por el banco', tone: 'danger' },
  unknown: { label: 'Sin respuesta del banco', tone: 'warning' },
};
