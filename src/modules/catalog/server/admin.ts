import 'server-only';
import type { StaffContext } from '@/modules/auth/server';

/*
 * Lecturas del panel con la sesión del personal: RLS deja ver todos los
 * perfumes (también borradores) y el stock solo con inventory.view.
 */

type Supabase = StaffContext['supabase'];

export type AdminProductRow = {
  id: string;
  slug: string;
  name: string;
  status: string;
  featured: boolean;
  concentration: string | null;
  brandName: string;
  heroUrl: string | null;
  variants: {
    id: string;
    label: string;
    priceCents: number | null;
    active: boolean;
  }[];
  onHand: number | null;
  updatedAt: string;
};

function label(variant: { label: string | null; size_ml: number | null }) {
  return (
    variant.label?.trim() || (variant.size_ml ? `${variant.size_ml} ml` : '—')
  );
}

export async function listAdminProducts(
  supabase: Supabase,
  canViewStock: boolean,
): Promise<AdminProductRow[]> {
  const { data, error } = await supabase
    .from('products')
    .select(
      'id, slug, name, status, featured, concentration, position, updated_at, brand:brands!inner(name), variants:product_variants(id, label, size_ml, retail_price_cents, active, position), media:product_media(url, role, position)',
    )
    .order('position')
    .order('name');
  if (error) throw new Error(error.message);

  const stock = new Map<string, number>();
  if (canViewStock) {
    const { data: levels } = await supabase
      .from('inventory_levels')
      .select('variant_id, on_hand');
    for (const level of levels ?? []) {
      stock.set(
        level.variant_id,
        (stock.get(level.variant_id) ?? 0) + level.on_hand,
      );
    }
  }

  return data.map((row) => {
    const media = [...row.media].sort((a, b) => a.position - b.position);
    const hero = media.find((m) => m.role === 'hero') ?? media[0];
    const variants = [...row.variants].sort((a, b) => a.position - b.position);
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      status: row.status,
      featured: row.featured,
      concentration: row.concentration,
      brandName: row.brand.name,
      heroUrl: hero?.url ?? null,
      variants: variants.map((v) => ({
        id: v.id,
        label: label(v),
        priceCents: v.retail_price_cents,
        active: v.active,
      })),
      onHand: canViewStock
        ? variants.reduce((sum, v) => sum + (stock.get(v.id) ?? 0), 0)
        : null,
      updatedAt: row.updated_at,
    };
  });
}

export async function listBrands(supabase: Supabase) {
  const { data, error } = await supabase
    .from('brands')
    .select('id, slug, name')
    .order('name');
  if (error) throw new Error(error.message);
  return data;
}

export async function getAdminProduct(supabase: Supabase, id: string) {
  const { data, error } = await supabase
    .from('products')
    .select(
      '*, brand:brands!inner(id, name, slug), variants:product_variants(*), media:product_media(*), translations:product_translations(*)',
    )
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    ...data,
    variants: [...data.variants].sort((a, b) => a.position - b.position),
    media: [...data.media].sort((a, b) => a.position - b.position),
  };
}

export type AdminProduct = NonNullable<
  Awaited<ReturnType<typeof getAdminProduct>>
>;

export type VariantCost = {
  costNetCents: number;
  note: string | null;
  recordedAt: string;
};

/**
 * Coste vigente por formato. Solo con pricing.view_cost y MFA: la función SQL
 * lo vuelve a comprobar y responde «forbidden» si no. Nunca se usa en la tienda.
 */
export async function getVariantCosts(
  supabase: Supabase,
  variantIds: string[],
): Promise<Map<string, VariantCost>> {
  const costs = new Map<string, VariantCost>();
  if (variantIds.length === 0) return costs;
  const { data, error } = await supabase.rpc('admin_variant_costs', {
    p_variant_ids: variantIds,
  });
  if (error) throw new Error(error.message);
  for (const row of data) {
    costs.set(row.variant_id, {
      costNetCents: row.cost_net_cents,
      note: row.note,
      recordedAt: row.recorded_at,
    });
  }
  return costs;
}

export type PriceLabel = {
  variantId: string;
  productId: string;
  brandName: string;
  productName: string;
  concentration: string | null;
  sizeMl: number | null;
  variantLabel: string;
  sku: string | null;
  priceCents: number;
  compareAtCents: number | null;
};

/**
 * Etiquetas de la tienda física: formatos activos con PVP de perfumes en
 * borrador o publicados (en tienda se vende también lo que aún no está online).
 */
export async function listPriceLabels(
  supabase: Supabase,
  filter: { productId?: string; brandId?: string; publishedOnly?: boolean },
): Promise<PriceLabel[]> {
  let query = supabase
    .from('products')
    .select(
      'id, name, concentration, position, brand:brands!inner(id, name), variants:product_variants(id, label, size_ml, sku, active, retail_price_cents, compare_at_price_cents, position)',
    )
    .in('status', filter.publishedOnly ? ['published'] : ['draft', 'published'])
    .order('position')
    .order('name');
  if (filter.productId) query = query.eq('id', filter.productId);
  if (filter.brandId) query = query.eq('brand_id', filter.brandId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return data
    .toSorted((a, b) => a.brand.name.localeCompare(b.brand.name, 'es'))
    .flatMap((product) =>
      product.variants
        .toSorted((a, b) => a.position - b.position)
        .flatMap((v) =>
          v.active && v.retail_price_cents !== null
            ? [
                {
                  variantId: v.id,
                  productId: product.id,
                  brandName: product.brand.name,
                  productName: product.name,
                  concentration: product.concentration,
                  sizeMl: v.size_ml,
                  variantLabel: label(v),
                  sku: v.sku,
                  priceCents: v.retail_price_cents,
                  compareAtCents: v.compare_at_price_cents,
                },
              ]
            : [],
        ),
    );
}
