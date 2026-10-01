'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { BasisPoints, Cents } from '@/lib/money';
import { fetchAll } from '@/lib/supabase/paginate';
import { describeDbError } from '@/modules/admin';
import { isAllowed } from '@/modules/auth';
import { requirePermission } from '@/modules/auth/server';
import type { BulkRow, BulkVariant, PriceAdjustment } from '@/modules/pricing';
import {
  MAX_BULK_ROWS,
  PROVISIONAL_PRICING_POLICY,
  VAT_GENERAL_BP,
  parsePercent,
  parseSignedEuros,
  planBulkPriceChange,
} from '@/modules/pricing';
import { getVariantCosts } from './admin';

/* La revisión queda almacenada en SQL con actor, versiones y caducidad.
 * Aplicar consume esa revisión exacta; un reintento no recalcula ni duplica.
 * Cada fila devuelve su conflicto sin ocultar los éxitos parciales del lote.
 */

export type BulkRowView = {
  variantId: string;
  reviewId?: string;
  productId: string;
  brandName: string;
  productName: string;
  variantLabel: string;
  retailCents: Cents | null;
  proposedCents: Cents | null;
  changeBp: BasisPoints | null;
  excluded: BulkRow['excluded'];
  confirm: BulkRow['confirm'];
  /** Solo con permiso de costes. */
  marginBp: BasisPoints | null;
};

export type BulkState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'review'; rows: BulkRowView[]; canViewCost: boolean }
  | { status: 'done'; message: string; failures: string[] };

const paramsInput = z.object({
  brandId: z.union([z.uuid(), z.literal('')]),
  scope: z.enum(['published', 'all']),
  kind: z.enum(['percent', 'fixed']),
  value: z.string().trim().min(1).max(12),
  ending: z.enum(['exact', 'ends_95', 'ends_00']),
});

function readParams(formData: FormData) {
  const parsed = paramsInput.safeParse({
    brandId: formData.get('brandId') ?? '',
    scope: formData.get('scope'),
    kind: formData.get('kind'),
    value: formData.get('value') ?? '',
    ending: formData.get('ending'),
  });
  if (!parsed.success) return null;
  const { kind, value } = parsed.data;
  const adjustment: PriceAdjustment | null =
    kind === 'percent'
      ? (() => {
          const bp = parsePercent(value);
          return bp === null ? null : { kind: 'percent', bp };
        })()
      : (() => {
          const cents = parseSignedEuros(value);
          return cents === null ? null : { kind: 'fixed', cents };
        })();
  return adjustment ? { ...parsed.data, adjustment } : null;
}

export async function bulkChangePrices(
  _: BulkState,
  formData: FormData,
): Promise<BulkState> {
  const { supabase, role } = await requirePermission('pricing.edit_retail');
  const canViewCost = isAllowed({ role, aal: 'aal2' }, 'pricing.view_cost');
  if (formData.get('intent') === 'apply') {
    const selected = [...new Set(formData.getAll('row').map(String))];
    if (selected.length > MAX_BULK_ROWS)
      return { status: 'error', message: 'Demasiadas filas.' };
    const failures: string[] = [];
    let applied = 0;
    for (const variantId of selected) {
      const reviewId = z.uuid().safeParse(formData.get(`review:${variantId}`));
      if (!reviewId.success) {
        failures.push('Una fila no tiene revisión válida.');
        continue;
      }
      const { error } = await supabase.rpc('admin_apply_price_review', {
        p_review_id: reviewId.data,
        p_confirmed: formData.getAll(`confirm:${variantId}`).map(String),
      });
      if (error) failures.push(`${variantId}: ${describeDbError(error)}`);
      else applied++;
    }
    if (applied) {
      revalidatePath('/', 'layout');
      revalidatePath('/admin', 'layout');
    }
    return {
      status: 'done',
      message: `${applied} revisiones aplicadas o ya aplicadas.`,
      failures,
    };
  }
  const versions = new Map<string, string>();
  const params = readParams(formData);
  if (!params) {
    return {
      status: 'error',
      message:
        'Revisa el ajuste: un porcentaje como +5 o -10 (entre -90 % y +300 %), o un importe como +2 o -1,50.',
    };
  }

  let variants: BulkVariant[];
  try {
    const rows = await fetchAll((from, to) => {
      let query = supabase
        .from('product_variants')
        .select(
          'id, updated_at, label, size_ml, position, retail_price_cents, compare_at_price_cents, product:products!inner(id, name, status, brand_id, position, brand:brands!inner(name))',
        )
        .eq('active', true)
        .in(
          'product.status',
          params.scope === 'published' ? ['published'] : ['draft', 'published'],
        )
        .order('id');
      if (params.brandId) query = query.eq('product.brand_id', params.brandId);
      return query.range(from, to);
    });
    for (const row of rows) versions.set(row.id, row.updated_at);
    const costs = canViewCost
      ? await getVariantCosts(
          supabase,
          rows.map((r) => r.id),
        )
      : new Map<string, { costNetCents: number }>();
    variants = rows
      .toSorted(
        (a, b) =>
          a.product.brand.name.localeCompare(b.product.brand.name, 'es') ||
          a.product.position - b.product.position ||
          a.product.name.localeCompare(b.product.name, 'es') ||
          a.position - b.position,
      )
      .map((r) => ({
        variantId: r.id,
        productId: r.product.id,
        brandName: r.product.brand.name,
        productName: r.product.name,
        variantLabel: r.label?.trim() || (r.size_ml ? `${r.size_ml} ml` : '—'),
        retailCents: r.retail_price_cents,
        compareAtCents: r.compare_at_price_cents,
        costNetCents: costs.get(r.id)?.costNetCents ?? null,
      }));
  } catch {
    return { status: 'error', message: 'No se pudo leer el catálogo.' };
  }
  if (variants.length === 0) {
    return { status: 'error', message: 'No hay formatos con esos filtros.' };
  }
  if (variants.length > MAX_BULK_ROWS) {
    return {
      status: 'error',
      message: `Son ${variants.length} formatos; el máximo por cambio es ${MAX_BULK_ROWS}. Filtra por marca.`,
    };
  }

  const plan = planBulkPriceChange(variants, params.adjustment, params.ending, {
    vatBp: VAT_GENERAL_BP,
    policy: PROVISIONAL_PRICING_POLICY,
    at: new Date(),
  });

  const reviewIds = new Map<string, string>();
  for (const row of plan) {
    if (row.excluded || row.proposedCents === null) continue;
    const { data, error } = await supabase.rpc('admin_review_price', {
      p_variant_id: row.variantId,
      p_expected: versions.get(row.variantId)!,
      p_price: row.proposedCents,
      p_compare_at: null as unknown as number,
      p_cost: row.costNetCents as number,
      p_required: row.confirm,
    });
    if (error) return { status: 'error', message: describeDbError(error) };
    reviewIds.set(row.variantId, data);
  }
  return {
    status: 'review',
    canViewCost,
    rows: plan.map((row) => ({
      variantId: row.variantId,
      reviewId: reviewIds.get(row.variantId),
      productId: row.productId,
      brandName: row.brandName,
      productName: row.productName,
      variantLabel: row.variantLabel,
      retailCents: row.retailCents,
      proposedCents: row.proposedCents,
      changeBp: row.changeBp,
      excluded: row.excluded,
      confirm: row.confirm,
      marginBp:
        canViewCost && row.review?.margin?.kind === 'known'
          ? row.review.margin.marginBp
          : null,
    })),
  };
}
