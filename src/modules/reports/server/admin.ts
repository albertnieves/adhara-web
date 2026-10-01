import 'server-only';
import { fetchAll } from '@/lib/supabase/paginate';
import type { StaffContext } from '@/modules/auth/server';
import type { ClosingRow } from '../domain/closing-csv';
import type { PeriodCost } from '../domain/inventory-report';
import type { ReportPeriod } from '../domain/periods';

/*
 * Lecturas de informes. Los agregados se calculan en SQL con permiso
 * comprobado (reports.view; compras, purchasing.manage); los costes llegan
 * vacíos si la sesión no tiene pricing.view_cost.
 */

type Supabase = StaffContext['supabase'];

export type NamedVariant = {
  variantId: string;
  productId: string;
  productName: string;
  productStatus: string;
  brandId: string;
  brandName: string;
  variantLabel: string;
  sku: string | null;
  priceCents: number | null;
  active: boolean;
};

/** Todos los formatos, también de perfumes archivados (tienen historial). */
export async function listAllVariants(
  supabase: Supabase,
): Promise<Map<string, NamedVariant>> {
  const rows = await fetchAll((from, to) =>
    supabase
      .from('product_variants')
      .select(
        'id, label, size_ml, sku, retail_price_cents, active, product:products!inner(id, name, status, brand:brands!inner(id, name))',
      )
      .order('id')
      .range(from, to),
  );
  return new Map(
    rows.map((v) => [
      v.id,
      {
        variantId: v.id,
        productId: v.product.id,
        productName: v.product.name,
        productStatus: v.product.status,
        brandId: v.product.brand.id,
        brandName: v.product.brand.name,
        variantLabel: v.label?.trim() || (v.size_ml ? `${v.size_ml} ml` : '—'),
        sku: v.sku,
        priceCents: v.retail_price_cents,
        active: v.active,
      },
    ]),
  );
}

function cost(cents: number | null, isLater: boolean | null): PeriodCost {
  return cents === null ? null : { costNetCents: cents, isLater: !!isLater };
}

/** Existencias del periodo por formato, con nombres (para pantalla y CSV). */
export async function getInventoryPeriod(
  supabase: Supabase,
  locationId: string,
  period: Pick<ReportPeriod, 'from' | 'to'>,
): Promise<ClosingRow[]> {
  const [rows, variants] = await Promise.all([
    fetchAll((from, to) =>
      supabase
        .rpc('admin_report_inventory_period', {
          p_location_id: locationId,
          p_from: period.from,
          p_to: period.to,
        })
        .order('variant_id')
        .range(from, to),
    ),
    listAllVariants(supabase),
  ]);
  return rows.map((r) => {
    const v = variants.get(r.variant_id);
    return {
      variantId: r.variant_id,
      openingUnits: r.opening_units,
      receivedUnits: r.received_units,
      soldUnits: r.sold_units,
      returnedUnits: r.returned_units,
      lostUnits: r.lost_units,
      adjustedUnits: r.adjusted_units,
      transferredUnits: r.transferred_units,
      closingUnits: r.closing_units,
      lastSaleAt: r.last_sale_at ? new Date(r.last_sale_at) : null,
      openingCost: cost(r.opening_cost_net_cents, r.opening_cost_is_later),
      closingCost: cost(r.closing_cost_net_cents, r.closing_cost_is_later),
      brandName: v?.brandName ?? '—',
      productName: v?.productName ?? 'Formato borrado',
      variantLabel: v?.variantLabel ?? '—',
      sku: v?.sku ?? null,
    };
  });
}

export type SupplierPurchases = {
  supplierId: string;
  supplierName: string;
  supplierActive: boolean;
  declaredLeadTimeDays: number | null;
  ordersPlaced: number;
  unitsOrdered: number;
  receipts: number;
  unitsReceived: number;
  valueReceivedNetCents: number | null;
  unitsReceivedWithoutCost: number | null;
  ordersWithLead: number;
  avgLeadTimeDays: number | null;
  maxLeadTimeDays: number | null;
};

export async function getPurchasesReport(
  supabase: Supabase,
  period: Pick<ReportPeriod, 'from' | 'to'>,
): Promise<SupplierPurchases[]> {
  const rows = await fetchAll((from, to) =>
    supabase
      .rpc('admin_report_purchases', { p_from: period.from, p_to: period.to })
      .range(from, to),
  );
  return rows.map((r) => ({
    supplierId: r.supplier_id,
    supplierName: r.supplier_name,
    supplierActive: r.supplier_active,
    declaredLeadTimeDays: r.declared_lead_time_days,
    ordersPlaced: r.orders_placed,
    unitsOrdered: r.units_ordered,
    receipts: r.receipts,
    unitsReceived: r.units_received,
    valueReceivedNetCents: r.value_received_net_cents,
    unitsReceivedWithoutCost: r.units_received_without_cost,
    ordersWithLead: r.orders_with_lead,
    // numeric llega como número o texto según el cliente.
    avgLeadTimeDays:
      r.avg_lead_time_days === null ? null : Number(r.avg_lead_time_days),
    maxLeadTimeDays:
      r.max_lead_time_days === null ? null : Number(r.max_lead_time_days),
  }));
}

export type AuditEntry = {
  id: number;
  at: string;
  actorId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
};

export type AuditFilter = {
  action?: string;
  entity?: string;
  actorId?: string;
  from?: string;
  to?: string;
};

export const AUDIT_PAGE_SIZE = 50;

/** Registro de auditoría (RLS: solo staff.manage), del más reciente al más antiguo. */
export async function listAuditEntries(
  supabase: Supabase,
  filter: AuditFilter,
  page: number,
): Promise<{ entries: AuditEntry[]; hasMore: boolean }> {
  const start = page * AUDIT_PAGE_SIZE;
  let query = supabase
    .from('audit_log')
    .select('id, at, actor_id, action, entity, entity_id, before, after')
    .order('at', { ascending: false })
    .order('id', { ascending: false })
    .range(start, start + AUDIT_PAGE_SIZE);
  if (filter.action) query = query.like('action', `${filter.action}%`);
  if (filter.entity) query = query.eq('entity', filter.entity);
  if (filter.actorId) query = query.eq('actor_id', filter.actorId);
  if (filter.from) query = query.gte('at', filter.from);
  if (filter.to) query = query.lt('at', filter.to);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return {
    entries: data.slice(0, AUDIT_PAGE_SIZE).map((e) => ({
      id: e.id,
      at: e.at,
      actorId: e.actor_id,
      action: e.action,
      entity: e.entity,
      entityId: e.entity_id,
      before: e.before,
      after: e.after,
    })),
    hasMore: data.length > AUDIT_PAGE_SIZE,
  };
}

/** Nombre o email de cada persona del equipo (staff.manage), para la auditoría. */
export async function listStaffNames(
  supabase: Supabase,
): Promise<Map<string, string>> {
  const { data, error } = await supabase.rpc('admin_list_staff');
  if (error) throw new Error(error.message);
  return new Map(
    data.map((s) => [s.user_id, s.display_name?.trim() || s.email]),
  );
}
