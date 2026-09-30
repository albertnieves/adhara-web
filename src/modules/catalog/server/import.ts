'use server';

import { revalidatePath } from 'next/cache';
import { fetchAll } from '@/lib/supabase/paginate';
import { describeDbError } from '@/modules/admin';
import { isAllowed } from '@/modules/auth';
import type { StaffContext } from '@/modules/auth/server';
import { requirePermission } from '@/modules/auth/server';
import { VAT_GENERAL_BP } from '@/modules/pricing';
import type {
  ExistingCatalog,
  ImportPlan,
  PlannedRow,
  RowError,
} from '../domain/import';
import { planImport, readImportRows } from '../domain/import';
import { getVariantCosts } from './admin';

/*
 * Importación de catálogo: «review» devuelve el plan; «apply» vuelve a leer el
 * CSV y a planificar en servidor (no se fía del plan del navegador) y aplica
 * con la sesión del usuario, así que RLS y los triggers de precio siguen
 * mandando. Es idempotente: si algo falla a medias, repetir reconoce lo creado.
 */

export type ImportState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | {
      status: 'review';
      plan: ImportPlan;
      canSetPrices: boolean;
      canRecordCosts: boolean;
      unknownColumns: string[];
    }
  | {
      status: 'done';
      message: string;
      failures: RowError[];
      pricesSkipped: number;
      priceConflicts: number;
      costsSkipped: number;
    };

type Supabase = StaffContext['supabase'];

const MAX_CSV_BYTES = 1024 * 1024;
const PAGE = 1000;
const BATCH = 500;

async function loadCatalog(
  supabase: Supabase,
  withCosts: boolean,
): Promise<ExistingCatalog> {
  const brands = await fetchAll((from, to) =>
    supabase
      .from('brands')
      .select('id, slug, name')
      .order('id')
      .range(from, to),
  );
  const products: ExistingCatalog['products'] = [];
  // PostgREST devuelve como mucho 1000 filas por petición.
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('products')
      .select(
        'id, brand_id, slug, name, concentration, audience, source_ref, variants:product_variants(id, size_ml, label, sku, retail_price_cents, position)',
      )
      .order('id')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    for (const p of data) {
      products.push({
        id: p.id,
        brandId: p.brand_id,
        slug: p.slug,
        name: p.name,
        concentration: p.concentration,
        audience: p.audience,
        sourceRef: p.source_ref,
        variants: p.variants.map((v) => ({
          id: v.id,
          sizeMl: v.size_ml,
          label: v.label,
          sku: v.sku,
          priceCents: v.retail_price_cents,
          position: v.position,
        })),
      });
    }
    if (data.length < PAGE) break;
  }
  // Coste vigente de cada formato, solo con pricing.view_cost (para no
  // registrar otra vez el mismo coste).
  if (withCosts) {
    const costs = await getVariantCosts(
      supabase,
      products.flatMap((p) => p.variants.map((v) => v.id)),
    );
    for (const product of products) {
      for (const variant of product.variants) {
        variant.costCents = costs.get(variant.id)?.costNetCents ?? null;
      }
    }
  }
  return { brands, products };
}

function chunks<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += BATCH) {
    out.push(items.slice(i, i + BATCH));
  }
  return out;
}

/** Primera fila de cada clave, en el orden del archivo. */
function firstBy(rows: PlannedRow[], key: (row: PlannedRow) => string) {
  const map = new Map<string, PlannedRow>();
  for (const row of rows) if (!map.has(key(row))) map.set(key(row), row);
  return [...map.entries()];
}

