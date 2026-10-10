import 'server-only';
import type { StaffContext } from '@/modules/auth/server';

type Supabase = StaffContext['supabase'];

export type StoreSaleRow = {
  id: number;
  kind: 'sale' | 'return';
  ticketRef: string | null;
  units: number;
  /** Importe con IVA; null en las ventas sin precio cobrado (anteriores a DECISIONS §114). */
  amountCents: number | null;
  createdAt: string;
  lines: { label: string; quantity: number }[];
};

/** Últimas ventas y devoluciones de mostrador de la ubicación (lectura con RLS). */
export async function listRecentStoreSales(
  supabase: Supabase,
  locationId: string,
  limit = 12,
): Promise<StoreSaleRow[]> {
  const { data, error } = await supabase
    .from('store_sales')
    .select(
      'id, kind, ticket_ref, units, created_at, lines:store_sale_lines(quantity, unit_price_cents, variant:product_variants!inner(label, size_ml, product:products!inner(name, brand:brands!inner(name))))',
    )
    .eq('location_id', locationId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data.map((sale) => ({
    id: sale.id,
    kind: sale.kind === 'return' ? 'return' : 'sale',
    ticketRef: sale.ticket_ref,
    units: sale.units,
    amountCents: sale.lines.every((line) => line.unit_price_cents !== null)
      ? sale.lines.reduce(
          (sum, line) => sum + (line.unit_price_cents ?? 0) * line.quantity,
          0,
        )
      : null,
    createdAt: sale.created_at,
    lines: sale.lines.map((line) => ({
      quantity: line.quantity,
      label: `${line.variant.product.brand.name} ${line.variant.product.name} · ${
        line.variant.label?.trim() ||
        (line.variant.size_ml ? `${line.variant.size_ml} ml` : '—')
      }`,
    })),
  }));
}
