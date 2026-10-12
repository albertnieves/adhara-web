import type { BasisPoints } from '@/lib/money';
import { ratioBp } from '@/lib/money';
import type { IsoDate } from './months';
import { quantile } from './product-metrics';

/**
 * Visitas e interés de los productos, con los contadores anónimos de
 * admin_control_attention (migración 20261011090200): uno por producto, día
 * de Madrid y tipo, sin nada que identifique a quien mira. «add_to_cart» lo
 * emite la cesta (P03), que solo existe con el checkout encendido.
 */

export const ATTENTION_KINDS = [
  'view',
  'scent_view',
  'unboxing',
  'add_to_cart',
] as const;
export type AttentionKind = (typeof ATTENTION_KINDS)[number];
export const ATTENTION_KIND_LABELS: Readonly<Record<AttentionKind, string>> = {
  view: 'Visitas a la ficha',
  scent_view: 'Visitas a la ficha olfativa',
  unboxing: 'Aperturas de la animación 3D',
  add_to_cart: 'Añadidos a la cesta',
};

export type AttentionRow = {
  productId: string;
  day: IsoDate;
  kind: AttentionKind;
  hits: number;
};

export type AttentionCounts = Record<AttentionKind, number>;
export type AttentionDay = AttentionCounts & { day: IsoDate };

export type InterestItem = { productId: string; score: number; units: number };
export type InterestGap = InterestItem & { conversionBp: BasisPoints };

/** Visitas mínimas para dar una conversión. */
export const MIN_CONVERSION_VIEWS = 20;
/** Productos con atención mínimos para hablar de cuartiles y mediana. */
export const MIN_GAP_ITEMS = 4;
/** Puntuación mínima para señalar un producto con interés sin ventas. */
export const MIN_GAP_SCORE = 20;

const DAY_MS = 86_400_000;

export function emptyAttention(): AttentionCounts {
  return { view: 0, scent_view: 0, unboxing: 0, add_to_cart: 0 };
}

/** Días de `from` (incluido) a `to` (excluido). */
export function dayRange(from: IsoDate, to: IsoDate): IsoDate[] {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) {
    throw new RangeError(`Periodo no válido: ${from}–${to}`);
  }
  const days: IsoDate[] = [];
  for (let time = start; time < end; time += DAY_MS) {
    days.push(new Date(time).toISOString().slice(0, 10));
  }
  return days;
}

/** Totales por producto y tipo. */
export function attentionByProduct(
  rows: readonly AttentionRow[],
): Map<string, AttentionCounts> {
  const byProduct = new Map<string, AttentionCounts>();
  for (const row of rows) {
    const counts = byProduct.get(row.productId) ?? emptyAttention();
    counts[row.kind] += row.hits;
    byProduct.set(row.productId, counts);
  }
  return byProduct;
}

/** Serie diaria de un producto en los días dados, también los días sin visitas. */
export function attentionSeries(
  rows: readonly AttentionRow[],
  productId: string,
  days: readonly IsoDate[],
): AttentionDay[] {
  const byDay = new Map<IsoDate, AttentionCounts>();
  for (const row of rows) {
    if (row.productId !== productId) continue;
    const counts = byDay.get(row.day) ?? emptyAttention();
    counts[row.kind] += row.hits;
    byDay.set(row.day, counts);
  }
  return days.map((day) => ({ day, ...(byDay.get(day) ?? emptyAttention()) }));
}

/** Interés: visitas a las fichas y, el doble, aperturas de la animación 3D. */
export function attentionScore({
  view,
  scent_view,
  unboxing,
}: Pick<AttentionCounts, 'view' | 'scent_view' | 'unboxing'>): number {
  return view + scent_view + 2 * unboxing;
}

/**
 * Unidades vendidas por cada visita, en puntos básicos. Es aproximada: las
 * unidades incluyen el mostrador. Null con menos de `minViews` visitas.
 */
export function conversionBp(
  units: number,
  views: number,
  { minViews = MIN_CONVERSION_VIEWS }: { minViews?: number } = {},
): BasisPoints | null {
  if (views <= 0 || views < minViews) return null;
  return ratioBp(Math.max(0, units), views);
}

/**
 * Productos que interesan y no se venden: atención en el cuartil superior
 * (entre los que tienen alguna) y conversión por debajo de la mediana. Con
 * menos de MIN_GAP_ITEMS productos con atención, ninguno; tampoco con menos
 * de `minScore` puntos. De más a menos atención.
 */
export function interestGaps(
  items: readonly InterestItem[],
  { minScore = MIN_GAP_SCORE }: { minScore?: number } = {},
): InterestGap[] {
  const scored = items
    .filter((item) => item.score > 0)
    .map((item) => ({
      ...item,
      conversionBp: ratioBp(Math.max(0, item.units), item.score),
    }));
  if (scored.length < MIN_GAP_ITEMS) return [];
  const topQuartile = quantile(
    scored.map((item) => item.score),
    0.75,
  );
  const medianConversion = quantile(
    scored.map((item) => item.conversionBp),
    0.5,
  );
  if (topQuartile === null || medianConversion === null) return [];
  return scored
    .filter(
      (item) =>
        item.score >= topQuartile &&
        item.score >= minScore &&
        item.conversionBp < medianConversion,
    )
    .sort(
      (a, b) => b.score - a.score || a.productId.localeCompare(b.productId),
    );
}
