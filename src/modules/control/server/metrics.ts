import 'server-only';
import { fetchAll } from '@/lib/supabase/paginate';
import type { StaffContext } from '@/modules/auth/server';
import type { AttentionKind, AttentionRow } from '../domain/attention';
import { ATTENTION_KINDS } from '../domain/attention';
import { isOneOf } from '../domain/labels';
import type { IsoDate } from '../domain/months';
import type { Grain, VariantSeries } from '../domain/product-metrics';
import { parseSeriesBuckets } from '../domain/product-metrics';

/*
 * Lecturas de las métricas por producto y de la atención. Las funciones
 * admin_control_* exigen ser titular con MFA; quien llama ya pasó
 * requireControl().
 */

type Supabase = StaffContext['supabase'];

/** Series de todos los formatos con movimientos, en [from, to). */
export async function listVariantSeries(
  supabase: Supabase,
  from: IsoDate,
  to: IsoDate,
  grain: Grain,
): Promise<VariantSeries[]> {
  // Una fila por formato con su serie en jsonb; se pagina igualmente.
  const rows = await fetchAll((start, end) =>
    supabase
      .rpc('admin_control_variant_series', {
        p_from: from,
        p_to: to,
        p_grain: grain,
      })
      .order('variant_id')
      .range(start, end),
  );
  return rows.map((row) => ({
    variantId: row.variant_id,
    buckets: parseSeriesBuckets(row.series),
  }));
}

export type VariantEvent = {
  variantId: string;
  at: string;
  kind: 'price' | 'cost';
  priceCents: number | null;
  compareAtCents: number | null;
  costNetCents: number | null;
};

/** Historial de PVP y de coste de unos formatos (hasta 200). */
export async function listVariantEvents(
  supabase: Supabase,
  variantIds: readonly string[],
): Promise<VariantEvent[]> {
  if (variantIds.length === 0) return [];
  const { data, error } = await supabase.rpc('admin_control_variant_events', {
    p_variant_ids: [...variantIds].slice(0, 200),
  });
  if (error) throw new Error(error.message);
  return data
    .filter((e) => e.kind === 'price' || e.kind === 'cost')
    .map((e) => ({
      variantId: e.variant_id,
      at: e.at,
      kind: e.kind === 'price' ? 'price' : 'cost',
      priceCents: e.price_cents,
      compareAtCents: e.compare_at_cents,
      costNetCents: e.cost_net_cents,
    }));
}

/** Visitas e interés por perfume, día y tipo en [from, to). */
export async function listAttention(
  supabase: Supabase,
  from: IsoDate,
  to: IsoDate,
): Promise<AttentionRow[]> {
  const rows = await fetchAll((start, end) =>
    supabase
      .rpc('admin_control_attention', { p_from: from, p_to: to })
      .order('product_id')
      .order('day')
      .order('kind')
      .range(start, end),
  );
  return rows
    .filter((r): r is typeof r & { kind: AttentionKind } =>
      isOneOf(ATTENTION_KINDS, r.kind),
    )
    .map((r) => ({
      productId: r.product_id,
      day: r.day,
      kind: r.kind,
      hits: r.hits,
    }));
}
