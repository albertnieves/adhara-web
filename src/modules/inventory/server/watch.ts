import 'server-only';
import { fetchAll } from '@/lib/supabase/paginate';
import type { StaffContext } from '@/modules/auth/server';
import type { StockFinding } from '../domain/stock-watch';
import { watchStock } from '../domain/stock-watch';
import type { StockWatchSettings, WatchFacts } from '../domain/watch-snapshot';
import { buildStockSnapshots } from '../domain/watch-snapshot';
import type { LevelRow, VariantDirectoryRow } from './directory';
import { listLevels, listVariantDirectory, toWatchLevels } from './directory';

/*
 * Vigilante de stock (A4.1) calculado al abrir Reposición, con la sesión de
 * quien mira: sin tarea programada ni clave secreta. Solo lee y propone.
 */

type Supabase = StaffContext['supabase'];

export type WatchSettingsRow = StockWatchSettings & { updatedAt: string };

export async function getWatchSettings(
  supabase: Supabase,
): Promise<WatchSettingsRow> {
  const { data, error } = await supabase
    .from('stock_watch_settings')
    .select(
      'sales_window_days, target_cover_days, safety_days, dead_stock_days, updated_at',
    )
    .single();
  if (error) throw new Error(error.message);
  return {
    salesWindowDays: data.sales_window_days,
    targetCoverDays: data.target_cover_days,
    safetyDays: data.safety_days,
    deadStockDays: data.dead_stock_days,
    updatedAt: data.updated_at,
  };
}

export async function listWatchFacts(
  supabase: Supabase,
  locationId: string,
): Promise<Map<string, WatchFacts>> {
  const rows = await fetchAll((from, to) =>
    supabase
      .rpc('admin_stock_watch_facts', { p_location_id: locationId })
      .order('variant_id')
      .range(from, to),
  );
  const date = (value: string | null) => (value ? new Date(value) : null);
  return new Map(
    rows.map((row) => [
      row.variant_id,
      {
        variantId: row.variant_id,
        unitsSold: row.units_sold,
        lastSaleAt: date(row.last_sale_at),
        firstStockedAt: date(row.first_stocked_at),
        ledgerOnHand: row.ledger_on_hand,
        ledgerReserved: row.ledger_reserved,
        leadTimeDays: row.lead_time_days,
        packSize: row.pack_size,
        incomingUnits: row.incoming_units,
        hasSupplier: row.has_supplier,
      },
    ]),
  );
}

export type StockWatchView = {
  settings: WatchSettingsRow;
  findings: StockFinding[];
  directory: Map<string, VariantDirectoryRow>;
  facts: Map<string, WatchFacts>;
  levels: Map<string, LevelRow>;
};

export async function getStockWatch(
  supabase: Supabase,
  locationId: string,
  now = new Date(),
): Promise<StockWatchView> {
  const [settings, directory, levels, facts] = await Promise.all([
    getWatchSettings(supabase),
    listVariantDirectory(supabase),
    listLevels(supabase, locationId),
    listWatchFacts(supabase, locationId),
  ]);
  const snapshots = buildStockSnapshots(
    toWatchLevels(directory, levels),
    facts,
    locationId,
    settings.salesWindowDays,
  );
  return {
    settings,
    findings: watchStock(snapshots, settings, now),
    directory: new Map(directory.map((row) => [row.variantId, row])),
    facts,
    levels,
  };
}
