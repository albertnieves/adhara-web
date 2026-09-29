import { describe, expect, it } from 'vitest';
import type { StockSnapshot, StockWatchPolicy } from '@/modules/inventory';
import {
  MOVEMENT_TYPES,
  applyMovement,
  stocktakeMovement,
  watchStock,
} from '@/modules/inventory';

describe('movimientos de inventario', () => {
  const level = { onHand: 5, reserved: 2 };

  it('ciclo de una venta online: reserva y salida', () => {
    const reserved = applyMovement(level, { type: 'RESERVATION', quantity: 3 });
    expect(reserved).toEqual({
      ok: true,
      level: { onHand: 5, reserved: 5 },
      delta: { onHand: 0, reserved: 3 },
    });
    const shipped = applyMovement(
      { onHand: 5, reserved: 5 },
      { type: 'SALE_ONLINE', quantity: 3 },
    );
    expect(shipped).toMatchObject({
      ok: true,
      level: { onHand: 2, reserved: 2 },
    });
  });

  it('no reserva ni vende en tienda más de lo disponible', () => {
    expect(applyMovement(level, { type: 'RESERVATION', quantity: 4 })).toEqual({
      ok: false,
      error: 'insufficient_available',
    });
    expect(applyMovement(level, { type: 'SALE_STORE', quantity: 4 })).toEqual({
      ok: false,
      error: 'insufficient_available',
    });
    expect(
      applyMovement(level, { type: 'SALE_STORE', quantity: 3 }),
    ).toMatchObject({ ok: true, level: { onHand: 2, reserved: 2 } });
  });

  it('no libera más de lo reservado', () => {
    expect(
      applyMovement(level, { type: 'RESERVATION_RELEASE', quantity: 3 }),
    ).toEqual({ ok: false, error: 'insufficient_reserved' });
  });

  it('valida cantidad y motivo', () => {
    expect(
      applyMovement(level, { type: 'PURCHASE_RECEIPT', quantity: 0 }),
    ).toEqual({ ok: false, error: 'invalid_quantity' });
    expect(applyMovement(level, { type: 'SALE_STORE', quantity: -1 })).toEqual({
      ok: false,
      error: 'invalid_quantity',
    });
    expect(applyMovement(level, { type: 'DAMAGE_LOSS', quantity: 1 })).toEqual({
      ok: false,
      error: 'reason_required',
    });
    expect(
      applyMovement(level, {
        type: 'MANUAL_ADJUSTMENT',
        quantity: -2,
        reason: 'Frasco roto en escaparate',
      }),
    ).toMatchObject({ ok: true, level: { onHand: 3, reserved: 2 } });
  });

  it('una devolución dañada queda registrada sin reponer stock', () => {
    expect(
      applyMovement(level, {
        type: 'RETURN_DAMAGED',
        quantity: 1,
        reason: 'Precinto abierto',
      }),
    ).toMatchObject({ ok: true, level });
  });

  it('on_hand es la suma de los movimientos aplicados', () => {
    let current = { onHand: 0, reserved: 0 };
    for (const movement of [
      { type: 'PURCHASE_RECEIPT', quantity: 12 },
      { type: 'RESERVATION', quantity: 2 },
      { type: 'SALE_CLICK_COLLECT', quantity: 2 },
      { type: 'SALE_STORE', quantity: 3 },
      { type: 'TESTER_ALLOCATION', quantity: 1 },
      { type: 'RETURN', quantity: 1 },
    ] as const) {
      const result = applyMovement(current, movement);
      if (!result.ok) throw new Error(result.error);
      current = result.level;
    }
    expect(current).toEqual({ onHand: 7, reserved: 0 });
  });

  it('todos los tipos de movimiento tienen efecto definido', () => {
    for (const type of MOVEMENT_TYPES) {
      const result = applyMovement(
        { onHand: 10, reserved: 1 },
        { type, quantity: 1, reason: 'prueba' },
      );
      expect(result.ok).toBe(true);
    }
  });

  it('el recuento genera el ajuste de la diferencia', () => {
    expect(stocktakeMovement(7, 5)).toEqual({
      type: 'STOCKTAKE_ADJUSTMENT',
      quantity: -2,
    });
    expect(stocktakeMovement(7, 7)).toBeNull();
    expect(() => stocktakeMovement(7, -1)).toThrow(RangeError);
  });
});

