import { toCsv } from '@/lib/csv';
import { isAllowed } from '@/modules/auth';
import { requirePermission } from '@/modules/auth/server';
import { getDefaultLocation } from '@/modules/inventory/server';
import {
  closingCsvRows,
  currentMonth,
  hasActivity,
  monthPeriod,
} from '@/modules/reports';
import { getInventoryPeriod } from '@/modules/reports/server';

/** Cierre de existencias de un mes en CSV para la gestoría (Excel en español). */
export async function GET(request: Request) {
  const staff = await requirePermission('reports.view');
  const canCost = isAllowed(
    { role: staff.role, aal: 'aal2' },
    'pricing.view_cost',
  );
  const requested = new URL(request.url).searchParams.get('mes') ?? '';
  const month = monthPeriod(requested) ? requested : currentMonth(new Date());
  const period = monthPeriod(month)!;
  const location = await getDefaultLocation(staff.supabase);
  if (!location) return new Response('Sin ubicación activa', { status: 404 });
  const rows = (
    await getInventoryPeriod(staff.supabase, location.id, period)
  ).filter(hasActivity);
  return new Response(toCsv(closingCsvRows(rows, canCost)), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="existencias-${month}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
