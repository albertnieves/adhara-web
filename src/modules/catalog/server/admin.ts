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
