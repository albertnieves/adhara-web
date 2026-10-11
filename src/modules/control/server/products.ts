import 'server-only';
import type { StaffContext } from '@/modules/auth/server';
import { getDefaultLocation, listLevels } from '@/modules/inventory/server';
import { VAT_GENERAL_BP } from '@/modules/pricing';
import type { NamedVariant } from '@/modules/reports/server';
import { listAllVariants } from '@/modules/reports/server';
import type { AttentionCounts } from '../domain/attention';
import { attentionByProduct, attentionScore } from '../domain/attention';
import type { IsoDate } from '../domain/months';
import { addDays, weekStart } from '../domain/months';
import type {
  AbcClass,
  ProductRow,
  VariantSeries,
  XyzClass,
} from '../domain/product-metrics';
import {
  abcClasses,
  netUnits,
  productRow,
  rollupSeries,
  xyzClass,
} from '../domain/product-metrics';
import { listAttention, listVariantSeries } from './metrics';

/*
 * Métricas por perfume para la consola: series semanales de sus formatos,
 * disponible en la tienda, atención de 30 días y nombres. La comparten la
 * lista de productos, el resumen y la pantalla de atención.
 */

type Supabase = StaffContext['supabase'];

export type ProductMetrics = ProductRow & {
  productName: string;
  brandName: string;
  status: string;
  variants: number;
  abc: AbcClass;
  xyz: XyzClass | null;
  /** Netas por semana de las 12 últimas (la actual, aunque vaya a medias). */
  weekly: number[];
  attention: AttentionCounts | null;
  attentionScore: number;
};

export type ProductMetricsSet = {
  rows: ProductMetrics[];
  /** Perfumes del catálogo sin ningún movimiento (no se listan). */
  withoutMovements: number;
  series: VariantSeries[];
  variants: Map<string, NamedVariant>;
  from: IsoDate;
  to: IsoDate;
  hasAttention: boolean;
};

export async function loadProductMetrics(
  supabase: Supabase,
  today: IsoDate,
  weeks = 26,
): Promise<ProductMetricsSet> {
  const to = addDays(today, 1);
  const from = addDays(weekStart(today), -7 * (weeks - 1));
  const [series, variants, location, attentionRows] = await Promise.all([
    listVariantSeries(supabase, from, to, 'week'),
    listAllVariants(supabase),
    getDefaultLocation(supabase),
    listAttention(supabase, addDays(today, -29), to),
  ]);
  const levels = location ? await listLevels(supabase, location.id) : null;
  const attention = attentionByProduct(attentionRows);

  const byProduct = new Map<string, VariantSeries[]>();
  for (const s of series) {
    const productId = variants.get(s.variantId)?.productId;
    if (!productId) continue;
    const list = byProduct.get(productId) ?? [];
    list.push(s);
    byProduct.set(productId, list);
  }

  const base = [...byProduct.entries()].map(([productId, list]) => {
    const first = variants.get(list[0]!.variantId)!;
    const available = levels
      ? list.reduce((sum, s) => {
          const level = levels.get(s.variantId);
          return sum + (level ? Math.max(0, level.onHand - level.reserved) : 0);
        }, 0)
      : null;
    const row = productRow({
      productId,
      series: list,
      available,
      vatBp: VAT_GENERAL_BP,
    });
    const weekly = rollupSeries(list)
      .filter((b) => b.days > 0)
      .slice(-12)
      .map(netUnits);
    const counts = attention.get(productId) ?? null;
    return {
      ...row,
      productName: first.productName,
      brandName: first.brandName,
      status: first.productStatus,
      variants: list.length,
      weekly,
      attention: counts,
      attentionScore: counts ? attentionScore(counts) : 0,
    };
  });

  const abc = abcClasses(
    base.map((r) => ({ id: r.productId, value: r.netSalesCents })),
  );
  const rows: ProductMetrics[] = base.map((r) => ({
    ...r,
    abc: abc.get(r.productId) ?? 'C',
    xyz: xyzClass(r.periodUnits),
  }));

  const products = new Set([...variants.values()].map((v) => v.productId));
  return {
    rows,
    withoutMovements: products.size - byProduct.size,
    series,
    variants,
    from,
    to,
    hasAttention: attentionRows.length > 0,
  };
}
