import { describe, expect, it } from 'vitest';
import type { BulkVariant } from '@/modules/pricing/domain/bulk';
import {
  parsePercent,
  parseSignedEuros,
  planBulkPriceChange,
} from '@/modules/pricing/domain/bulk';

const options = {
  vatBp: 2100,
  policy: { minMarginBp: 0, confirmChangeAboveBp: 2000 },
  at: new Date('2026-09-30T10:00:00Z'),
};

const variant = (overrides: Partial<BulkVariant>): BulkVariant => ({
  variantId: 'v',
  productId: 'p',
  brandName: 'Marca',
  productName: 'Perfume',
  variantLabel: '100 ml',
  retailCents: 4990,
  compareAtCents: null,
  costNetCents: null,
  ...overrides,
});

describe('entradas del cambio masivo', () => {
  it('interpreta porcentajes con signo y decimales', () => {
    expect(parsePercent('+5')).toBe(500);
    expect(parsePercent('-10 %')).toBe(-1000);
    expect(parsePercent('2,5')).toBe(250);
    expect(parsePercent('0')).toBeNull();
    expect(parsePercent('-95')).toBeNull();
    expect(parsePercent('diez')).toBeNull();
  });

  it('interpreta importes con signo', () => {
    expect(parseSignedEuros('+2')).toBe(200);
    expect(parseSignedEuros('-1,50 €')).toBe(-150);
    expect(parseSignedEuros('0')).toBeNull();
  });
});

describe('plan del cambio masivo', () => {
  it('calcula el nuevo PVP con redondeo y lo revisa', () => {
    const [row] = planBulkPriceChange(
      [variant({})],
      { kind: 'percent', bp: 500 },
      'ends_95',
      options,
    );
    expect(row).toMatchObject({
      // 49,90 € + 5 % = 52,40 €; el ,95 más cercano es 51,95 €.
      proposedCents: 5195,
      changeBp: 411,
      excluded: null,
      confirm: [],
    });
    expect(row?.review?.issues).toEqual([
      { code: 'margin_unknown', severity: 'info' },
    ]);
  });

  it('excluye formatos sin PVP, en rebaja o sin cambio', () => {
    const rows = planBulkPriceChange(
      [
        variant({ variantId: 'a', retailCents: null }),
        variant({ variantId: 'b', compareAtCents: 5990 }),
        variant({ variantId: 'c', retailCents: 2995 }),
      ],
      { kind: 'fixed', cents: 1 },
      'ends_95',
      options,
    );
    expect(rows.map((r) => r.excluded)).toEqual([
      'no_price',
      'on_sale',
      'unchanged',
    ]);
  });

  it('pide confirmar cambios grandes y ventas por debajo del coste', () => {
    const [row] = planBulkPriceChange(
      [variant({ retailCents: 4990, costNetCents: 3500 })],
      { kind: 'percent', bp: -3000 },
      'exact',
      options,
    );
    expect(row?.proposedCents).toBe(3493);
    expect(row?.excluded).toBeNull();
    expect(row?.confirm.sort()).toEqual(['below_cost', 'large_change']);
  });

  it('no propone precios no positivos', () => {
    const [row] = planBulkPriceChange(
      [variant({ retailCents: 500 })],
      { kind: 'fixed', cents: -500 },
      'exact',
      options,
    );
    expect(row?.excluded).toBe('invalid');
  });
});
