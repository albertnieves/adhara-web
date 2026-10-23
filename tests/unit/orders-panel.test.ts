import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { StaffRole } from '@/modules/auth';
import {
  ORDER_ERRORS,
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  ORDER_TRANSITIONS,
  ORDER_VIEWS,
  ORDER_VIEW_LABELS,
  RELEASE_REASON_LABELS,
  canReleaseReservation,
  incidentOpen,
  matchesOrderView,
  orderStatusBadge,
  orderViewHref,
  panelTransitions,
  parseOrderFilter,
  transitionAction,
} from '@/modules/orders';
import type { OrderStatus, OrderViewFacts } from '@/modules/orders';

const session = (role: StaffRole) => ({ role, aal: 'aal2' as const });
const steps = (
  status: OrderStatus,
  role: StaffRole,
  fulfillment: 'click_collect' | 'shipping' = 'click_collect',
) => panelTransitions({ status, fulfillment }, session(role)).map((t) => t.to);

describe('pasos del panel sobre un pedido web', () => {
  it('cada paso del personal sin reembolso tiene botón; ninguno del sistema', () => {
    for (const t of ORDER_TRANSITIONS) {
      const action = transitionAction(t.from, t.to);
      if (t.by === 'system' || t.refund) expect(action).toBeUndefined();
      else expect(action, `${t.from}>${t.to}`).toBeDefined();
    }
  });

  it('recogida: preparar, listo y entregado con el administrador de la tienda', () => {
    expect(steps('paid', 'store_admin')).toEqual(['processing']);
    expect(steps('processing', 'store_admin')).toEqual(['ready_for_pickup']);
    expect(steps('ready_for_pickup', 'store_admin')).toEqual(['completed']);
    expect(steps('completed', 'store_admin')).toEqual([]);
  });

  it('envío: marcar enviado y entregado', () => {
    expect(steps('processing', 'store_admin', 'shipping')).toEqual(['shipped']);
    expect(steps('shipped', 'store_admin', 'shipping')).toEqual(['completed']);
  });

  it('el encargado solo mira y nadie marca pagado lo pendiente', () => {
    for (const status of ORDER_STATUSES) {
      expect(steps(status, 'viewer')).toEqual([]);
    }
    expect(steps('pending_payment', 'system_admin')).toEqual([]);
  });

  it('las incidencias se resuelven como pagadas; los reembolsos no salen', () => {
    expect(steps('needs_attention', 'store_admin')).toEqual(['paid']);
    expect(steps('paid', 'system_admin')).not.toContain('cancelled');
    expect(steps('completed', 'system_admin')).toEqual([]);
  });

  it('los pasos que mueven stock o resuelven una incidencia piden confirmación', () => {
    const confirmed = (from: OrderStatus, to: OrderStatus) =>
      Boolean(transitionAction(from, to)?.confirm);
    expect(confirmed('ready_for_pickup', 'completed')).toBe(true);
    expect(confirmed('processing', 'shipped')).toBe(true);
    expect(confirmed('needs_attention', 'paid')).toBe(true);
    expect(confirmed('paid', 'processing')).toBe(false);
  });
});

describe('estados y errores con texto', () => {
  it('todos los estados tienen etiqueta', () => {
    expect(Object.keys(ORDER_STATUS_LABELS).sort()).toEqual(
      [...ORDER_STATUSES].sort(),
    );
  });

  it('un pedido caducado sin pagar no parece pendiente', () => {
    expect(
      orderStatusBadge({ status: 'pending_payment', reservation: 'released' }),
    ).toEqual({ label: 'Sin pagar', tone: 'neutral' });
    expect(
      orderStatusBadge({ status: 'needs_attention', reservation: 'active' }),
    ).toEqual({ label: 'Incidencia', tone: 'danger' });
  });

  it('los errores de admin_transition_order tienen mensaje', () => {
    for (const code of [
      'stale_revision',
      'invalid_transition',
      'wrong_fulfillment',
      'refund_unavailable',
      'reservation_unavailable',
      'insufficient_stock',
      'invalid_tracking',
      'unknown_order',
    ]) {
      expect(ORDER_ERRORS[code], code).toBeTruthy();
    }
  });
});

