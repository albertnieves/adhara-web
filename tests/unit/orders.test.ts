import { describe, expect, it } from 'vitest';
import { availableTransitions, planTransition } from '@/modules/orders';

const system = { kind: 'system' } as const;
const staff = { kind: 'staff', role: 'store_staff', aal: 'aal2' } as const;
const manager = { kind: 'staff', role: 'manager', aal: 'aal2' } as const;

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
    expect(planTransition(order, 'paid', manager)).toEqual({
      ok: false,
      reason: 'forbidden',
    });
  });

  it('Click & Collect: listo para recoger y entrega en mostrador', () => {
    const processing = {
      status: 'processing',
      fulfillment: 'click_collect',
    } as const;
    expect(planTransition(processing, 'ready_for_pickup', staff)).toMatchObject(
      {
        ok: true,
      },
    );
    expect(planTransition(processing, 'shipped', staff)).toEqual({
      ok: false,
      reason: 'wrong_fulfillment',
    });
    expect(
      planTransition(
        { status: 'ready_for_pickup', fulfillment: 'click_collect' },
        'completed',
        staff,
      ),
    ).toEqual({ ok: true, inventory: 'sale_click_collect', refund: false });
  });

  it('el envío descuenta el stock al salir', () => {
    expect(
      planTransition(
        { status: 'processing', fulfillment: 'shipping' },
        'shipped',
        staff,
      ),
    ).toEqual({ ok: true, inventory: 'sale_online', refund: false });
  });

  it('cancelar un pedido pagado exige permiso de reembolso con MFA', () => {
    const paid = { status: 'paid', fulfillment: 'shipping' } as const;
    expect(planTransition(paid, 'cancelled', staff)).toEqual({
      ok: false,
      reason: 'forbidden',
    });
    expect(
      planTransition(paid, 'cancelled', { ...manager, aal: 'aal1' }),
    ).toEqual({ ok: false, reason: 'forbidden' });
    expect(planTransition(paid, 'cancelled', manager)).toEqual({
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
        manager,
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
      availableTransitions(order, { role: 'store_staff', aal: 'aal2' }),
    ).toEqual(['ready_for_pickup']);
    expect(
      availableTransitions(order, { role: 'manager', aal: 'aal2' }),
    ).toEqual(['ready_for_pickup', 'cancelled']);
    expect(
      availableTransitions(order, { role: 'content_editor', aal: 'aal2' }),
    ).toEqual([]);
  });
});
