import { describe, expect, it } from 'vitest';
import type { WatchFacts, WatchLevel } from '@/modules/inventory';
import {
  buildStockSnapshots,
  isWatched,
  summarizeFindings,
  watchStock,
} from '@/modules/inventory';

const now = new Date('2026-10-01T10:00:00Z');
const policy = { targetCoverDays: 30, safetyDays: 7, deadStockDays: 120 };

const level = (overrides: Partial<WatchLevel>): WatchLevel => ({
  variantId: 'v',
  active: true,
  published: true,
  onHand: 0,
  reserved: 0,
  reorderPoint: null,
  ...overrides,
});

const facts = (overrides: Partial<WatchFacts>): WatchFacts => ({
  variantId: 'v',
  unitsSold: 0,
  lastSaleAt: null,
  firstStockedAt: null,
  ledgerOnHand: 0,
  ledgerReserved: 0,
  leadTimeDays: null,
  packSize: null,
  incomingUnits: 0,
  hasSupplier: false,
  ...overrides,
});

function run(levels: WatchLevel[], rows: WatchFacts[]) {
  const snapshots = buildStockSnapshots(
    levels,
    new Map(rows.map((row) => [row.variantId, row])),
    'tienda',
    30,
  );
  return watchStock(snapshots, policy, now);
}

describe('foto del inventario para el vigilante', () => {
  it('un borrador que nunca tuvo stock no es un agotado', () => {
    expect(isWatched(level({ published: false }), undefined)).toBe(false);
    expect(run([level({ published: false })], [])).toEqual([]);
  });

  it('un publicado sin stock sí es un agotado', () => {
    expect(run([level({})], [])).toMatchObject([
      { kind: 'out_of_stock', severity: 'critical', proposal: null },
    ]);
  });

  it('un borrador que ya se vendió en tienda se vigila', () => {
    const findings = run(
      [level({ published: false, onHand: 1, reorderPoint: 2 })],
      [
        facts({
          firstStockedAt: new Date('2026-09-01T00:00:00Z'),
          lastSaleAt: new Date('2026-09-30T00:00:00Z'),
          ledgerOnHand: 1,
          unitsSold: 9,
          leadTimeDays: 10,
          packSize: 6,
          hasSupplier: true,
        }),
      ],
    );
    // 0,3 uds/día × (10 + 7 + 30) = 15 → posición 1 → 14 → 18 en cajas de 6.
    expect(findings).toMatchObject([
      {
        kind: 'below_min',
        proposal: { kind: 'reorder', quantity: 18 },
      },
    ]);
  });

  it('un formato inactivo no genera alertas de reposición', () => {
    expect(run([level({ active: false })], [])).toEqual([]);
  });

  it('el nivel que no cuadra con sus movimientos es urgente', () => {
    const [finding] = run(
      [level({ onHand: 5 })],
      [facts({ ledgerOnHand: 3, lastSaleAt: now })],
    );
    expect(finding).toMatchObject({
      kind: 'inconsistent_level',
      severity: 'critical',
      facts: { onHand: 5, ledgerOnHand: 3 },
      proposal: null,
    });
  });

  it('lo pendiente de recibir cuenta en la posición', () => {
    const findings = run(
      [level({ onHand: 1, reorderPoint: 3 })],
      [
        facts({
          ledgerOnHand: 1,
          incomingUnits: 10,
          firstStockedAt: now,
          lastSaleAt: now,
        }),
      ],
    );
    // Bajo mínimo, pero con 10 en camino no hace falta pedir más.
    expect(findings).toMatchObject([{ kind: 'below_min', proposal: null }]);
  });

  it('resume por gravedad y tipo', () => {
    const findings = run(
      [
        level({ variantId: 'a' }),
        level({ variantId: 'b', onHand: 1, reorderPoint: 2 }),
        level({ variantId: 'c', onHand: 4 }),
      ],
      [
        facts({ variantId: 'b', ledgerOnHand: 1, lastSaleAt: now }),
        facts({
          variantId: 'c',
          ledgerOnHand: 4,
          firstStockedAt: new Date('2026-03-01T00:00:00Z'),
        }),
      ],
    );
    expect(summarizeFindings(findings)).toEqual({
      total: 3,
      bySeverity: { critical: 1, warning: 1, info: 1 },
      byKind: { out_of_stock: 1, below_min: 1, dead_stock: 1 },
      reorderProposals: 1,
    });
  });
});