async function apply(
  supabase: Supabase,
  plan: ImportPlan,
  existing: ExistingCatalog,
  canSetPrices: boolean,
  cost: { allowed: boolean; note: string },
) {
  const done = {
    brands: 0,
    products: 0,
    filled: 0,
    variants: 0,
    prices: 0,
    costs: 0,
  };

  // 1. Marcas nuevas, con nombre web único.
  const brandIds = new Map<string, string>();
  const brandSlugs = new Set(existing.brands.map((b) => b.slug));
  const newBrands = firstBy(
    plan.rows.filter((r) => !r.brand.existingId),
    (r) => r.brand.key,
  ).map(([key, row]) => {
    let slug = key;
    for (let n = 2; brandSlugs.has(slug); n += 1) slug = `${key}-${n}`;
    brandSlugs.add(slug);
    return { key, slug, name: row.row.brand };
  });
  for (const batch of chunks(newBrands)) {
    const { data, error } = await supabase
      .from('brands')
      .insert(batch.map(({ slug, name }) => ({ slug, name })))
      .select('id, slug');
    if (error) return { done, error: describeDbError(error) };
    for (const brand of data) {
      const key = batch.find((b) => b.slug === brand.slug)?.key;
      if (key) brandIds.set(key, brand.id);
    }
    done.brands += data.length;
  }
  const brandId = (row: PlannedRow) =>
    row.brand.existingId ?? brandIds.get(row.brand.key);

  // 2. Perfumes nuevos (borradores), con los datos de su primera fila.
  const productIds = new Map<string, string>();
  const newProducts = firstBy(
    plan.rows.filter((r) => !r.product.existingId),
    (r) => r.product.key,
  );
  for (const batch of chunks(newProducts)) {
    const rows = batch.flatMap(([, row]) => {
      const id = brandId(row);
      return id ? [{ row, brandId: id }] : [];
    });
    if (rows.length !== batch.length) {
      return { done, error: 'No se pudo resolver una marca.' };
    }
    const { data, error } = await supabase
      .from('products')
      .insert(
        rows.map(({ row, brandId }) => ({
          brand_id: brandId,
          slug: row.product.slug,
          name: row.row.name,
          concentration: row.row.concentration,
          audience: row.row.audience,
          source_ref: row.row.source,
        })),
      )
      .select('id, slug');
    if (error) return { done, error: describeDbError(error) };
    for (const product of data) {
      const key = batch.find(([, r]) => r.product.slug === product.slug)?.[0];
      if (key) productIds.set(key, product.id);
    }
    done.products += data.length;
  }
  const productId = (row: PlannedRow) =>
    row.product.existingId ?? productIds.get(row.product.key);

  // 3. Campos vacíos de perfumes existentes.
  for (const row of plan.rows) {
    if (!row.product.existingId || Object.keys(row.product.fill).length === 0) {
      continue;
    }
    const { error } = await supabase
      .from('products')
      .update(row.product.fill)
      .eq('id', row.product.existingId);
    if (error) return { done, error: describeDbError(error) };
    done.filled += 1;
  }

  // 4. Formatos nuevos, con PVP si hay permiso (el trigger lo registra).
  const variantIds = new Map<PlannedRow, string>();
  const newVariants = plan.rows.filter((r) => !r.variant.existingId);
  for (const batch of chunks(newVariants)) {
    const rows = batch.flatMap((row) => {
      const id = productId(row);
      return id ? [{ row, productId: id }] : [];
    });
    if (rows.length !== batch.length) {
      return { done, error: 'No se pudo resolver un perfume.' };
    }
    const { data, error } = await supabase
      .from('product_variants')
      .insert(
        rows.map(({ row, productId }) => ({
          product_id: productId,
          size_ml: row.variant.sizeMl,
          label: row.variant.label,
          sku: row.variant.sku,
          ean: row.variant.ean,
          position: row.variant.position,
          retail_price_cents:
            canSetPrices && row.price.kind === 'set' ? row.price.cents : null,
        })),
      )
      .select('id, product_id, position');
    if (error) return { done, error: describeDbError(error) };
    // Cada formato nuevo es único por perfume y posición.
    const inserted = new Map(
      data.map((v) => [`${v.product_id}|${v.position}`, v.id]),
    );
    for (const { row, productId } of rows) {
      const id = inserted.get(`${productId}|${row.variant.position}`);
      if (id) variantIds.set(row, id);
    }
    done.variants += batch.length;
    if (canSetPrices) {
      done.prices += batch.filter((r) => r.price.kind === 'set').length;
    }
  }

  // 5. PVP de formatos existentes que no tenían.
  if (canSetPrices) {
    for (const row of plan.rows) {
      if (!row.variant.existingId || row.price.kind !== 'set') continue;
      const { error } = await supabase
        .from('product_variants')
        .update({ retail_price_cents: row.price.cents })
        .eq('id', row.variant.existingId)
        .is('retail_price_cents', null);
      if (error) return { done, error: describeDbError(error) };
      done.prices += 1;
    }
  }

  // 6. Costes (internal), en lotes con una sola función SQL.
  if (cost.allowed) {
    const items = plan.rows.flatMap((row) => {
      const id = row.variant.existingId ?? variantIds.get(row);
      return row.cost.kind === 'record' && id
        ? [
            {
              variant_id: id,
              cost_net_cents: row.cost.cents,
              note: [row.row.source, cost.note].filter(Boolean).join(' · '),
            },
          ]
        : [];
    });
    for (const batch of chunks(items)) {
      const { data, error } = await supabase.rpc('admin_record_variant_costs', {
        p_items: batch,
      });
      if (error) return { done, error: describeDbError(error) };
      done.costs += data;
    }
  }
  return { done, error: null };
}

