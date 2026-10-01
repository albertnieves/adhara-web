import 'server-only';
import { fetchAll } from '@/lib/supabase/paginate';
import type { StaffContext } from '@/modules/auth/server';
import type { PurchaseOrderStatus } from '../domain/orders';
import { isPurchaseOrderStatus } from '../domain/orders';

/*
 * Lecturas de compras. Proveedores y pedidos viven en `internal`, fuera de la
 * API: solo se leen con funciones que exigen purchasing.manage con MFA. El
 * coste unitario llega vacío si la sesión no tiene pricing.view_cost.
 */

type Supabase = StaffContext['supabase'];

export type Supplier = {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  leadTimeDays: number | null;
  notes: string | null;
  active: boolean;
  variantCount: number;
  openOrders: number;
};

export async function listSuppliers(supabase: Supabase): Promise<Supplier[]> {
  const rows = await fetchAll((from, to) =>
    supabase.rpc('admin_list_suppliers').range(from, to),
  );
  return rows.map((s) => ({
    id: s.id,
    name: s.name,
    contactName: s.contact_name,
    email: s.email,
    phone: s.phone,
    leadTimeDays: s.lead_time_days,
    notes: s.notes,
    active: s.active,
    variantCount: s.variant_count,
    openOrders: s.open_orders,
  }));
}

export type SupplierTerm = {
  supplierId: string;
  supplierName: string;
  supplierActive: boolean;
  variantId: string;
  supplierSku: string | null;
  packSize: number;
  leadTimeDays: number | null;
  effectiveLeadTimeDays: number | null;
  preferred: boolean;
};

export async function listSupplierTerms(
  supabase: Supabase,
  filter: { supplierId?: string; variantIds?: string[] },
): Promise<SupplierTerm[]> {
  const rows = await fetchAll((from, to) =>
    supabase
      .rpc('admin_supplier_terms', {
        p_supplier_id: filter.supplierId,
        p_variant_ids: filter.variantIds,
      })
      .order('variant_id')
      .order('supplier_id')
      .range(from, to),
  );
  return rows.map((t) => ({
    supplierId: t.supplier_id,
    supplierName: t.supplier_name,
    supplierActive: t.supplier_active,
    variantId: t.variant_id,
    supplierSku: t.supplier_sku,
    packSize: t.pack_size,
    leadTimeDays: t.lead_time_days,
    effectiveLeadTimeDays: t.effective_lead_time_days,
    preferred: t.preferred,
  }));
}

/**
 * Proveedor con el que se repone cada formato: el preferente activo o, si
 * no hay, el único activo. Con varios y ninguno preferente, decide una persona.
 */
export function replenishmentSupplier(
  terms: readonly SupplierTerm[],
): Map<string, SupplierTerm> {
  const byVariant = new Map<string, SupplierTerm[]>();
  for (const term of terms) {
    if (!term.supplierActive) continue;
    byVariant.set(term.variantId, [
      ...(byVariant.get(term.variantId) ?? []),
      term,
    ]);
  }
  const chosen = new Map<string, SupplierTerm>();
  for (const [variantId, options] of byVariant) {
    const pick =
      options.find((term) => term.preferred) ??
      (options.length === 1 ? options[0] : undefined);
    if (pick) chosen.set(variantId, pick);
  }
  return chosen;
}

export type PurchaseOrderRow = {
  id: string;
  number: string;
  supplierId: string;
  supplierName: string;
  locationId: string;
  locationName: string;
  status: PurchaseOrderStatus;
  expectedOn: string | null;
  supplierReference: string | null;
  notes: string | null;
  revision: number;
  createdAt: string;
  orderedAt: string | null;
  closedAt: string | null;
  lineCount: number;
  unitsOrdered: number;
  unitsReceived: number;
  totalCostNetCents: number | null;
};

export async function listPurchaseOrders(
  supabase: Supabase,
  filter: { status?: PurchaseOrderStatus; orderId?: string } = {},
): Promise<PurchaseOrderRow[]> {
  const rows = await fetchAll((from, to) =>
    supabase
      .rpc('admin_list_purchase_orders', {
        p_status: filter.status,
        p_order_id: filter.orderId,
      })
      .range(from, to),
  );
  return rows.map((o) => ({
    id: o.id,
    number: o.number,
    supplierId: o.supplier_id,
    supplierName: o.supplier_name,
    locationId: o.location_id,
    locationName: o.location_name,
    status: isPurchaseOrderStatus(o.status) ? o.status : 'draft',
    expectedOn: o.expected_on,
    supplierReference: o.supplier_reference,
    notes: o.notes,
    revision: o.revision,
    createdAt: o.created_at,
    orderedAt: o.ordered_at,
    closedAt: o.closed_at,
    lineCount: o.line_count,
    unitsOrdered: o.units_ordered,
    unitsReceived: o.units_received,
    totalCostNetCents: o.total_cost_net_cents,
  }));
}

export type PurchaseOrderLine = {
  lineId: number;
  variantId: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitCostNetCents: number | null;
  supplierSku: string | null;
  packSize: number | null;
};

export type PurchaseReceipt = {
  id: number;
  reference: string | null;
  units: number;
  costsRecorded: number;
  actorName: string | null;
  at: string;
};

export async function getPurchaseOrder(supabase: Supabase, orderId: string) {
  const [orders, lines, receipts] = await Promise.all([
    listPurchaseOrders(supabase, { orderId }),
    supabase.rpc('admin_purchase_order_lines', { p_order_id: orderId }),
    supabase.rpc('admin_purchase_order_receipts', { p_order_id: orderId }),
  ]);
  if (lines.error) throw new Error(lines.error.message);
  if (receipts.error) throw new Error(receipts.error.message);
  const order = orders[0];
  if (!order) return null;
  return {
    order,
    lines: lines.data.map((l): PurchaseOrderLine => ({
      lineId: l.line_id,
      variantId: l.variant_id,
      quantityOrdered: l.quantity_ordered,
      quantityReceived: l.quantity_received,
      unitCostNetCents: l.unit_cost_net_cents,
      supplierSku: l.supplier_sku,
      packSize: l.pack_size,
    })),
    receipts: receipts.data.map((r): PurchaseReceipt => ({
      id: r.receipt_id,
      reference: r.reference,
      units: r.units,
      costsRecorded: r.costs_recorded,
      actorName: r.actor_name,
      at: r.at,
    })),
  };
}
