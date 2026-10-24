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

/**
 * Minutos tras los que una devolución enviada sin respuesta guardada ya no
 * está en camino (el servidor espera al banco 20 segundos). Los mismos que
 * private.refund_stalled en 20261024120000_refund_safeguards (DECISIONS §168).
 */
export const REFUND_STALL_MINUTES = 10;

export type OpenRefund = {
  status: 'requested' | 'succeeded' | 'failed' | 'unknown';
  sentAt: string;
};

/**
 * Devolución abierta que hay que resolver a mano: sin respuesta clara del
 * banco, o enviada hace más de REFUND_STALL_MINUTES sin respuesta guardada.
 * Se puede volver a enviar o resolver con lo que diga el portal del banco.
 */
export function refundStalled(
  refund: OpenRefund,
  now: Date = new Date(),
): boolean {
  if (refund.status === 'unknown') return true;
  return (
    refund.status === 'requested' &&
    now.getTime() - new Date(refund.sentAt).getTime() >
      REFUND_STALL_MINUTES * 60_000
  );
}

/** Código con el que se resuelve a mano tras mirar el portal del banco. */
export const PORTAL_RESPONSE_CODE = 'portal';

/** Estado de una devolución en la ficha: texto, tono y detalle. */
export function refundStatusBadge(
  refund: { responseCode: string | null; error: string | null } & OpenRefund,
  now: Date = new Date(),
): {
  label: string;
  tone: 'success' | 'warning' | 'danger' | 'neutral';
  detail: string | null;
} {
  const portal = refund.responseCode === PORTAL_RESPONSE_CODE;
  if (refund.status === 'succeeded' && portal)
    return {
      label: 'Devuelto',
      tone: 'success',
      detail: 'Comprobado en el portal del banco',
    };
  if (refund.status === 'failed' && portal)
    return {
      label: 'No se hizo',
      tone: 'neutral',
      detail: 'Comprobado en el portal del banco',
    };
  if (refund.status === 'requested' && refundStalled(refund, now))
    return {
      label: 'Sin respuesta del banco',
      tone: 'warning',
      detail: `Enviada hace más de ${REFUND_STALL_MINUTES} minutos`,
    };
  const base = REFUND_STATUS_LABELS[refund.status];
  return {
    ...base,
    detail: refund.responseCode
      ? `Código ${refund.responseCode}`
      : refund.error,
  };
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
