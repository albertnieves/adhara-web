import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ORDER_ERRORS,
  PORTAL_RESPONSE_CODE,
  REFUND_STALL_MINUTES,
  orderEventLabel,
  panelTransitions,
  refundStalled,
  refundStatusBadge,
} from '@/modules/orders';

/*
 * Arreglos de las devoluciones (DECISIONS §168): la ficha reconoce la
 * devolución atascada con el mismo plazo que la base, no ofrece pasos con
 * una devolución abierta y cuenta lo resuelto con el portal del banco.
 */

const sql = readFileSync(
  new URL(
    '../../supabase/migrations/20261024120000_refund_safeguards.sql',
    import.meta.url,
  ),
  'utf8',
);
const now = new Date('2026-10-24T12:00:00Z');
const minutesAgo = (minutes: number) =>
  new Date(now.getTime() - minutes * 60_000).toISOString();
const admin = { role: 'store_admin', aal: 'aal2' } as const;

describe('devolución atascada', () => {
  it('el mismo plazo que private.refund_stalled', () => {
    expect(sql).toContain(
      `p_refund.sent_at < now() - interval '${REFUND_STALL_MINUTES} minutes'`,
    );
  });

  it('sin respuesta clara, siempre; enviada, solo pasado el plazo', () => {
    expect(
      refundStalled({ status: 'unknown', sentAt: minutesAgo(0) }, now),
    ).toBe(true);
    expect(
      refundStalled({ status: 'requested', sentAt: minutesAgo(2) }, now),
    ).toBe(false);
    expect(
      refundStalled(
        { status: 'requested', sentAt: minutesAgo(REFUND_STALL_MINUTES + 1) },
        now,
      ),
    ).toBe(true);
    expect(
      refundStalled({ status: 'succeeded', sentAt: minutesAgo(60) }, now),
    ).toBe(false);
    expect(
      refundStalled({ status: 'failed', sentAt: minutesAgo(60) }, now),
    ).toBe(false);
  });

  it('el estado dice si se comprobó en el portal o lleva rato sin respuesta', () => {
    const base = { responseCode: null, error: null, sentAt: minutesAgo(0) };
    expect(refundStatusBadge({ ...base, status: 'requested' }, now)).toEqual({
      label: 'Enviada al banco',
      tone: 'neutral',
      detail: null,
    });
    expect(
      refundStatusBadge(
        { ...base, status: 'requested', sentAt: minutesAgo(30) },
        now,
      ),
    ).toMatchObject({ label: 'Sin respuesta del banco', tone: 'warning' });
    expect(
      refundStatusBadge(
        { ...base, status: 'succeeded', responseCode: '0900' },
        now,
      ),
    ).toEqual({ label: 'Devuelto', tone: 'success', detail: 'Código 0900' });
    expect(
      refundStatusBadge(
        { ...base, status: 'succeeded', responseCode: PORTAL_RESPONSE_CODE },
        now,
      ),
    ).toEqual({
      label: 'Devuelto',
      tone: 'success',
      detail: 'Comprobado en el portal del banco',
    });
    expect(
      refundStatusBadge(
        { ...base, status: 'failed', responseCode: PORTAL_RESPONSE_CODE },
        now,
      ),
    ).toMatchObject({ label: 'No se hizo', tone: 'neutral' });
    expect(
      refundStatusBadge({ ...base, status: 'unknown', error: 'network' }, now),
    ).toEqual({
      label: 'Sin respuesta del banco',
      tone: 'warning',
      detail: 'network',
    });
  });

  it('la cronología no atribuye al banco lo comprobado en el portal', () => {
    expect(
      orderEventLabel({
        kind: 'refund_succeeded',
        detail: { source: 'portal' },
      }),
    ).toBe('Devolución hecha, comprobada en el portal del banco');
    expect(
      orderEventLabel({ kind: 'refund_failed', detail: { source: 'portal' } }),
    ).toBe('Devolución no hecha, comprobada en el portal del banco');
    expect(orderEventLabel({ kind: 'refund_succeeded', detail: null })).toBe(
      'Devolución aceptada por el banco',
    );
    expect(orderEventLabel({ kind: 'desconocido', detail: null })).toBe(
      'desconocido',
    );
  });
});

describe('pasos del pedido con una devolución abierta', () => {
  it('no se ofrece ninguno hasta que se resuelva', () => {
    const order = { status: 'processing', fulfillment: 'shipping' } as const;
    expect(panelTransitions(order, admin).map((t) => t.to)).toEqual([
      'shipped',
    ]);
    expect(panelTransitions(order, admin, { refundOpen: true })).toEqual([]);
  });
});

describe('errores de la migración', () => {
  it('cada error de las funciones del panel tiene su mensaje', () => {
    const codes = new Set(
      [...sql.matchAll(/raise exception '([a-z_]+)'/g)].map((m) => m[1] ?? ''),
    );
    // forbidden lo traduce el mensaje general del panel.
    codes.delete('forbidden');
    expect(codes.size).toBeGreaterThan(5);
    for (const code of codes) expect(ORDER_ERRORS[code], code).toBeTruthy();
  });
});
