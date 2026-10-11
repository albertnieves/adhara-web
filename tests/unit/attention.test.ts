import { describe, expect, it, vi } from 'vitest';
import type { AttentionRow } from '@/modules/control';
import {
  MIN_CONVERSION_VIEWS,
  attentionByProduct,
  attentionScore,
  attentionSeries,
  conversionBp,
  dayRange,
  integer,
  interestGaps,
  madridDateTime,
} from '@/modules/control';

vi.mock('server-only', () => ({}));
const { listDataQuality } = await import('@/modules/control/server/system');

const rows: AttentionRow[] = [
  { productId: 'a', day: '2026-10-01', kind: 'view', hits: 3 },
  { productId: 'a', day: '2026-10-01', kind: 'unboxing', hits: 1 },
  { productId: 'a', day: '2026-10-03', kind: 'scent_view', hits: 2 },
  { productId: 'b', day: '2026-10-02', kind: 'view', hits: 5 },
];

describe('visitas por producto', () => {
  it('suma por producto y tipo', () => {
    const byProduct = attentionByProduct(rows);
    expect(byProduct.get('a')).toEqual({
      view: 3,
      scent_view: 2,
      unboxing: 1,
      add_to_cart: 0,
    });
    expect(byProduct.get('b')?.view).toBe(5);
    expect(byProduct.has('c')).toBe(false);
  });

  it('rellena con ceros los días sin visitas', () => {
    const days = dayRange('2026-10-01', '2026-10-04');
    expect(days).toEqual(['2026-10-01', '2026-10-02', '2026-10-03']);
    const series = attentionSeries(rows, 'a', days);
    expect(series.map((d) => d.view + d.scent_view)).toEqual([3, 0, 2]);
    expect(series[1]).toMatchObject({ day: '2026-10-02', unboxing: 0 });
  });

  it('rechaza periodos que no son fechas', () => {
    expect(() => dayRange('ayer', '2026-10-04')).toThrow(RangeError);
  });

  it('pesa el doble la apertura 3D', () => {
    expect(attentionScore({ view: 3, scent_view: 2, unboxing: 1 })).toBe(7);
  });
});

describe('conversión', () => {
  it('no la da con pocas visitas', () => {
    expect(conversionBp(5, MIN_CONVERSION_VIEWS - 1)).toBeNull();
    expect(conversionBp(5, 0)).toBeNull();
  });

  it('en puntos básicos y sin negativos', () => {
    expect(conversionBp(2, 40)).toBe(500);
    expect(conversionBp(-3, 40)).toBe(0);
  });
});

describe('mucho interés, pocas ventas', () => {
  it('hace falta un mínimo de productos para comparar', () => {
    expect(
      interestGaps([
        { productId: 'a', score: 100, units: 0 },
        { productId: 'b', score: 80, units: 10 },
        { productId: 'c', score: 20, units: 1 },
      ]),
    ).toEqual([]);
  });

  it('señala el cuartil superior de atención que convierte por debajo de la mediana', () => {
    const gaps = interestGaps([
      { productId: 'a', score: 100, units: 0 },
      { productId: 'b', score: 80, units: 10 },
      { productId: 'c', score: 20, units: 1 },
      { productId: 'd', score: 10, units: 1 },
      { productId: 'e', score: 5, units: 1 },
      { productId: 'sin-visitas', score: 0, units: 4 },
    ]);
    expect(gaps).toEqual([
      { productId: 'a', score: 100, units: 0, conversionBp: 0 },
    ]);
  });

  it('ignora la atención por debajo del mínimo', () => {
    const gaps = interestGaps(
      [
        { productId: 'a', score: 10, units: 0 },
        { productId: 'b', score: 8, units: 4 },
        { productId: 'c', score: 2, units: 1 },
        { productId: 'd', score: 1, units: 1 },
      ],
      { minScore: 20 },
    );
    expect(gaps).toEqual([]);
  });
});

describe('formatos de la consola', () => {
  it('fecha y hora de Madrid', () => {
    // 03:30 UTC del 11 de octubre son las 05:30 en Madrid (verano, UTC+2).
    expect(madridDateTime('2026-10-11T03:30:00Z')).toBe('11 oct 2026, 05:30');
  });

  it('enteros con separador de miles desde 1000', () => {
    expect(integer(1234)).toBe('1.234');
    expect(integer(12)).toBe('12');
  });
});

describe('calidad de datos', () => {
  it('traduce la gravedad de la base (high, medium, low)', async () => {
    const data = [
      ['stock_mismatch', 'high'],
      ['duplicate_ean', 'medium'],
      ['variant_without_sku', 'low'],
      ['otra', 'desconocida'],
    ].map(([check_key, severity]) => ({
      check_key,
      severity,
      product_id: null,
      variant_id: null,
      label: 'Marca · Perfume',
      detail: '—',
    }));
    const query = {
      order: () => query,
      range: () => Promise.resolve({ data, error: null }),
    };
    const supabase = { rpc: () => query } as unknown as Parameters<
      typeof listDataQuality
    >[0];
    const issues = await listDataQuality(supabase);
    expect(issues.map((i) => i.severity)).toEqual([
      'alta',
      'media',
      'baja',
      'baja',
    ]);
  });
});
