import { describe, expect, it } from 'vitest';
import { MOVEMENT_EFFECTS, MOVEMENT_TYPES } from '@/modules/inventory';
import type { ClosingRow, PeriodRow } from '@/modules/reports';
import {
  MOVEMENT_REPORT_BUCKET,
  balances,
  checkLeadTime,
  closingCsvRows,
  currentMonth,
  dayRangePeriod,
  eurosCell,
  lastDaysPeriod,
  marginRows,
  marginsByBrand,
  monthLabel,
  monthPeriod,
  rotation,
  shiftMonth,
  summarize,
  valueAtCost,
} from '@/modules/reports';

const row = (overrides: Partial<PeriodRow>): PeriodRow => ({
  variantId: 'v',
  openingUnits: 0,
  receivedUnits: 0,
  soldUnits: 0,
  returnedUnits: 0,
  lostUnits: 0,
  adjustedUnits: 0,
  transferredUnits: 0,
  closingUnits: 0,
  lastSaleAt: null,
  openingCost: null,
  closingCost: null,
  ...overrides,
});

describe('periodos de la tienda (Europe/Madrid)', () => {
  it('un mes va de medianoche a medianoche local, también con cambio de hora', () => {
    expect(monthPeriod('2026-10')).toEqual({
      from: '2026-09-30T22:00:00.000Z',
      to: '2026-10-31T23:00:00.000Z',
      firstDay: '2026-10-01',
      lastDay: '2026-10-31',
      month: '2026-10',
      days: 31,
    });
    expect(monthPeriod('2026-12')?.to).toBe('2026-12-31T23:00:00.000Z');
    expect(monthPeriod('2026-13')).toBeNull();
    expect(monthPeriod('octubre')).toBeNull();
  });

  it('rangos de días incluidos y validación', () => {
    expect(dayRangePeriod('2026-03-28', '2026-03-29')).toMatchObject({
      from: '2026-03-27T23:00:00.000Z',
      to: '2026-03-29T22:00:00.000Z',
      days: 2,
    });
    expect(dayRangePeriod('2026-02-30', '2026-03-01')).toBeNull();
    expect(dayRangePeriod('2026-03-02', '2026-03-01')).toBeNull();
  });

  it('últimos días y mes actual según la hora de Madrid', () => {
    // 23:30 UTC del 30/09 ya es 1 de octubre en Madrid.
    const now = new Date('2026-09-30T23:30:00Z');
    expect(currentMonth(now)).toBe('2026-10');
    expect(lastDaysPeriod(30, now)).toMatchObject({
      firstDay: '2026-09-02',
      lastDay: '2026-10-01',
      days: 30,
    });
  });

  it('navega entre meses y los nombra en español', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(monthLabel('2026-10')).toBe('Octubre de 2026');
  });
});

describe('cuadre y valoración de existencias', () => {
  it('las categorías cubren todo movimiento que cambia las unidades', () => {
    for (const type of MOVEMENT_TYPES) {
      const moves = MOVEMENT_EFFECTS[type].onHand !== 0;
      expect(MOVEMENT_REPORT_BUCKET[type] !== null, type).toBe(moves);
    }
  });

  it('iniciales + movimientos = finales', () => {
    const october = row({
      openingUnits: 7,
      soldUnits: 2,
      lostUnits: 1,
      adjustedUnits: 1,
      closingUnits: 5,
    });
    expect(balances(october)).toBe(true);
    expect(balances({ ...october, closingUnits: 6 })).toBe(false);
  });

  it('sin coste el valor es desconocido, nunca 0', () => {
    expect(valueAtCost(3, { costNetCents: 1250, isLater: false })).toBe(3750);
    expect(valueAtCost(3, null)).toBeNull();
    expect(valueAtCost(0, null)).toBe(0);
  });

  it('resume por marca con unidades sin coste y costes posteriores', () => {
    const rows = [
      row({
        variantId: 'a',
        closingUnits: 4,
        closingCost: { costNetCents: 1000, isLater: false },
      }),
      row({
        variantId: 'b',
        closingUnits: 2,
        closingCost: { costNetCents: 800, isLater: true },
      }),
      row({ variantId: 'c', closingUnits: 3, closingCost: null }),
    ];
    const brand = (r: PeriodRow) =>
      r.variantId === 'c'
        ? { key: 'm2', label: 'Marca 2' }
        : { key: 'm1', label: 'Marca 1' };
    const { groups, total } = summarize(rows, brand);
    expect(groups.map((g) => [g.label, g.closing.valueCents])).toEqual([
      ['Marca 1', 5600],
      ['Marca 2', 0],
    ]);
    expect(total.closing).toEqual({
      units: 9,
      valueCents: 5600,
      unitsWithoutCost: 3,
      unitsWithLaterCost: 2,
    });
    expect(total.formats).toBe(3);
  });

  it('rotación, cobertura y días sin vender', () => {
    const now = new Date('2026-10-31T12:00:00Z');
    expect(
      rotation(
        row({
          openingUnits: 10,
          closingUnits: 6,
          soldUnits: 8,
          lastSaleAt: new Date('2026-10-21T12:00:00Z'),
        }),
        30,
        now,
      ),
    ).toEqual({
      averageStock: 8,
      turnover: 1,
      coverDays: 22,
      daysSinceSale: 10,
    });
    expect(rotation(row({ closingUnits: 4 }), 30, now)).toEqual({
      averageStock: 2,
      turnover: 0,
      coverDays: null,
      daysSinceSale: null,
    });
  });
});

