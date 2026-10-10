import type { OrderStatus } from './status';

/** Read from the database under a lock; never accept these values from a browser. */
export type OrderPaymentSnapshot = {
  status: OrderStatus;
  provider: string;
  paymentReference: string;
  amountCents: number;
  currency: 'EUR';
  reservation: 'active' | 'released' | 'committed';
  /** Persisted when a successful payment is recorded, including incidents. */
  receivedTransactionId: string | null;
};

/**
 * Normalized by a SERVER adapter after verifying signature, merchant, terminal,
 * environment and operation type. This type is not proof of authenticity.
 * Never call the planner directly with JSON from a request or the return URL.
 */
export type CardPaymentNotification = {
  provider: string;
  paymentReference: string;
  transactionId: string;
  outcome: 'succeeded' | 'declined' | 'pending';
  amountCents: number;
  currency: string;
};

export type PaymentConfirmationPlan =
  | { action: 'reject'; reason: 'invalid_data' | 'wrong_payment' }
  | { action: 'ignore'; reason: 'not_paid' | 'already_recorded' }
  | {
      action: 'review';
      reason:
        | 'amount_mismatch'
        | 'currency_mismatch'
        | 'additional_payment'
        | 'reservation_unavailable'
        | 'unexpected_status';
    }
  | { action: 'confirm'; inventory: 'commit_reservation' };

function validAmount(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

/**
 * Pure decision only: no payment verification, persistence or stock mutation.
 * The future transaction must atomically record the payment, apply this plan,
 * update the reservation/order and enqueue the confirmation. A unique provider
 * + transaction key and row locks must enforce idempotency under concurrency.
 */
export function planCardPaymentConfirmation(
  order: OrderPaymentSnapshot,
  payment: CardPaymentNotification,
): PaymentConfirmationPlan {
  if (
    !validAmount(order.amountCents) ||
    !validAmount(payment.amountCents) ||
    !order.provider.trim() ||
    !order.paymentReference.trim() ||
    !payment.transactionId.trim() ||
    !['succeeded', 'declined', 'pending'].includes(payment.outcome)
  ) {
    return { action: 'reject', reason: 'invalid_data' };
  }
  if (
    order.provider !== payment.provider ||
    order.paymentReference !== payment.paymentReference
  ) {
    return { action: 'reject', reason: 'wrong_payment' };
  }
  // Declines/pending notifications never undo a successful payment or release
  // stock: expiration is a separate transaction with the same order lock.
  if (payment.outcome !== 'succeeded') {
    return { action: 'ignore', reason: 'not_paid' };
  }
  if (payment.currency !== order.currency) {
    return { action: 'review', reason: 'currency_mismatch' };
  }
  if (payment.amountCents !== order.amountCents) {
    return { action: 'review', reason: 'amount_mismatch' };
  }
  if (order.receivedTransactionId !== null) {
    return order.receivedTransactionId === payment.transactionId
      ? { action: 'ignore', reason: 'already_recorded' }
      : { action: 'review', reason: 'additional_payment' };
  }
  if (order.status !== 'pending_payment') {
    return { action: 'review', reason: 'unexpected_status' };
  }
  if (order.reservation !== 'active') {
    return { action: 'review', reason: 'reservation_unavailable' };
  }
  return { action: 'confirm', inventory: 'commit_reservation' };
}
