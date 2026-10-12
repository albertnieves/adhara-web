import { describe, expect, it } from 'vitest';
import type { RefundablePayment } from '@/modules/orders';
import { refundOptions } from '@/modules/orders';

const admin = { role: 'store_admin', aal: 'aal2' } as const;
const paid: RefundablePayment = {
  id: 1,
  outcome: 'succeeded',
  decision: 'confirm',
  transactionId: 'ref/1',
  amountCents: 9980,
  refundedCents: 0,
};

describe('devoluciones que ofrece la ficha', () => {
  it('pagado sin entregar: cancelar y devolver todo lo cobrado', () => {
    expect(
      refundOptions(
        { status: 'paid', receivedTransactionId: 'ref/1' },
        [paid],
        admin,
        { pending: false },
      ),
    ).toEqual([
      {
        key: '1-cancelled',
        paymentId: 1,
        to: 'cancelled',
        amountCents: 9980,
        maxCents: 9980,
        label: 'Cancelar y devolver el dinero',
      },
    ]);
  });

  it('entregado: parcial (lo escribe el personal) o todo', () => {
    const options = refundOptions(
      { status: 'completed', receivedTransactionId: 'ref/1' },
      [{ ...paid, refundedCents: 0 }],
      admin,
      { pending: false },
    );
    expect(options.map((o) => [o.to, o.amountCents, o.maxCents])).toEqual([
      ['partially_refunded', null, 9979],
      ['refunded', 9980, 9980],
    ]);
    expect(
      refundOptions(
        { status: 'partially_refunded', receivedTransactionId: 'ref/1' },
        [{ ...paid, refundedCents: 3000 }],
        admin,
        { pending: false },
      ).map((o) => [o.to, o.amountCents]),
    ).toEqual([['refunded', 6980]]);
  });

  it('un cobro de más se devuelve aparte y entero', () => {
    expect(
      refundOptions(
        { status: 'processing', receivedTransactionId: 'ref/1' },
        [
          paid,
          { ...paid, id: 2, decision: 'review', transactionId: 'otra/2' },
          { ...paid, id: 3, outcome: 'declined', decision: 'ignore' },
        ],
        admin,
        { pending: false },
      ).map((o) => [o.paymentId, o.to, o.amountCents, o.label]),
    ).toEqual([
      [1, 'cancelled', 9980, 'Cancelar y devolver el dinero'],
      [2, null, 9980, 'Devolver este cobro'],
    ]);
  });

  it('nada con una devolución abierta, sin permiso o ya devuelto', () => {
    const order = { status: 'paid' as const, receivedTransactionId: 'ref/1' };
    expect(refundOptions(order, [paid], admin, { pending: true })).toEqual([]);
    expect(
      refundOptions(
        order,
        [paid],
        { role: 'viewer', aal: 'aal2' },
        {
          pending: false,
        },
      ),
    ).toEqual([]);
    expect(
      refundOptions(
        { status: 'refunded', receivedTransactionId: 'ref/1' },
        [{ ...paid, refundedCents: 9980 }],
        admin,
        { pending: false },
      ),
    ).toEqual([]);
  });
});
