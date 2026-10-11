import { describe, expect, it } from 'vitest';
import type {
  PriceEvent,
  SeriesBucket,
  VariantSeries,
} from '@/modules/control';
import {
  abcClasses,
  activeBuckets,
  bucketDays,
  combinedDemandRate,
  coverageDays,
  demandPattern,
  demandRate,
  discountDepthBp,
  elasticityHints,
  estimatedLostUnits,
  exponentialSmoothing,
  forecast,
  isCompleteBucket,
  movingAverage,
  netUnits,
  normalQuantile,
  parseSeriesBuckets,
  poissonInterval,
  productRow,
  quantile,
  realizedMargin,
  rollupSeries,
  sellThroughBp,
  sumBuckets,
  theilSenSlope,
  trend,
  xyzClass,
} from '@/modules/control';

const VAT = 2100;

function bucket(partial: Partial<SeriesBucket> = {}): SeriesBucket {
  return {
    start: '2026-08-03',
    sold: 0,
    returned: 0,
    lost: 0,
    received: 0,
    pricedSold: 0,
    grossCents: 0,
    listCents: 0,
    returnedGrossCents: 0,
    cogsCents: 0,
    uncosted: 0,
    tickets: 0,
    closingOnHand: 10,
    inStockDays: 7,
    days: 7,
    retailPriceCents: null,
    costNetCents: null,
    ...partial,
  };
}