describe('liberar la reserva de un pedido sin pagar (§164)', () => {
  it('solo con la reserva activa de un pedido que espera el pago', () => {
    const admin = session('store_admin');
    expect(
      canReleaseReservation(
        { status: 'pending_payment', reservation: 'active' },
        admin,
      ),
    ).toBe(true);
    for (const order of [
      { status: 'pending_payment', reservation: 'released' },
      { status: 'paid', reservation: 'committed' },
      { status: 'needs_attention', reservation: 'released' },
      { status: 'ready_for_pickup', reservation: 'committed' },
    ] as const) {
      expect(canReleaseReservation(order, admin), order.status).toBe(false);
    }
  });

  it('con orders.fulfill y MFA: el encargado no, y sin MFA nadie', () => {
    const order = { status: 'pending_payment', reservation: 'active' } as const;
    expect(canReleaseReservation(order, session('system_admin'))).toBe(true);
    expect(canReleaseReservation(order, session('viewer'))).toBe(false);
    expect(
      canReleaseReservation(order, { role: 'store_admin', aal: 'aal1' }),
    ).toBe(false);
  });

  it('su error y los motivos de la cronología tienen texto', () => {
    expect(ORDER_ERRORS.not_releasable).toBeTruthy();
    expect(Object.keys(RELEASE_REASON_LABELS).sort()).toEqual([
      'expired',
      'staff',
    ]);
  });

  it('la migración comprueba el permiso, la MFA y la revisión', () => {
    const sql = readFileSync(
      new URL(
        '../../supabase/migrations/20261023120000_order_release_reservation.sql',
        import.meta.url,
      ),
      'utf8',
    );
    expect(sql).toContain("private.has_permission('orders.fulfill')");
    expect(sql).toContain("private.current_aal() <> 'aal2'");
    expect(sql).toContain("raise exception 'stale_revision'");
    expect(sql).toContain("raise exception 'not_releasable'");
    expect(sql).toContain("jsonb_build_object('reason', 'staff')");
  });
});

describe('incidencias de pago abiertas o resueltas', () => {
  it('la que llevó el pedido a incidencias se resuelve al darlo por pagado', () => {
    const caused = { keptStatus: false };
    expect(incidentOpen('needs_attention', caused)).toBe(true);
    expect(incidentOpen('paid', caused)).toBe(false);
  });

  it('un segundo cobro sigue abierto hasta devolver el dinero', () => {
    expect(incidentOpen('paid', { keptStatus: true })).toBe(true);
    expect(incidentOpen('completed', { keptStatus: true })).toBe(true);
  });
});

describe('vistas y filtros del listado', () => {
  const facts = (
    status: OrderStatus,
    extra: Partial<OrderViewFacts> = {},
  ): OrderViewFacts => ({
    status,
    reservation: 'committed',
    hasIncident: false,
    ...extra,
  });

  it('abiertos: lo pagado por entregar y las incidencias, no lo que espera pago', () => {
    const open = ORDER_STATUSES.filter((status) =>
      matchesOrderView(facts(status), 'abiertos'),
    );
    expect(open).toEqual([
      'paid',
      'processing',
      'ready_for_pickup',
      'shipped',
      'needs_attention',
    ]);
  });

  it('distingue esperando pago de caducado sin pagar', () => {
    const pending = facts('pending_payment', { reservation: 'active' });
    const expired = facts('pending_payment', { reservation: 'released' });
    expect(matchesOrderView(pending, 'esperando_pago')).toBe(true);
    expect(matchesOrderView(expired, 'esperando_pago')).toBe(false);
    expect(matchesOrderView(expired, 'sin_pagar')).toBe(true);
  });

  it('incidencias incluye un segundo cobro en un pedido ya pagado', () => {
    expect(
      matchesOrderView(facts('paid', { hasIncident: true }), 'incidencias'),
    ).toBe(true);
    expect(matchesOrderView(facts('paid'), 'incidencias')).toBe(false);
  });

  it('cada vista tiene etiqueta', () => {
    expect(Object.keys(ORDER_VIEW_LABELS)).toEqual([...ORDER_VIEWS]);
  });

  it('ignora parámetros no válidos y conserva los válidos', () => {
    const filter = parseOrderFilter({
      vista: 'nada',
      entrega: 'dron',
      desde: '2026-02-30',
      hasta: '2026-10-12',
    });
    expect(filter.view).toBe('abiertos');
    expect(filter.fulfillment).toBeUndefined();
    expect(filter.from).toBeUndefined();
    expect(filter.to).toBe('2026-10-12T22:00:00.000Z');
    expect(filter.search.toString()).toBe('hasta=2026-10-12');
  });

  it('las fechas son días de Madrid y «hasta» incluye el día entero', () => {
    const filter = parseOrderFilter({
      vista: 'por_preparar',
      entrega: 'click_collect',
      desde: '2026-01-15',
      hasta: '2026-01-15',
    });
    expect(filter.view).toBe('por_preparar');
    expect(filter.fulfillment).toBe('click_collect');
    expect(filter.from).toBe('2026-01-14T23:00:00.000Z');
    expect(filter.to).toBe('2026-01-15T23:00:00.000Z');
    expect(orderViewHref('incidencias', filter.search)).toBe(
      '/admin/pedidos?entrega=click_collect&desde=2026-01-15&hasta=2026-01-15&vista=incidencias',
    );
    expect(orderViewHref('abiertos', new URLSearchParams())).toBe(
      '/admin/pedidos',
    );
  });
});
