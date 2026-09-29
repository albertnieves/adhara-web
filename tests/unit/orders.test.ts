import { describe, expect, it } from 'vitest';
import { availableTransitions, planTransition } from '@/modules/orders';

const system = { kind: 'system' } as const;
const viewer = { kind: 'staff', role: 'viewer', aal: 'aal2' } as const;
const storeAdmin = { kind: 'staff', role: 'store_admin', aal: 'aal2' } as const;

describe('estados del pedido', () => {
  it('solo el sistema confirma el pago y compromete la reserva', () => {
    const order = {
      status: 'pending_payment',
      fulfillment: 'shipping',
    } as const;
    expect(planTransition(order, 'paid', system)).toEqual({
      ok: true,
      inventory: 'commit_reservation',
      refund: false,
    });
    expect(planTransition(order, 'paid', storeAdmin)).toEqual({
      ok: false,
      reason: 'forbidden',
    });
  });

  it('Click & Collect: listo para recoger y entrega en mostrador', () => {
    const processing = {
      status: 'processing',
      fulfillment: 'click_collect',
    } as const;
    expect(
      planTransition(processing, 'ready_for_pickup', storeAdmin),
    ).toMatchObject({
      ok: true,
    });
    expect(planTransition(processing, 'shipped', storeAdmin)).toEqual({
      ok: false,
      reason: 'wrong_fulfillment',
    });
    expect(
      planTransition(
        { status: 'ready_for_pickup', fulfillment: 'click_collect' },
        'completed',
        storeAdmin,
      ),
    ).toEqual({ ok: true, inventory: 'sale_click_collect', refund: false });
  });

  it('el envío descuenta el stock al salir', () => {
    expect(
      planTransition(
        { status: 'processing', fulfillment: 'shipping' },
        'shipped',
        storeAdmin,
      ),
    ).toEqual({ ok: true, inventory: 'sale_online', refund: false });
  });

  it('cancelar un pedido pagado exige permiso de reembolso con MFA', () => {
    const paid = { status: 'paid', fulfillment: 'shipping' } as const;
    expect(planTransition(paid, 'cancelled', viewer)).toEqual({
      ok: false,
      reason: 'forbidden',
    });
    expect(
      planTransition(paid, 'cancelled', { ...storeAdmin, aal: 'aal1' }),
    ).toEqual({ ok: false, reason: 'forbidden' });
    expect(planTransition(paid, 'cancelled', storeAdmin)).toEqual({
      ok: true,
      inventory: 'release_reservation',
      refund: true,
    });
  });

  it('rechaza saltos de estado no definidos', () => {
    expect(
      planTransition(
        { status: 'pending_payment', fulfillment: 'shipping' },
        'shipped',
        storeAdmin,
      ),
    ).toEqual({ ok: false, reason: 'invalid_transition' });
    expect(
      planTransition(
        { status: 'cancelled', fulfillment: 'shipping' },
        'paid',
        system,
      ),
    ).toEqual({ ok: false, reason: 'invalid_transition' });
  });

  it('ofrece al personal solo las acciones que puede ejecutar', () => {
    const order = {
      status: 'processing',
      fulfillment: 'click_collect',
    } as const;
    expect(
      availableTransitions(order, { role: 'viewer', aal: 'aal2' }),
    ).toEqual([]);
    expect(
      availableTransitions(order, { role: 'store_admin', aal: 'aal2' }),
    ).toEqual(['ready_for_pickup', 'cancelled']);
  });
});