export async function importCatalog(
  _: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const { supabase, role } = await requirePermission('catalog.edit');
  const canSetPrices = isAllowed({ role, aal: 'aal2' }, 'pricing.edit_retail');
  const canViewCosts = isAllowed({ role, aal: 'aal2' }, 'pricing.view_cost');
  const canRecordCosts =
    canViewCosts && isAllowed({ role, aal: 'aal2' }, 'pricing.edit_cost');
  const costWithVat = formData.get('costVat') === 'gross';
  const csv = formData.get('csv');
  const source = String(formData.get('source') ?? '').trim() || null;
  if (typeof csv !== 'string' || !csv.trim()) {
    return { status: 'error', message: 'Pega o sube un CSV.' };
  }
  if (new TextEncoder().encode(csv).length > MAX_CSV_BYTES) {
    return { status: 'error', message: 'El CSV supera 1 MB.' };
  }
  const read = readImportRows(csv, source, {
    costVatBp: costWithVat ? VAT_GENERAL_BP : 0,
  });
  if (read.fatal) return { status: 'error', message: read.fatal };

  let existing: ExistingCatalog;
  try {
    existing = await loadCatalog(supabase, canViewCosts);
  } catch {
    return { status: 'error', message: 'No se pudo leer el catálogo actual.' };
  }
  const plan = planImport(read.rows, existing, read.errors);

  if (formData.get('intent') !== 'apply') {
    return {
      status: 'review',
      plan,
      canSetPrices,
      canRecordCosts,
      unknownColumns: read.unknownColumns,
    };
  }
  if (formData.get('confirm') !== 'on') {
    return { status: 'error', message: 'Marca la confirmación para importar.' };
  }
  if (plan.rows.length === 0) {
    return { status: 'error', message: 'No hay filas válidas que importar.' };
  }

  const { done, error } = await apply(supabase, plan, existing, canSetPrices, {
    allowed: canRecordCosts,
    note: costWithVat
      ? 'coste importado con IVA, pasado a neto'
      : 'coste importado (neto)',
  });
  const pricesSkipped = canSetPrices ? 0 : plan.summary.pricesToSet;
  const costsSkipped = canRecordCosts ? 0 : plan.summary.costsToRecord;
  await supabase.rpc('record_audit_event', {
    action: 'catalog.imported',
    entity: 'catalog',
    after: {
      source,
      rows: plan.rows.length,
      errors: plan.errors.length,
      ...done,
      price_conflicts: plan.summary.priceConflicts,
      prices_skipped: pricesSkipped,
      costs_skipped: costsSkipped,
      cost_with_vat: costWithVat,
      failed: error,
    },
  });
  revalidatePath('/', 'layout');
  revalidatePath('/admin/catalogo');

  const count = (n: number, one: string, many: string) =>
    `${n} ${n === 1 ? one : many}`;
  const parts = [
    count(done.brands, 'marca', 'marcas'),
    count(done.products, 'perfume', 'perfumes'),
    count(done.variants, 'formato', 'formatos'),
    `${done.prices} PVP`,
    count(done.costs, 'coste', 'costes'),
  ].join(', ');
  if (error) {
    return {
      status: 'error',
      message: `Se aplicó en parte (${parts}) y se detuvo: ${error} Corrige el CSV y vuelve a revisarlo: lo ya creado se reconoce.`,
    };
  }
  return {
    status: 'done',
    message: `Importado: ${parts}${done.filled ? `; ${count(done.filled, 'perfume completado', 'perfumes completados')}` : ''}. Todo lo nuevo está en borrador.`,
    failures: plan.errors,
    pricesSkipped,
    priceConflicts: plan.summary.priceConflicts,
    costsSkipped,
  };
}
