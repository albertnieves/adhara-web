/**
 * Margen teórico del catálogo: PVP sin IVA frente al coste neto vigente de
 * cada formato. Sin coste el margen es desconocido y se lista aparte.
 */
import { computeMargin } from '@/modules/pricing';

export type MarginInput = {
  variantId: string;
  brandName: string;
  label: string;
  priceCents: number | null;
  costNetCents: number | null;
};

export type MarginRow = MarginInput & {
  marginCents: number | null;
  marginBp: number | null;
};

export type BrandMargin = {
  brandName: string;
  formats: number;
  withPrice: number;
  withCost: number;
  /** Media simple del margen % de los formatos con PVP y coste. */
  averageMarginBp: number | null;
  belowMin: number;
};

export function marginRows(
  inputs: readonly MarginInput[],
  vatBp: number,
): MarginRow[] {
  return inputs.map((input) => {
    if (input.priceCents === null || input.costNetCents === null) {
      return { ...input, marginCents: null, marginBp: null };
    }
    const margin = computeMargin({
      retailGrossCents: input.priceCents,
      vatBp,
      costNetCents: input.costNetCents,
    });
    return margin.kind === 'known'
      ? { ...input, marginCents: margin.marginCents, marginBp: margin.marginBp }
      : { ...input, marginCents: null, marginBp: null };
  });
}

export function isBelowMin(row: MarginRow, minMarginBp: number): boolean {
  return row.marginBp !== null && row.marginBp < minMarginBp;
}

export function marginsByBrand(
  rows: readonly MarginRow[],
  minMarginBp: number,
): BrandMargin[] {
  const byBrand = new Map<string, MarginRow[]>();
  for (const row of rows) {
    byBrand.set(row.brandName, [...(byBrand.get(row.brandName) ?? []), row]);
  }
  return [...byBrand.entries()]
    .map(([brandName, list]) => {
      const known = list.filter((row) => row.marginBp !== null);
      return {
        brandName,
        formats: list.length,
        withPrice: list.filter((row) => row.priceCents !== null).length,
        withCost: list.filter((row) => row.costNetCents !== null).length,
        averageMarginBp: known.length
          ? Math.round(
              known.reduce((sum, row) => sum + row.marginBp!, 0) / known.length,
            )
          : null,
        belowMin: list.filter((row) => isBelowMin(row, minMarginBp)).length,
      };
    })
    .sort(
      (a, b) =>
        (a.averageMarginBp ?? Infinity) - (b.averageMarginBp ?? Infinity) ||
        a.brandName.localeCompare(b.brandName, 'es'),
    );
}
