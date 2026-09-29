import 'server-only';
import { cache } from 'react';
import { createSupabasePublicClient } from '@/lib/supabase/public';
import type { Availability, StorefrontProduct } from '../domain/product';
import { AVAILABILITY, isAudience, isConcentration } from '../domain/product';

/*
 * Lecturas de la tienda con el cliente anónimo: RLS solo devuelve perfumes
 * publicados, sus formatos activos, textos e imágenes. Sin Supabase configurado
 * (CI, local sin .env) la tienda muestra la colección vacía.
 */

const PRODUCT_SELECT =
  'id, slug, name, concentration, audience, featured, position, unboxing_scene, brand:brands!inner(slug, name), variants:product_variants(id, label, size_ml, retail_price_cents, compare_at_price_cents, position), media:product_media(url, alt, role, origin, provisional, position), translations:product_translations(locale, tagline, description)';

type Row = {
  id: string;
  slug: string;
  name: string;
  concentration: string | null;
  audience: string | null;
  featured: boolean;
  position: number;
  unboxing_scene: string | null;
  brand: { slug: string; name: string } | null;
  variants: {
    id: string;
    label: string | null;
    size_ml: number | null;
    retail_price_cents: number | null;
    compare_at_price_cents: number | null;
    position: number;
  }[];
  media: {
    url: string;
    alt: string | null;
    role: string;
    origin: string;
    provisional: boolean;
    position: number;
  }[];
  translations: {
    locale: string;
    tagline: string | null;
    description: string | null;
  }[];
};

function toProduct(row: Row, locale: string): StorefrontProduct {
  const text = row.translations.find((t) => t.locale === locale);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    brand: row.brand ?? { slug: '', name: '' },
    concentration: isConcentration(row.concentration)
      ? row.concentration
      : null,
    audience: isAudience(row.audience) ? row.audience : null,
    featured: row.featured,
    position: row.position,
    unboxingScene: row.unboxing_scene,
    tagline: text?.tagline ?? null,
    description: text?.description ?? null,
    variants: row.variants
      .map((v) => ({
        id: v.id,
        label: v.label,
        sizeMl: v.size_ml,
        priceCents: v.retail_price_cents,
        compareAtCents: v.compare_at_price_cents,
        position: v.position,
      }))
      .sort((a, b) => a.position - b.position),
    media: row.media
      .map((m) => ({
        url: m.url,
        alt: m.alt,
        role: m.role as StorefrontProduct['media'][number]['role'],
        origin: m.origin as StorefrontProduct['media'][number]['origin'],
        provisional: m.provisional,
        position: m.position,
      }))
      .sort((a, b) => a.position - b.position),
  };
}

function byCollectionOrder(a: StorefrontProduct, b: StorefrontProduct) {
  if (a.featured !== b.featured) return a.featured ? -1 : 1;
  if (a.position !== b.position) return a.position - b.position;
  return a.name.localeCompare(b.name, 'es');
}

export const listPublishedProducts = cache(
  async (locale: string): Promise<StorefrontProduct[]> => {
    const supabase = createSupabasePublicClient();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_SELECT)
      .eq('status', 'published');
    if (error) {
      console.error('[catalog] no se pudo leer la colección', error.message);
      return [];
    }
    return data.map((row) => toProduct(row, locale)).sort(byCollectionOrder);
  },
);

export const getPublishedProduct = cache(
  async (slug: string, locale: string): Promise<StorefrontProduct | null> => {
    const supabase = createSupabasePublicClient();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_SELECT)
      .eq('status', 'published')
      .eq('slug', slug)
      .maybeSingle();
    if (error) {
      console.error('[catalog] no se pudo leer el perfume', error.message);
      return null;
    }
    return data ? toProduct(data, locale) : null;
  },
);

/** Estado de disponibilidad por formato (nunca unidades exactas). */
export async function getAvailability(
  productIds: string[],
): Promise<Record<string, Availability>> {
  const supabase = createSupabasePublicClient();
  if (!supabase || productIds.length === 0) return {};
  const { data, error } = await supabase.rpc('storefront_availability', {
    p_product_ids: productIds,
  });
  if (error) {
    console.error('[catalog] no se pudo leer la disponibilidad', error.message);
    return {};
  }
  return Object.fromEntries(
    data
      .filter((row) => AVAILABILITY.includes(row.status as Availability))
      .map((row) => [row.variant_id, row.status as Availability]),
  );
}
