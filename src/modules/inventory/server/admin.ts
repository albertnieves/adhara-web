import 'server-only';
import type { StaffContext } from '@/modules/auth/server';

type Supabase = StaffContext['supabase'];

export type StockRow = {
  variantId: string;
  productId: string;
  productName: string;
  brandName: string;
  variantLabel: string;
  sku: string | null;
  active: boolean;
  onHand: number;
  reserved: number;
  reorderPoint: number | null;
};

/** Ubicación de trabajo: por ahora la tienda física (única ubicación activa). */
export async function getDefaultLocation(supabase: Supabase) {
  const { data, error } = await supabase
    .from('stock_locations')
    .select('id, code, name')
    .eq('active', true)
    .order('created_at')
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function listStock(
  supabase: Supabase,
  locationId: string,
): Promise<StockRow[]> {
  const [variants, levels] = await Promise.all([
    supabase
      .from('product_variants')
      .select(
        'id, label, size_ml, sku, active, position, product:products!inner(id, name, status, brand:brands!inner(name))',
      )
      .neq('product.status', 'archived'),
    supabase
      .from('inventory_levels')
      .select('variant_id, on_hand, reserved, reorder_point')
      .eq('location_id', locationId),
  ]);
  if (variants.error) throw new Error(variants.error.message);
  if (levels.error) throw new Error(levels.error.message);
  const byVariant = new Map(levels.data.map((l) => [l.variant_id, l]));
  return variants.data
    .map((v) => {
      const level = byVariant.get(v.id);
      return {
        variantId: v.id,
        productId: v.product.id,
        productName: v.product.name,
        brandName: v.product.brand.name,
        variantLabel: v.label?.trim() || (v.size_ml ? `${v.size_ml} ml` : '—'),
        sku: v.sku,
        active: v.active,
        onHand: level?.on_hand ?? 0,
        reserved: level?.reserved ?? 0,
        reorderPoint: level?.reorder_point ?? null,
      };
    })
    .sort(
      (a, b) =>
        a.brandName.localeCompare(b.brandName, 'es') ||
        a.productName.localeCompare(b.productName, 'es') ||
        a.variantLabel.localeCompare(b.variantLabel, 'es'),
    );
}

export type MovementRow = {
  id: number;
  createdAt: string;
  type: string;
  quantity: number;
  deltaOnHand: number;
  onHandAfter: number;
  reason: string | null;
  reference: string | null;
  productName: string;
  brandName: string;
  variantLabel: string;
};

export async function listMovements(
  supabase: Supabase,
  { limit = 100, variantId }: { limit?: number; variantId?: string } = {},
): Promise<MovementRow[]> {
  let query = supabase
    .from('inventory_movements')
    .select(
      'id, created_at, type, quantity, delta_on_hand, on_hand_after, reason, reference, variant:product_variants!inner(label, size_ml, product:products!inner(name, brand:brands!inner(name)))',
    )
    .order('created_at', { ascending: false })
    .limit(limit);
  if (variantId) query = query.eq('variant_id', variantId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data.map((m) => ({
    id: m.id,
    createdAt: m.created_at,
    type: m.type,
    quantity: m.quantity,
    deltaOnHand: m.delta_on_hand,
    onHandAfter: m.on_hand_after,
    reason: m.reason,
    reference: m.reference,
    productName: m.variant.product.name,
    brandName: m.variant.product.brand.name,
    variantLabel:
      m.variant.label?.trim() ||
      (m.variant.size_ml ? `${m.variant.size_ml} ml` : '—'),
  }));
}
