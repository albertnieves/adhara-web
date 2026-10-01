import 'server-only';
import { fetchAll } from '@/lib/supabase/paginate';
import type { StaffContext } from '@/modules/auth/server';
import type { CounterItem, SearchableVariant } from '../domain/counter';
import type { WatchLevel } from '../domain/watch-snapshot';

/*
 * Formatos de perfumes no archivados con sus nombres, para buscar y mostrar
 * (mostrador, reposición, pedidos). Lectura con la sesión: RLS deja al
 * personal ver también los borradores.
 */

type Supabase = StaffContext['supabase'];

export type VariantDirectoryRow = SearchableVariant & {
  productId: string;
  productStatus: string;
  brandId: string;
  priceCents: number | null;
  active: boolean;
};

export async function listVariantDirectory(
  supabase: Supabase,
): Promise<VariantDirectoryRow[]> {
  const rows = await fetchAll((from, to) =>
    supabase
      .from('product_variants')
      .select(
        'id, label, size_ml, sku, ean, retail_price_cents, active, product:products!inner(id, name, status, brand:brands!inner(id, name))',
      )
      .neq('product.status', 'archived')
      .order('id')
      .range(from, to),
  );
  return rows
    .map((v) => ({
      variantId: v.id,
      productId: v.product.id,
      productName: v.product.name,
      productStatus: v.product.status,
      brandId: v.product.brand.id,
      brandName: v.product.brand.name,
      variantLabel: v.label?.trim() || (v.size_ml ? `${v.size_ml} ml` : '—'),
      sku: v.sku,
      ean: v.ean,
      priceCents: v.retail_price_cents,
      active: v.active,
    }))
    .sort(
      (a, b) =>
        a.brandName.localeCompare(b.brandName, 'es') ||
        a.productName.localeCompare(b.productName, 'es') ||
        a.variantLabel.localeCompare(b.variantLabel, 'es'),
    );
}

export type LevelRow = {
  variantId: string;
  onHand: number;
  reserved: number;
  reorderPoint: number | null;
};

export async function listLevels(
  supabase: Supabase,
  locationId: string,
): Promise<Map<string, LevelRow>> {
  const rows = await fetchAll((from, to) =>
    supabase
      .from('inventory_levels')
      .select('variant_id, on_hand, reserved, reorder_point')
      .eq('location_id', locationId)
      .order('variant_id')
      .range(from, to),
  );
  return new Map(
    rows.map((row) => [
      row.variant_id,
      {
        variantId: row.variant_id,
        onHand: row.on_hand,
        reserved: row.reserved,
        reorderPoint: row.reorder_point,
      },
    ]),
  );
}

/** Formatos activos que se pueden vender o devolver en la tienda. */
export function toCounterItems(
  directory: readonly VariantDirectoryRow[],
  levels: ReadonlyMap<string, LevelRow>,
): CounterItem[] {
  return directory
    .filter((row) => row.active)
    .map((row) => {
      const level = levels.get(row.variantId);
      return {
        variantId: row.variantId,
        productName: row.productName,
        brandName: row.brandName,
        variantLabel: row.variantLabel,
        sku: row.sku,
        ean: row.ean,
        priceCents: row.priceCents,
        available: level ? level.onHand - level.reserved : 0,
      };
    });
}

export function toWatchLevels(
  directory: readonly VariantDirectoryRow[],
  levels: ReadonlyMap<string, LevelRow>,
): WatchLevel[] {
  return directory.map((row) => {
    const level = levels.get(row.variantId);
    return {
      variantId: row.variantId,
      active: row.active,
      published: row.productStatus === 'published',
      onHand: level?.onHand ?? 0,
      reserved: level?.reserved ?? 0,
      reorderPoint: level?.reorderPoint ?? null,
    };
  });
}