describe('vigilante de stock (agente, capa determinista)', () => {
  const now = new Date('2026-09-29T08:00:00Z');
  const policy: StockWatchPolicy = {
    targetCoverDays: 30,
    safetyDays: 7,
    deadStockDays: 90,
  };
  const snapshot = (overrides: Partial<StockSnapshot>): StockSnapshot => ({
    variantId: 'variante-prueba',
    locationId: 'ubicacion-prueba',
    onHand: 20,
    reserved: 0,
    minStock: null,
    sellable: true,
    unitsSold: 0,
    salesWindowDays: 30,
    leadTimeDays: null,
    packSize: null,
    incomingUnits: 0,
    lastSaleAt: new Date('2026-09-20T00:00:00Z'),
    firstStockedAt: new Date('2026-01-01T00:00:00Z'),
    expiredActiveReservations: 0,
    ...overrides,
  });

  it('sin incidencias no genera hallazgos', () => {
    expect(watchStock([snapshot({})], policy, now)).toEqual([]);
  });

  it('agotado con ventas y plazo conocido: propone reponer hasta la cobertura', () => {
    const [finding] = watchStock(
      [snapshot({ onHand: 2, reserved: 2, unitsSold: 30, leadTimeDays: 14 })],
      policy,
      now,
    );
    // 1 ud/día × (14 + 7 + 30) días = 51 unidades.
    expect(finding).toMatchObject({
      kind: 'out_of_stock',
      severity: 'critical',
      proposal: { kind: 'reorder', quantity: 51 },
    });
  });

  it('redondea la propuesta al múltiplo de compra y descuenta lo pendiente de recibir', () => {
    const [finding] = watchStock(
      [
        snapshot({
          onHand: 3,
          unitsSold: 30,
          leadTimeDays: 14,
          incomingUnits: 10,
          packSize: 6,
        }),
      ],
      policy,
      now,
    );
    // Cobertura objetivo 51 − posición (3 + 10) = 38 → 42 en cajas de 6.
    expect(finding).toMatchObject({
      kind: 'low_cover',
      proposal: { kind: 'reorder', quantity: 42 },
    });
  });

  it('bajo mínimo sin plazo conocido: repone solo hasta el mínimo', () => {
    const [finding] = watchStock(
      [snapshot({ onHand: 2, minStock: 4 })],
      policy,
      now,
    );
    expect(finding).toMatchObject({
      kind: 'below_min',
      severity: 'warning',
      proposal: { kind: 'reorder', quantity: 2 },
    });
  });

  it('no propone compras sin datos que las justifiquen', () => {
    const [finding] = watchStock([snapshot({ onHand: 0 })], policy, now);
    expect(finding).toMatchObject({ kind: 'out_of_stock', proposal: null });
  });

  it('no alerta de reposición en variantes retiradas de la venta', () => {
    expect(
      watchStock([snapshot({ onHand: 0, sellable: false })], policy, now),
    ).toEqual([]);
  });

  it('detecta niveles incoherentes y reservas vencidas', () => {
    const findings = watchStock(
      [
        snapshot({ variantId: 'a', expiredActiveReservations: 2, reserved: 2 }),
        snapshot({ variantId: 'b', onHand: 1, reserved: 3 }),
      ],
      policy,
      now,
    );
    expect(
      findings.map((finding) => [finding.variantId, finding.kind]),
    ).toEqual([
      ['b', 'inconsistent_level'],
      ['a', 'stale_reservations'],
    ]);
    expect(findings[1]?.proposal).toEqual({
      kind: 'release_expired_reservations',
      count: 2,
    });
  });

  it('señala stock inmovilizado desde la última venta o la entrada', () => {
    const findings = watchStock(
      [
        snapshot({ variantId: 'sin-ventas', lastSaleAt: null }),
        snapshot({
          variantId: 'nuevo',
          lastSaleAt: null,
          firstStockedAt: new Date('2026-09-01T00:00:00Z'),
        }),
      ],
      policy,
      now,
    );
    expect(findings).toEqual([
      expect.objectContaining({
        variantId: 'sin-ventas',
        kind: 'dead_stock',
        severity: 'info',
      }),
    ]);
  });
});
