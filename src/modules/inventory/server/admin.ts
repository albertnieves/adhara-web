import 'server-only';
import { fetchAll } from '@/lib/supabase/paginate';
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
  { productId }: { productId?: string } = {},
): Promise<StockRow[]> {
  const [variants, levels] = await Promise.all([
    fetchAll((from, to) => {
      let query = supabase
        .from('product_variants')
        .select(
          'id, label, size_ml, sku, active, position, product:products!inner(id, name, status, brand:brands!inner(name))',
        )
        .neq('product.status', 'archived')
        .order('id');
      if (productId) query = query.eq('product_id', productId);
      return query.range(from, to);
    }),
    fetchAll((from, to) =>
      supabase
        .from('inventory_levels')
        .select('variant_id, on_hand, reserved, reorder_point')
        .eq('location_id', locationId)
        .order('variant_id')
        .range(from, to),
    ),
  ]);
  const byVariant = new Map(levels.map((l) => [l.variant_id, l]));
  return variants
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
  variantId: string;
  type: string;
  quantity: number;
  deltaOnHand: number;
  onHandAfter: number;
  reason: string | null;
  reference: string | null;
  productId: string;
  productName: string;
  brandName: string;
  variantLabel: string;
  sku: string | null;
};

export type MovementFilter = {
  limit?: number;
  variantId?: string;
  productId?: string;
  type?: string;
  /** Fechas ISO (inclusive desde, exclusiva hasta). */
  from?: string;
  to?: string;
};

/** PostgREST de Supabase devuelve como mucho 1000 filas por petición. */
const PAGE = 1000;

export async function listMovements(
  supabase: Supabase,
  { limit = 100, variantId, productId, type, from, to }: MovementFilter = {},
): Promise<MovementRow[]> {
  const page = async (start: number, end: number) => {
    let query = supabase
      .from('inventory_movements')
      .select(
        'id, created_at, type, quantity, delta_on_hand, on_hand_after, reason, reference, variant_id, variant:product_variants!inner(label, size_ml, sku, product_id, product:products!inner(name, brand:brands!inner(name)))',
      )
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(start, end);
    if (variantId) query = query.eq('variant_id', variantId);
    if (productId) query = query.eq('variant.product_id', productId);
    if (type) query = query.eq('type', type);
    if (from) query = query.gte('created_at', from);
    if (to) query = query.lt('created_at', to);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data;
  };
  const data: Awaited<ReturnType<typeof page>> = [];
  for (let start = 0; start < limit; start += PAGE) {
    const end = Math.min(start + PAGE, limit) - 1;
    const rows = await page(start, end);
    data.push(...rows);
    if (rows.length < end - start + 1) break;
  }
  return data.map((m) => ({
    id: m.id,
    createdAt: m.created_at,
    variantId: m.variant_id,
    type: m.type,
    quantity: m.quantity,
    deltaOnHand: m.delta_on_hand,
    onHandAfter: m.on_hand_after,
    reason: m.reason,
    reference: m.reference,
    productId: m.variant.product_id,
    productName: m.variant.product.name,
    brandName: m.variant.product.brand.name,
    sku: m.variant.sku,
    variantLabel:
      m.variant.label?.trim() ||
      (m.variant.size_ml ? `${m.variant.size_ml} ml` : '—'),
  }));
}
