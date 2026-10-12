import { describe, expect, it } from 'vitest';
import {
  ORDER_STATUSES,
  planCardPaymentConfirmation,
  type CardPaymentNotification,
  type OrderPaymentSnapshot,
} from '@/modules/orders';

// Synthetic fixtures only; no real customer, product or payment data.
const order: OrderPaymentSnapshot = {
  status: 'pending_payment',
  provider: 'test-bank',
  paymentReference: 'checkout-test-1',
  amountCents: 1250,
  currency: 'EUR',
  reservation: 'active',
  receivedTransactionId: null,
};
const payment: CardPaymentNotification = {
  provider: 'test-bank',
  paymentReference: 'checkout-test-1',
  transactionId: 'transaction-test-1',
  outcome: 'succeeded',
  amountCents: 1250,
  currency: 'EUR',
};

describe('confirmación de tarjeta (dominio; no verifica firmas ni persiste)', () => {
  it('compromete la reserva solo cuando el pago coincide con el pedido', () => {
    expect(planCardPaymentConfirmation(order, payment)).toEqual({
      action: 'confirm',
      inventory: 'commit_reservation',
    });
  });

  it.each([
    { provider: 'other-bank' },
    { paymentReference: 'another-checkout' },
  ])('rechaza un pago ajeno: %j', (change) => {
    expect(
      planCardPaymentConfirmation(order, { ...payment, ...change }),
    ).toEqual({
      action: 'reject',
      reason: 'wrong_payment',
    });
  });

  it.each([0, -1, 12.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rechaza céntimos inválidos tanto guardados como recibidos: %s',
    (amountCents) => {
      for (const [snapshot, notification] of [
        [{ ...order, amountCents }, payment],
        [order, { ...payment, amountCents }],
      ] as const) {
        expect(planCardPaymentConfirmation(snapshot, notification)).toEqual({
          action: 'reject',
          reason: 'invalid_data',
        });
      }
    },
  );

  it('rechaza una referencia de transacción vacía', () => {
    expect(
      planCardPaymentConfirmation(order, { ...payment, transactionId: ' ' }),
    ).toEqual({
      action: 'reject',
      reason: 'invalid_data',
    });
  });

  it.each(['pending', 'declined'] as const)(
    '%s no confirma ni deshace un pago anterior',
    (outcome) => {
      for (const status of ORDER_STATUSES) {
        expect(
          planCardPaymentConfirmation(
            { ...order, status },
            { ...payment, outcome },
          ),
        ).toEqual({
          action: 'ignore',
          reason: 'not_paid',
        });
      }
    },
  );

  it.each([
    [{ amountCents: 1249 }, 'amount_mismatch'],
    [{ amountCents: 1251 }, 'amount_mismatch'],
    [{ currency: 'USD' }, 'currency_mismatch'],
  ] as const)('envía discrepancias a revisión: %j', (change, reason) => {
    expect(
      planCardPaymentConfirmation(order, { ...payment, ...change }),
    ).toEqual({
      action: 'review',
      reason,
    });
  });

  it.each(ORDER_STATUSES)(
    'un pago ya registrado no duplica efectos ni retrocede desde %s',
    (status) => {
      expect(
        planCardPaymentConfirmation(
          {
            ...order,
            status,
            receivedTransactionId: payment.transactionId,
          },
          payment,
        ),
      ).toEqual({ action: 'ignore', reason: 'already_recorded' });
    },
  );

  it('un segundo cobro distinto exige revisión, aunque el pedido esté pagado', () => {
    expect(
      planCardPaymentConfirmation(
        {
          ...order,
          status: 'paid',
          receivedTransactionId: 'earlier-transaction',
        },
        payment,
      ),
    ).toEqual({ action: 'review', reason: 'additional_payment' });
  });

  it('un duplicado con importe diferente no se acepta como reintento válido', () => {
    expect(
      planCardPaymentConfirmation(
        {
          ...order,
          receivedTransactionId: payment.transactionId,
        },
        { ...payment, amountCents: 2500 },
      ),
    ).toEqual({
      action: 'review',
      reason: 'amount_mismatch',
    });
  });

  it.each(['released', 'committed'] as const)(
    'no compromete una reserva %s',
    (reservation) => {
      expect(
        planCardPaymentConfirmation({ ...order, reservation }, payment),
      ).toEqual({
        action: 'review',
        reason: 'reservation_unavailable',
      });
    },
  );

  it.each(ORDER_STATUSES.filter((status) => status !== 'pending_payment'))(
    'un cobro no registrado exige revisión desde %s',
    (status) => {
      expect(
        planCardPaymentConfirmation({ ...order, status }, payment),
      ).toEqual({
        action: 'review',
        reason: 'unexpected_status',
      });
    },
  );
});
