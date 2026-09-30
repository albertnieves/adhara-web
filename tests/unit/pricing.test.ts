import { describe, expect, it } from 'vitest';
import type { PriceChangeInput, PricePeriod } from '@/modules/pricing';
import {
  adjustRetailPrice,
  computeMargin,
  hasBlockingIssues,
  lowestPriceInWindow,
  missingConfirmations,
  reviewPriceChange,
} from '@/modules/pricing';

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe('margen', () => {
  it('caso de referencia: PVP 29,95 € con IVA 21 % y coste 18,00 €', () => {
    expect(
      computeMargin({
        retailGrossCents: 2995,
        vatBp: 2100,
        costNetCents: 1800,
      }),
    ).toEqual({
      kind: 'known',
      netRevenueCents: 2475,
      costNetCents: 1800,
      marginCents: 675,
      marginBp: 2727,
    });
  });

  it('sin coste el margen es desconocido, nunca 0', () => {
    expect(
      computeMargin({
        retailGrossCents: 2995,
        vatBp: 2100,
        costNetCents: null,
      }),
    ).toEqual({ kind: 'unknown', netRevenueCents: 2475 });
  });
});

describe('Ómnibus: precio anterior de referencia', () => {
  const history: PricePeriod[] = [
    { retailGrossCents: 3200, from: day('2026-06-01'), to: day('2026-08-20') },
    { retailGrossCents: 2800, from: day('2026-08-20'), to: day('2026-09-05') },
    { retailGrossCents: 3000, from: day('2026-09-05'), to: null },
  ];

  it('toma el más bajo de los 30 días previos a la rebaja', () => {
    expect(lowestPriceInWindow(history, day('2026-09-29'))).toBe(2800);
  });

  it('ignora precios anteriores a la ventana', () => {
    expect(lowestPriceInWindow(history, day('2026-10-10'))).toBe(3000);
  });

  it('sin precios en la ventana no hay referencia', () => {
    expect(lowestPriceInWindow(history, day('2026-05-01'))).toBeNull();
  });
});

describe('revisión de un cambio de PVP', () => {
  const base: PriceChangeInput = {
    currentRetailGrossCents: 3000,
    proposedRetailGrossCents: 2995,
    proposedCompareAtGrossCents: null,
    vatBp: 2100,
    costNetCents: 1800,
    history: [{ retailGrossCents: 3000, from: day('2026-06-01'), to: null }],
    at: day('2026-09-29'),
    policy: { minMarginBp: 2500, confirmChangeAboveBp: 2000 },
  };
  const codes = (input: PriceChangeInput) =>
    reviewPriceChange(input).issues.map((issue) => issue.code);

  it('acepta un cambio normal sin avisos', () => {
    const review = reviewPriceChange(base);
    expect(review.issues).toEqual([]);
    expect(hasBlockingIssues(review)).toBe(false);
  });

  it('bloquea importes no válidos', () => {
    expect(codes({ ...base, proposedRetailGrossCents: 0 })).toEqual([
      'invalid_amount',
    ]);
    expect(codes({ ...base, proposedRetailGrossCents: 29.95 })).toEqual([
      'invalid_amount',
    ]);
  });

  it('el precio tachado debe ser mayor que el PVP', () => {
    expect(codes({ ...base, proposedCompareAtGrossCents: 2995 })).toContain(
      'compare_at_not_higher',
    );
  });

  it('el precio tachado no puede superar el mínimo de 30 días', () => {
    const review = reviewPriceChange({
      ...base,
      proposedRetailGrossCents: 2500,
      proposedCompareAtGrossCents: 3200,
      history: [
        {
          retailGrossCents: 3200,
          from: day('2026-06-01'),
          to: day('2026-09-10'),
        },
        { retailGrossCents: 3000, from: day('2026-09-10'), to: null },
      ],
    });
    expect(review.issues).toContainEqual({
      code: 'omnibus_reference_exceeded',
      severity: 'error',
      referenceCents: 3000,
    });
    expect(hasBlockingIssues(review)).toBe(true);
  });

  it('permite anunciar la rebaja con el precio de referencia correcto', () => {
    expect(
      codes({
        ...base,
        proposedRetailGrossCents: 2700,
        proposedCompareAtGrossCents: 3000,
      }),
    ).not.toContain('omnibus_reference_exceeded');
  });

  it('sin historial no se puede anunciar una rebaja', () => {
    expect(
      codes({
        ...base,
        currentRetailGrossCents: null,
        proposedCompareAtGrossCents: 3500,
        history: [],
      }),
    ).toContain('omnibus_no_history');
  });

  it('pide confirmación bajo coste, bajo margen mínimo y en cambios grandes', () => {
    expect(codes({ ...base, proposedRetailGrossCents: 2000 })).toEqual([
      'below_cost',
      'large_change',
    ]);
    expect(codes({ ...base, proposedRetailGrossCents: 2900 })).toEqual([
      'below_min_margin',
    ]);
  });

  it('el servidor exige cada confirmación pendiente', () => {
    const review = reviewPriceChange({
      ...base,
      proposedRetailGrossCents: 2000,
    });
    expect(missingConfirmations(review, [])).toEqual([
      'below_cost',
      'large_change',
    ]);
    expect(
      missingConfirmations(review, ['below_cost', 'large_change']),
    ).toEqual([]);
  });

  it('informa cuando falta el coste', () => {
    expect(codes({ ...base, costNetCents: null })).toEqual(['margin_unknown']);
  });
});

describe('ajuste masivo de PVP', () => {
  it('aplica porcentajes y redondeos comerciales', () => {
    expect(
      adjustRetailPrice(2500, { kind: 'percent', bp: 1000 }, 'exact'),
    ).toBe(2750);
    expect(
      adjustRetailPrice(2500, { kind: 'percent', bp: 1000 }, 'ends_95'),
    ).toBe(2795);
    expect(
      adjustRetailPrice(3000, { kind: 'fixed', cents: 0 }, 'ends_95'),
    ).toBe(2995);
    expect(
      adjustRetailPrice(3045, { kind: 'fixed', cents: 0 }, 'ends_95'),
    ).toBe(2995);
    expect(adjustRetailPrice(2849, { kind: 'percent', bp: 0 }, 'ends_00')).toBe(
      2800,
    );
    expect(adjustRetailPrice(40, { kind: 'fixed', cents: 0 }, 'ends_95')).toBe(
      95,
    );
  });

  it('no devuelve precios nulos o negativos', () => {
    expect(
      adjustRetailPrice(1000, { kind: 'fixed', cents: -1000 }, 'exact'),
    ).toBeNull();
    expect(
      adjustRetailPrice(1000, { kind: 'percent', bp: -10_000 }, 'exact'),
    ).toBeNull();
  });
});