describe('márgenes del catálogo', () => {
  const rows = marginRows(
    [
      // 24,20 € con IVA = 20,00 € sin IVA; coste 12 € → 40 %.
      {
        variantId: 'a',
        brandName: 'Lattafa',
        label: 'a',
        priceCents: 2420,
        costNetCents: 1200,
      },
      // 12,10 € con IVA = 10,00 € sin IVA; coste 11 € → −10 %.
      {
        variantId: 'b',
        brandName: 'Lattafa',
        label: 'b',
        priceCents: 1210,
        costNetCents: 1100,
      },
      {
        variantId: 'c',
        brandName: 'Armaf',
        label: 'c',
        priceCents: 4950,
        costNetCents: null,
      },
      {
        variantId: 'd',
        brandName: 'Armaf',
        label: 'd',
        priceCents: null,
        costNetCents: 900,
      },
    ],
    2100,
  );

  it('margen por formato; desconocido sin PVP o sin coste', () => {
    expect(rows.map((r) => r.marginBp)).toEqual([4000, -1000, null, null]);
  });

  it('por marca: media, formatos con coste y por debajo del mínimo', () => {
    expect(marginsByBrand(rows, 0)).toEqual([
      {
        brandName: 'Lattafa',
        formats: 2,
        withPrice: 2,
        withCost: 2,
        averageMarginBp: 1500,
        belowMin: 1,
      },
      {
        brandName: 'Armaf',
        formats: 2,
        withPrice: 1,
        withCost: 1,
        averageMarginBp: null,
        belowMin: 0,
      },
    ]);
  });
});

describe('plazo de los proveedores', () => {
  it('compara el real con el declarado con un día de tolerancia', () => {
    expect(checkLeadTime(3, 5)).toEqual({
      kind: 'slower',
      realDays: 5,
      declaredDays: 3,
    });
    expect(checkLeadTime(5, 5.8)).toMatchObject({ kind: 'ok' });
    expect(checkLeadTime(7, 2.04)).toMatchObject({
      kind: 'faster',
      realDays: 2,
    });
    expect(checkLeadTime(null, 4)).toEqual({
      kind: 'no_declared',
      realDays: 4,
    });
    expect(checkLeadTime(3, null)).toEqual({ kind: 'no_data' });
  });
});

describe('CSV del cierre para la gestoría', () => {
  const rows: ClosingRow[] = [
    {
      ...row({
        variantId: 'b',
        openingUnits: 7,
        soldUnits: 2,
        closingUnits: 5,
        openingCost: { costNetCents: 1000, isLater: false },
        closingCost: { costNetCents: 1205, isLater: false },
      }),
      brandName: 'Lattafa',
      productName: 'Yara',
      variantLabel: '100 ml',
      sku: '=HYPERLINK("x")',
    },
    {
      ...row({ variantId: 'a', receivedUnits: 4, closingUnits: 4 }),
      brandName: 'Armaf',
      productName: 'Club de Nuit',
      variantLabel: '105 ml',
      sku: null,
    },
  ];

  it('importes en euros con coma decimal', () => {
    expect(eurosCell(602500)).toBe('6025,00');
    expect(eurosCell(-5)).toBe('-0,05');
    expect(eurosCell(null)).toBeNull();
  });

  it('ordena por marca y perfume, valora y añade el total', () => {
    const csv = closingCsvRows(rows, true);
    expect(csv[0]).toHaveLength(17);
    expect(csv[1]?.slice(0, 3)).toEqual(['Armaf', 'Club de Nuit', '105 ml']);
    expect(csv[1]?.at(-1)).toBe('Sin coste registrado');
    expect(csv[2]?.slice(12)).toEqual([
      '10,00',
      '70,00',
      '12,05',
      '60,25',
      null,
    ]);
    expect(csv.at(-1)).toEqual([
      'TOTAL',
      null,
      null,
      null,
      7,
      4,
      2,
      0,
      0,
      0,
      0,
      9,
      null,
      '70,00',
      null,
      '60,25',
      'Sin coste: 0 uds. iniciales y 4 finales no suman',
    ]);
  });

  it('sin permiso de costes, solo unidades', () => {
    const csv = closingCsvRows(rows, false);
    expect(csv[0]).toHaveLength(12);
    expect(csv.every((line) => line.length === 12)).toBe(true);
  });
});

describe('visor de auditoría', () => {
  it('área por prefijo de la acción', async () => {
    const { auditArea, isAuditArea } = await import('@/modules/reports');
    expect(auditArea('catalog.product_created')).toBe('catalog');
    expect(auditArea('purchasing.order_received')).toBe('purchasing');
    expect(auditArea('otra.cosa')).toBeNull();
    expect(isAuditArea('constructor')).toBe(false);
  });

  it('solo las claves que cambian, en orden', async () => {
    const { auditChanges } = await import('@/modules/reports');
    expect(
      auditChanges(
        { on_hand: 5, reserved: 0, note: 'x' },
        { on_hand: 3, reserved: 0, movement_id: 9 },
      ),
    ).toEqual([
      { key: 'movement_id', before: undefined, after: 9 },
      { key: 'note', before: 'x', after: undefined },
      { key: 'on_hand', before: 5, after: 3 },
    ]);
    expect(auditChanges(null, { count: 2 })).toEqual([
      { key: 'count', before: undefined, after: 2 },
    ]);
  });
});