function addDays(day: string, count: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + count * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

/** Semanas ISO seguidas desde el lunes 3 de agosto de 2026. */
function weeks(rows: readonly Partial<SeriesBucket>[]): SeriesBucket[] {
  return rows.map((row, i) =>
    bucket({ start: addDays('2026-08-03', 7 * i), ...row }),
  );
}

function repeat(
  count: number,
  row: Partial<SeriesBucket>,
): Partial<SeriesBucket>[] {
  return Array.from({ length: count }, () => row);
}

/** Semana agotada todo el tramo. */
const OUT: Partial<SeriesBucket> = { closingOnHand: 0, inStockDays: 0 };
/** Semana anterior al formato: sin existencias ni movimientos. */
const IDLE: Partial<SeriesBucket> = { closingOnHand: 0, inStockDays: 0 };

describe('serie de la base de datos', () => {
  const raw = {
    b: '2026-10-05',
    sold: 3,
    ret: 1,
    lost: 1,
    rec: 12,
    psold: 2,
    gross: 9_680,
    list: 10_000,
    rgross: 4_840,
    cogs: 4_000,
    unc: 0,
    tickets: 2,
    close: 9,
    instock: 7,
    days: 7,
    pvp: 5_000,
    cost: null,
  };

  it('traduce las claves del jsonb', () => {
    expect(parseSeriesBuckets([raw])).toEqual([
      {
        start: '2026-10-05',
        sold: 3,
        returned: 1,
        lost: 1,
        received: 12,
        pricedSold: 2,
        grossCents: 9_680,
        listCents: 10_000,
        returnedGrossCents: 4_840,
        cogsCents: 4_000,
        uncosted: 0,
        tickets: 2,
        closingOnHand: 9,
        inStockDays: 7,
        days: 7,
        retailPriceCents: 5_000,
        costNetCents: null,
      },
    ]);
    expect(parseSeriesBuckets([])).toEqual([]);
  });

  it('rechaza lo que no casa con la función', () => {
    expect(() => parseSeriesBuckets(null)).toThrow();
    expect(() => parseSeriesBuckets([null])).toThrow();
    expect(() => parseSeriesBuckets([{ ...raw, sold: 1.5 }])).toThrow();
    expect(() => parseSeriesBuckets([{ ...raw, gross: '9680' }])).toThrow();
    expect(() => parseSeriesBuckets([{ ...raw, b: '5/10/2026' }])).toThrow();
    const missing = Object.fromEntries(
      Object.entries(raw).filter(([key]) => key !== 'tickets'),
    );
    expect(() => parseSeriesBuckets([missing])).toThrow();
  });
});

describe('tramos', () => {
  it('días de un tramo completo', () => {
    expect(bucketDays('2026-10-11', 'day')).toBe(1);
    expect(bucketDays('2026-10-05', 'week')).toBe(7);
    expect(bucketDays('2026-10-01', 'month')).toBe(31);
    expect(bucketDays('2026-02-01', 'month')).toBe(28);
    expect(bucketDays('2028-02-01', 'month')).toBe(29);
  });

  it('el tramo de hoy va a medias', () => {
    expect(isCompleteBucket(bucket({ days: 7 }), 'week')).toBe(true);
    expect(isCompleteBucket(bucket({ days: 3 }), 'week')).toBe(false);
    expect(
      isCompleteBucket(bucket({ start: '2026-09-01', days: 30 }), 'month'),
    ).toBe(true);
  });

  it('los tramos iniciales sin nada no cuentan; los vacíos de después, sí', () => {
    const series = weeks([IDLE, IDLE, { received: 5 }, OUT, {}]);
    expect(activeBuckets(series).map((b) => b.start)).toEqual([
      '2026-08-17',
      '2026-08-24',
      '2026-08-31',
    ]);
    expect(activeBuckets(weeks([IDLE, IDLE]))).toEqual([]);
    expect(activeBuckets([])).toEqual([]);
  });
});

describe('totales', () => {
  it('unidades netas de devoluciones', () => {
    expect(netUnits(bucket({ sold: 5, returned: 2 }))).toBe(3);
  });

  it('suma la serie; existencias del final y PVP y coste del último con dato', () => {
    const totals = sumBuckets(
      weeks([
        {
          sold: 2,
          grossCents: 9_680,
          retailPriceCents: 5_000,
          costNetCents: 2_000,
        },
        { sold: 1, returned: 1, cogsCents: 2_000, retailPriceCents: 4_500 },
        { sold: 3, tickets: 2, closingOnHand: 4 },
      ]),
    );
    expect(totals).toMatchObject({
      sold: 6,
      returned: 1,
      grossCents: 9_680,
      cogsCents: 2_000,
      tickets: 2,
      inStockDays: 21,
      days: 21,
      closingOnHand: 4,
      retailPriceCents: 4_500,
      costNetCents: 2_000,
    });
  });

  it('una serie vacía no tiene existencias ni precio', () => {
    expect(sumBuckets([])).toMatchObject({
      sold: 0,
      days: 0,
      closingOnHand: null,
      retailPriceCents: null,
      costNetCents: null,
    });
  });

  it('agrupa formatos por fecha', () => {
    const a: VariantSeries = {
      variantId: 'a',
      buckets: weeks([
        { sold: 2, closingOnHand: 3, retailPriceCents: 5_000 },
        { sold: 1, closingOnHand: 0, inStockDays: 2 },
      ]),
    };
    const b: VariantSeries = {
      variantId: 'b',
      buckets: weeks([
        { sold: 1, closingOnHand: 5, costNetCents: 900 },
        { sold: 4, closingOnHand: 1, inStockDays: 5, tickets: 3 },
        { sold: 1, days: 3, inStockDays: 3 },
      ]),
    };
    const rolled = rollupSeries([b, a]);
    expect(
      rolled.map((r) => [r.start, r.sold, r.closingOnHand, r.inStockDays]),
    ).toEqual([
      ['2026-08-03', 3, 8, 7],
      ['2026-08-10', 5, 1, 5],
      ['2026-08-17', 1, 10, 3],
    ]);
    expect(rolled[1]).toMatchObject({
      tickets: 3,
      days: 7,
      retailPriceCents: null,
      costNetCents: null,
    });
    expect(rollupSeries([])).toEqual([]);
  });
});

describe('ritmo de venta', () => {
  it('sin serie no hay ritmo', () => {
    expect(demandRate([])).toEqual({
      perDay: null,
      rawPerDay: null,
      inStockShare: null,
    });
  });

  it('cero ventas en cuatro semanas con existencias es un ritmo de cero', () => {
    expect(demandRate(weeks([{}, {}, {}, {}]))).toEqual({
      perDay: 0,
      rawPerDay: 0,
      inStockShare: 10_000,
    });
  });

  it('una semana sin ventas no basta', () => {
    expect(demandRate(weeks([{}]))).toEqual({
      perDay: null,
      rawPerDay: null,
      inStockShare: 10_000,
    });
  });

  it('una sola venta: nada en una semana, un ritmo lento en doce', () => {
    expect(demandRate(weeks([{ sold: 1 }])).perDay).toBeNull();
    const twelve = weeks(
      Array.from({ length: 12 }, (_, i) => (i === 5 ? { sold: 1 } : {})),
    );
    expect(demandRate(twelve).perDay).toBeCloseTo(1 / 84, 10);
  });

  it('tres unidades en una semana ya dan ritmo', () => {
    expect(demandRate(weeks([{ sold: 3 }])).perDay).toBeCloseTo(3 / 7, 10);
  });

  it('corrige la demanda censurada por las roturas', () => {
    const rate = demandRate(weeks([{ sold: 7 }, { sold: 7 }, OUT, OUT]));
    expect(rate).toEqual({ perDay: 1, rawPerDay: 0.5, inStockShare: 5_000 });
  });

  it('no cuenta como rotura lo anterior al formato', () => {
    const rate = demandRate(weeks([IDLE, IDLE, { sold: 7 }, { sold: 7 }]));
    expect(rate).toEqual({ perDay: 1, rawPerDay: 1, inStockShare: 10_000 });
  });

  it('más devoluciones que ventas no es demanda negativa', () => {
    const rate = demandRate(weeks([{ returned: 2 }, { sold: 1 }, {}, {}]));
    expect(rate.perDay).toBe(0);
  });

  it('pocos días con existencias no dan ritmo aunque haya ventas', () => {
    // Tres ventas el único día con existencias no son tres al día.
    const rate = demandRate(
      weeks([{ sold: 3, inStockDays: 1 }, OUT, OUT, OUT]),
    );
    expect(rate.perDay).toBeNull();
    expect(rate.inStockShare).toBe(357);
  });

  it('varios formatos suman sus ritmos, cada uno con sus roturas', () => {
    const a: VariantSeries = {
      variantId: 'a',
      buckets: weeks([{ sold: 7 }, { sold: 7 }, OUT, OUT]),
    };
    const b: VariantSeries = {
      variantId: 'b',
      buckets: weeks([{ sold: 1 }, { sold: 1 }, { sold: 1 }, {}]),
    };
    const c: VariantSeries = { variantId: 'c', buckets: weeks([{ sold: 1 }]) };
    const rate = combinedDemandRate([a, b, c]);
    expect(rate.perDay).toBeCloseTo(1 + 3 / 28, 10);
    expect(rate.rawPerDay).toBeCloseTo(0.5 + 3 / 28, 10);
    // (14 + 28 + 7) / (28 + 28 + 7) días de formato con existencias.
    expect(rate.inStockShare).toBe(7_778);
    expect(combinedDemandRate([c])).toEqual({
      perDay: null,
      rawPerDay: null,
      inStockShare: 10_000,
    });
    expect(combinedDemandRate([])).toEqual({
      perDay: null,
      rawPerDay: null,
      inStockShare: null,
    });
  });

  it('estima lo que no se vendió en una rotura larga', () => {
    const long = weeks([{ sold: 7 }, { sold: 7 }, ...repeat(10, OUT)]);
    expect(estimatedLostUnits(long)).toBe(70);
    expect(estimatedLostUnits(weeks([{ sold: 2 }, { sold: 2 }]))).toBe(0);
    expect(estimatedLostUnits(weeks([{ sold: 1 }, OUT]))).toBeNull();
    expect(estimatedLostUnits(weeks(repeat(12, OUT)))).toBeNull();
    expect(estimatedLostUnits([])).toBeNull();
  });
});

describe('suavizado', () => {
  it('media móvil con ventana', () => {
    expect(movingAverage([1, 2, 3, 4], 2)).toEqual([null, 1.5, 2.5, 3.5]);
    expect(movingAverage([1, 2], 1)).toEqual([1, 2]);
    expect(movingAverage([1, 2], 3)).toEqual([null, null]);
    expect(movingAverage([], 2)).toEqual([]);
    expect(() => movingAverage([1], 0)).toThrow(RangeError);
    expect(() => movingAverage([1], 1.5)).toThrow(RangeError);
  });

  it('suavizado exponencial', () => {
    expect(exponentialSmoothing([10, 20], 0.5)).toEqual([10, 15]);
    const smoothed = exponentialSmoothing([10, 0, 0]);
    expect(smoothed[1]).toBeCloseTo(7, 10);
    expect(smoothed[2]).toBeCloseTo(4.9, 10);
    expect(exponentialSmoothing([])).toEqual([]);
    expect(() => exponentialSmoothing([1], 0)).toThrow(RangeError);
    expect(() => exponentialSmoothing([1], 1.2)).toThrow(RangeError);
  });

  it('cuantiles con interpolación', () => {
    expect(quantile([3, 1, 2], 0.5)).toBe(2);
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(quantile([10, 20, 30, 80, 100], 0.75)).toBe(80);
    expect(quantile([], 0.5)).toBeNull();
    expect(() => quantile([1], 2)).toThrow(RangeError);
  });
});

describe('tendencia', () => {
  it('pendiente de Theil–Sen', () => {
    expect(theilSenSlope([1, 3, 5, 7])).toBe(2);
    // Un pico aislado no la mueve.
    expect(theilSenSlope([1, 2, 3, 4, 100])).toBe(1);
    // Robusta con ceros: una venta suelta no es una tendencia.
    expect(theilSenSlope([0, 0, 0, 0, 3, 0, 0, 0])).toBe(0);
    expect(theilSenSlope([5])).toBeNull();
    expect(theilSenSlope([])).toBeNull();
  });

  it('sube: compara las 4 últimas con las 4 anteriores', () => {
    expect(trend([1, 1, 1, 1, 2, 2, 2, 2])).toEqual({
      changeBp: 10_000,
      slopeBpPerPeriod: 1_111,
      direction: 'up',
    });
  });

  it('baja', () => {
    expect(trend([3, 3, 3, 3, 1, 1, 1, 1])).toMatchObject({
      changeBp: -6_667,
      direction: 'down',
    });
  });

  it('menos de un 10 % es estable', () => {
    expect(trend([2, 2, 2, 2, 2, 2, 2, 2])).toEqual({
      changeBp: 0,
      slopeBpPerPeriod: 0,
      direction: 'flat',
    });
    expect(trend([5, 5, 5, 5, 5, 5, 5, 6])).toMatchObject({
      changeBp: 500,
      direction: 'flat',
    });
  });

  it('sin ventas antes, sube sin variación que dar', () => {
    expect(trend([0, 0, 0, 0, 2, 2, 1, 1])).toMatchObject({
      changeBp: null,
      direction: 'up',
    });
  });

  it('solo mira los 2 × ventana últimos tramos', () => {
    expect(trend([100, 0, 0, 0, 0, 2, 2, 2, 2]).direction).toBe('up');
    expect(trend([1, 1, 3, 3], { window: 2 })).toMatchObject({
      changeBp: 20_000,
      direction: 'up',
    });
  });

  it('insuficiente con pocos tramos o pocas unidades', () => {
    const none = {
      changeBp: null,
      slopeBpPerPeriod: null,
      direction: 'insufficient',
    };
    expect(trend([])).toEqual(none);
    expect(trend([3, 3, 3, 3, 3, 3, 3])).toEqual(none);
    expect(trend([0, 0, 0, 0, 0, 0, 0, 0])).toEqual(none);
    expect(trend([0, 0, 0, 1, 0, 0, 0, 0])).toEqual(none);
    expect(trend([0, 0, 0, 1, 0, 2, 0, 1])).toEqual(none);
    expect(() => trend([1, 2], { window: 0 })).toThrow(RangeError);
  });
});

describe('patrón de demanda', () => {
  it('regular', () => {
    expect(demandPattern([5, 5, 6, 5, 4, 5]).kind).toBe('smooth');
  });

  it('errática', () => {
    const pattern = demandPattern([1, 10, 1, 10, 1, 10]);
    expect(pattern.kind).toBe('erratic');
    expect(pattern.adi).toBe(1);
    expect(pattern.cv2).toBeCloseTo(20.25 / 30.25, 10);
  });

  it('intermitente', () => {
    expect(demandPattern([5, 0, 5, 0, 5, 0, 5, 0])).toEqual({
      adi: 2,
      cv2: 0,
      kind: 'intermittent',
    });
  });

  it('irregular (lumpy)', () => {
    const pattern = demandPattern([1, 0, 0, 10, 0, 0, 1, 0, 0, 10]);
    expect(pattern.kind).toBe('lumpy');
    expect(pattern.adi).toBe(2.5);
  });

  it('las semanas con más devoluciones que ventas no son demanda', () => {
    expect(demandPattern([-1, 3, 3, 3])).toMatchObject({
      kind: 'intermittent',
    });
  });

  it('insuficiente con menos de tres tramos con venta', () => {
    const none = { adi: null, cv2: null, kind: 'insufficient' };
    expect(demandPattern([])).toEqual(none);
    expect(demandPattern([0, 0, 0, 0])).toEqual(none);
    expect(demandPattern([0, 0, 5, 0, 0, 1])).toEqual(none);
  });
});

describe('previsión', () => {
  it('cuantiles de la normal', () => {
    expect(normalQuantile(0.5)).toBeCloseTo(0, 9);
    expect(normalQuantile(0.9)).toBeCloseTo(1.2815515655, 8);
    expect(normalQuantile(0.975)).toBeCloseTo(1.959963985, 8);
    expect(normalQuantile(0.01)).toBeCloseTo(-2.326347874, 8);
    expect(normalQuantile(0.1)).toBeCloseTo(-normalQuantile(0.9), 12);
    expect(() => normalQuantile(0)).toThrow(RangeError);
  });

  it('intervalo de Poisson exacto', () => {
    expect(poissonInterval(0)).toEqual({ low: 0, high: 0 });
    expect(poissonInterval(1)).toEqual({ low: 0, high: 2 });
    expect(poissonInterval(10)).toEqual({ low: 6, high: 14 });
    expect(poissonInterval(100)).toEqual({ low: 87, high: 113 });
    expect(poissonInterval(1, { low: 0.05, high: 0.95 })).toEqual({
      low: 0,
      high: 3,
    });
  });

  it('aproximación normal por encima de λ = 100, sin salto', () => {
    expect(poissonInterval(400)).toEqual({ low: 374, high: 426 });
    expect(poissonInterval(100.001)).toEqual({ low: 87, high: 113 });
  });

  it('rechaza λ y cuantiles imposibles', () => {
    expect(() => poissonInterval(-1)).toThrow(RangeError);
    expect(() => poissonInterval(Number.NaN)).toThrow(RangeError);
    expect(() => poissonInterval(1, { low: 0.9, high: 0.1 })).toThrow(
      RangeError,
    );
    expect(() => poissonInterval(1, { low: 0, high: 0.9 })).toThrow(RangeError);
  });

  it('unidades previstas al ritmo dado', () => {
    expect(forecast(0.5, 28)).toEqual({ expected: 14, low: 9, high: 19 });
    expect(forecast(1 / 84, 28)).toEqual({ expected: 0, low: 0, high: 1 });
    expect(forecast(0, 28)).toEqual({ expected: 0, low: 0, high: 0 });
    expect(forecast(null, 28)).toBeNull();
    expect(() => forecast(1, 0)).toThrow(RangeError);
    expect(() => forecast(1, 2.5)).toThrow(RangeError);
    expect(() => forecast(-1, 28)).toThrow(RangeError);
  });

  it('cobertura del disponible', () => {
    expect(coverageDays(20, 0.5)).toBe(40);
    expect(coverageDays(5, 0.3)).toBe(16);
    expect(coverageDays(0, 1)).toBe(0);
    expect(coverageDays(-2, 1)).toBe(0);
    expect(coverageDays(10, 0)).toBeNull();
    expect(coverageDays(10, null)).toBeNull();
    expect(coverageDays(null, 1)).toBeNull();
  });
});

describe('clasificación', () => {
  it('ABC por valor acumulado', () => {
    const classes = abcClasses([
      { id: 'd', value: 5 },
      { id: 'a', value: 50 },
      { id: 'c', value: 15 },
      { id: 'b', value: 30 },
    ]);
    expect(Object.fromEntries(classes)).toEqual({
      a: 'A',
      b: 'A',
      c: 'B',
      d: 'C',
    });
    expect(
      Object.fromEntries(
        abcClasses([
          { id: 'x', value: 80 },
          { id: 'y', value: 20 },
        ]),
      ),
    ).toEqual({ x: 'A', y: 'B' });
  });

  it('valor nulo o negativo es C; un solo producto con valor es A', () => {
    expect(
      Object.fromEntries(
        abcClasses([
          { id: 'a', value: 0 },
          { id: 'b', value: -10 },
          { id: 'c', value: 1 },
        ]),
      ),
    ).toEqual({ a: 'C', b: 'C', c: 'A' });
    expect(Object.fromEntries(abcClasses([{ id: 'a', value: 0 }]))).toEqual({
      a: 'C',
    });
    expect(abcClasses([]).size).toBe(0);
  });

  it('empates en orden de id, deterministas', () => {
    expect([
      ...abcClasses([
        { id: 'b', value: 10 },
        { id: 'a', value: 10 },
        { id: 'c', value: 1 },
      ]),
    ]).toEqual([
      ['a', 'A'],
      ['b', 'A'],
      ['c', 'C'],
    ]);
    expect(() => abcClasses([], { a: 0.9, b: 0.8 })).toThrow(RangeError);
  });

  it('XYZ por coeficiente de variación', () => {
    expect(xyzClass([5, 5, 5, 5])).toBe('X');
    expect(xyzClass([2, 6, 2, 6])).toBe('Y');
    expect(xyzClass([0, 0, 0, 12])).toBe('Z');
  });

  it('XYZ sin datos suficientes', () => {
    expect(xyzClass([])).toBeNull();
    expect(xyzClass([5, 5, 5])).toBeNull();
    expect(xyzClass([0, 0, 0, 0])).toBeNull();
    expect(xyzClass([1, 0, 0, 0])).toBeNull();
  });
});

describe('dinero', () => {
  it('margen realizado sin IVA', () => {
    expect(
      realizedMargin({ grossCents: 12_100, cogsCents: 4_000 }, VAT),
    ).toEqual({ netCents: 10_000, marginCents: 6_000, marginBp: 6_000 });
    expect(realizedMargin({ grossCents: 0, cogsCents: 500 }, VAT)).toEqual({
      netCents: 0,
      marginCents: -500,
      marginBp: null,
    });
    expect(
      realizedMargin({ grossCents: -1_210, cogsCents: 0 }, VAT).marginBp,
    ).toBeNull();
  });

  it('profundidad del descuento sobre el PVP', () => {
    expect(discountDepthBp(9_000, 10_000)).toBe(1_000);
    expect(discountDepthBp(10_000, 10_000)).toBe(0);
    expect(discountDepthBp(0, 0)).toBeNull();
  });

  it('venta sobre lo disponible', () => {
    expect(sellThroughBp(3, 12)).toBe(2_500);
    expect(sellThroughBp(0, 0)).toBeNull();
    expect(sellThroughBp(-1, 5)).toBe(0);
  });
});

describe('elasticidad al precio', () => {
  // Semana 5 (7 de septiembre): el PVP baja de 50 € a 40 €.
  const series = weeks([
    ...repeat(5, { sold: 4 }),
    { sold: 100 },
    ...repeat(6, { sold: 6 }),
  ]);
  const events: PriceEvent[] = [
    { at: '2026-09-09T10:00:00+02:00', priceCents: 4_000 },
    { at: '2026-07-01T10:00:00+02:00', priceCents: 5_000 },
  ];

  it('ritmos antes y después, sin el tramo del cambio, y elasticidad de arco', () => {
    const [hint, ...rest] = elasticityHints(series, events);
    expect(rest).toEqual([]);
    expect(hint).toMatchObject({
      at: '2026-09-09T10:00:00+02:00',
      oldPriceCents: 5_000,
      newPriceCents: 4_000,
      elasticity: -1.8,
      conclusive: true,
    });
    expect(hint!.rateBefore).toBeCloseTo(16 / 28, 10);
    expect(hint!.rateAfter).toBeCloseTo(24 / 28, 10);
  });

  it('el día del cambio es el de Madrid', () => {
    // 22:30 UTC del domingo 6 ya es lunes 7 en Madrid: tramo de la semana 5.
    const [hint] = elasticityHints(series, [
      { at: '2026-07-01T10:00:00Z', priceCents: 5_000 },
      { at: '2026-09-06T22:30:00Z', priceCents: 4_000 },
    ]);
    expect(hint!.rateAfter).toBeCloseTo(24 / 28, 10);
  });

  it('un evento con el mismo PVP (solo cambia el tachado) no corta', () => {
    const hints = elasticityHints(series, [
      ...events,
      { at: '2026-08-20T10:00:00+02:00', priceCents: 5_000 },
    ]);
    expect(hints).toHaveLength(1);
    expect(hints[0]!.rateBefore).toBeCloseTo(16 / 28, 10);
  });

  it('sin tramos con existencias suficientes a un lado, no hay pista', () => {
    const broken = weeks([
      { sold: 4 },
      OUT,
      OUT,
      OUT,
      { sold: 4 },
      { sold: 4 },
      ...repeat(6, { sold: 6 }),
    ]);
    expect(elasticityHints(broken, events)).toEqual([]);
    expect(elasticityHints(broken, events, { minWeeks: 2 })).toHaveLength(1);
  });

  it('con pocas unidades no es concluyente', () => {
    const thin = weeks([
      ...repeat(6, { sold: 1 }),
      { sold: 1 },
      { sold: 1 },
      { sold: 2 },
      { sold: 1 },
    ]);
    const [hint] = elasticityHints(thin, events);
    expect(hint).toMatchObject({ elasticity: -1, conclusive: false });
  });

  it('sin ventas a ningún lado no hay elasticidad', () => {
    const [hint] = elasticityHints(weeks(repeat(12, {})), events);
    expect(hint).toMatchObject({
      rateBefore: 0,
      rateAfter: 0,
      elasticity: null,
      conclusive: false,
    });
  });

  it('dos cambios en el mismo tramo no dan pista', () => {
    expect(
      elasticityHints(series, [
        ...events,
        { at: '2026-09-11T10:00:00+02:00', priceCents: 4_500 },
      ]),
    ).toEqual([]);
  });

  it('sin PVP anterior, a «sin PVP» o fuera de la serie, no hay pista', () => {
    expect(elasticityHints(series, [events[0]!])).toEqual([]);
    expect(
      elasticityHints(series, [
        events[1]!,
        { at: '2026-08-26T10:00:00+02:00', priceCents: null },
        { at: '2026-10-01T10:00:00+02:00', priceCents: 4_000 },
      ]),
    ).toEqual([]);
    expect(
      elasticityHints(series, [
        events[1]!,
        { at: '2026-12-01T10:00:00+01:00', priceCents: 4_000 },
      ]),
    ).toEqual([]);
    expect(elasticityHints([], events)).toEqual([]);
  });
});

describe('fila de la tabla de productos', () => {
  /** Vendidas con precio cobrado: 48,40 € (40 € + IVA) sobre un PVP de 50 €. */
  function priced(sold: number, partial: Partial<SeriesBucket> = {}) {
    return {
      sold,
      pricedSold: sold,
      grossCents: sold * 4_840,
      listCents: sold * 5_000,
      cogsCents: sold * 2_000,
      retailPriceCents: 5_000,
      costNetCents: 2_000,
      ...partial,
    };
  }

  it('con datos: unidades, ventas, margen, tendencia, previsión y cobertura', () => {
    const buckets = weeks([
      ...repeat(4, priced(2)),
      ...repeat(4, priced(4)),
      ...repeat(4, priced(6)),
      priced(1, { days: 3, inStockDays: 3, closingOnHand: 30 }),
      // Semana futura dentro del periodo: no cuenta.
      { days: 0, inStockDays: 0, closingOnHand: 30 },
    ]);
    const row = productRow({
      productId: 'p',
      series: [{ variantId: 'v', buckets }],
      available: 30,
      vatBp: VAT,
    });
    expect(row).toMatchObject({
      productId: 'p',
      units4: 19,
      units12: 47,
      salesCents: 227_480,
      estimatedCents: 0,
      unpricedUnits: 0,
      netSalesCents: 188_000,
      cogsCents: 94_000,
      marginCents: 94_000,
      marginBp: 5_000,
      discountBp: 320,
      periodUnits: [2, 2, 2, 4, 4, 4, 4, 6, 6, 6, 6],
      trend: { changeBp: 5_000, direction: 'up' },
      pattern: { kind: 'smooth' },
      lostUnits: 0,
      forecast: { expected: 16, low: 11, high: 22 },
      available: 30,
      coverageDays: 51,
      closingOnHand: 30,
    });
    expect(row.demand.perDay).toBeCloseTo(47 / 80, 10);
    expect(row.demand.inStockShare).toBe(10_000);
    expect(xyzClass(row.periodUnits)).toBe('X');
  });

  it('sin ventas: todo insuficiente o vacío, nada inventado', () => {
    const buckets = weeks([
      ...repeat(12, IDLE),
      { received: 10, closingOnHand: 10, days: 3, inStockDays: 3 },
    ]);
    const row = productRow({
      productId: 'p',
      series: [{ variantId: 'v', buckets }],
      available: 10,
      vatBp: VAT,
    });
    expect(row).toMatchObject({
      units4: 0,
      units12: 0,
      salesCents: 0,
      marginBp: null,
      discountBp: null,
      periodUnits: [],
      trend: { direction: 'insufficient' },
      pattern: { kind: 'insufficient' },
      demand: { perDay: null, rawPerDay: null },
      lostUnits: null,
      forecast: null,
      coverageDays: null,
      closingOnHand: 10,
    });
  });

  it('una sola venta: sin tendencia ni patrón, previsión prudente', () => {
    const buckets = weeks(
      Array.from({ length: 12 }, (_, i) => (i === 5 ? priced(1) : {})),
    );
    const row = productRow({
      productId: 'p',
      series: [{ variantId: 'v', buckets }],
      available: 10,
      vatBp: VAT,
    });
    expect(row).toMatchObject({
      units12: 1,
      trend: { direction: 'insufficient' },
      pattern: { kind: 'insufficient' },
      forecast: { expected: 0, low: 0, high: 1 },
      lostUnits: 0,
    });
    expect(xyzClass(row.periodUnits)).toBeNull();
  });

  it('varios formatos, rotura larga y ventas sin precio cobrado', () => {
    const a: VariantSeries = {
      variantId: 'a',
      buckets: weeks([
        { sold: 7, retailPriceCents: 5_000 },
        { sold: 7, retailPriceCents: 5_000 },
        ...repeat(10, { ...OUT, retailPriceCents: 5_000 }),
      ]),
    };
    const b: VariantSeries = {
      variantId: 'b',
      buckets: weeks(repeat(12, { sold: 2, closingOnHand: 4 })),
    };
    const row = productRow({
      productId: 'p',
      series: [a, b],
      available: 4,
      vatBp: VAT,
    });
    expect(row).toMatchObject({
      units12: 38,
      salesCents: 70_000,
      estimatedCents: 70_000,
      unpricedUnits: 24,
      lostUnits: 70,
      closingOnHand: 4,
      coverageDays: 3,
    });
    expect(row.demand.perDay).toBeCloseTo(1 + 24 / 84, 10);
    expect(row.demand.inStockShare).toBe(5_833);
  });

  it('sin formatos', () => {
    expect(
      productRow({ productId: 'p', series: [], available: null, vatBp: VAT }),
    ).toMatchObject({
      units4: 0,
      units12: 0,
      salesCents: 0,
      marginBp: null,
      demand: { perDay: null, rawPerDay: null, inStockShare: null },
      forecast: null,
      coverageDays: null,
      lostUnits: null,
      closingOnHand: null,
    });
  });
});
