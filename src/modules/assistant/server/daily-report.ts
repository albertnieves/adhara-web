import 'server-only';
import type { StaffContext } from '@/modules/auth/server';
import { listAdminProducts } from '@/modules/catalog/server/admin';
import {
  getDefaultLocation,
  getStockWatch,
  listMovements,
  listStock,
} from '@/modules/inventory/server';
import { dayRangePeriod } from '@/modules/reports';
import type { DailyReport } from '../domain/daily-report';
import { buildDailyReport } from '../domain/daily-report';

type Supabase = StaffContext['supabase'];

/** Movimientos de un día como máximo; una tienda física queda muy por debajo. */
const MAX_DAY_MOVEMENTS = 5000;

/**
 * Reúne los datos del día con el cliente recibido: la sesión del personal
 * (RLS y permisos) o, en la tarea programada, el cliente del servidor.
 */
export async function collectDailyReport(
  supabase: Supabase,
  day: string,
  now = new Date(),
): Promise<{ locationId: string; report: DailyReport } | null> {
  const period = dayRangePeriod(day, day);
  const location = await getDefaultLocation(supabase);
  if (!period || !location) return null;
  const [movements, stock, watch, orders, products] = await Promise.all([
    listMovements(supabase, {
      from: period.from,
      to: period.to,
      limit: MAX_DAY_MOVEMENTS,
    }),
    listStock(supabase, location.id),
    getStockWatch(supabase, location.id, now),
    supabase.rpc('admin_open_purchase_orders', {
      p_location_id: location.id,
    }),
    listAdminProducts(supabase, false),
  ]);
  if (orders.error) throw new Error(orders.error.message);
  const report = buildDailyReport({
    day,
    generatedAt: now,
    locationName: location.name,
    movements: movements.map((m) => ({
      variantId: m.variantId,
      type: m.type,
      deltaOnHand: m.deltaOnHand,
      reference: m.reference,
      product: m.productName,
      brand: m.brandName,
      variant: m.variantLabel,
    })),
    stock: stock.map((row) => ({
      variantId: row.variantId,
      active: row.active,
      onHand: row.onHand,
      reserved: row.reserved,
      reorderPoint: row.reorderPoint,
      product: row.productName,
      brand: row.brandName,
      variant: row.variantLabel,
    })),
    findings: watch.findings.map((f) => ({
      kind: f.kind,
      severity: f.severity,
      variantId: f.variantId,
      proposedUnits:
        f.proposal?.kind === 'reorder' ? f.proposal.quantity : null,
    })),
    openOrders: orders.data.map((o) => ({
      number: o.number,
      status: o.status,
      expectedOn: o.expected_on,
      unitsOrdered: o.units_ordered,
      unitsReceived: o.units_received,
    })),
    catalog: products.map((p) => ({
      status: p.status,
      hasImage: Boolean(p.heroUrl),
      missingTranslations: p.missingTranslations.length,
      activeVariants: p.variants.filter((v) => v.active).length,
      activeWithoutPrice: p.variants.filter(
        (v) => v.active && v.priceCents === null,
      ).length,
    })),
  });
  return { locationId: location.id, report };
}
