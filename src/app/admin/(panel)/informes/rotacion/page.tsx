import type { Metadata } from 'next';
import Link from 'next/link';
import { formatEuros } from '@/lib/money';
import { PageHeader } from '@/modules/admin';
import { isAllowed } from '@/modules/auth';
import { requirePermission } from '@/modules/auth/server';
import { getDefaultLocation } from '@/modules/inventory/server';
import {
  hasActivity,
  lastDaysPeriod,
  rotation,
  valueAtCost,
} from '@/modules/reports';
import { getInventoryPeriod } from '@/modules/reports/server';

export const metadata: Metadata = { title: 'Rotación e inmovilizado' };

const WINDOWS = [30, 90, 180, 365] as const;
const TOP = 25;

const ONE_DECIMAL = new Intl.NumberFormat('es-ES', {
  maximumFractionDigits: 1,
});

export default async function RotationReport({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string }>;
}) {
  const staff = await requirePermission('reports.view');
  const canCost = isAllowed(
    { role: staff.role, aal: 'aal2' },
    'pricing.view_cost',
  );
  const { dias } = await searchParams;
  const days =
    WINDOWS.find((w) => String(w) === dias) ?? (90 as (typeof WINDOWS)[number]);
  const now = new Date();
  const period = lastDaysPeriod(days, now);
  const location = await getDefaultLocation(staff.supabase);
  if (!location) {
    return (
      <main>
        <PageHeader eyebrow="Informes" title="Rotación e inmovilizado" />
        <p className="text-smoke">No hay ninguna ubicación activa.</p>
      </main>
    );
  }
  const rows = (await getInventoryPeriod(staff.supabase, location.id, period))
    .filter(hasActivity)
    .map((row) => ({ ...row, rotation: rotation(row, period.days, now) }));
  const sellers = rows
    .filter((r) => r.soldUnits > 0)
    .sort(
      (a, b) =>
        b.soldUnits - a.soldUnits ||
        a.productName.localeCompare(b.productName, 'es'),
    );
  const idle = rows
    .filter((r) => r.soldUnits === 0 && r.closingUnits > 0)
    .map((r) => ({
      ...r,
      value: valueAtCost(r.closingUnits, r.closingCost),
    }))
    .sort(
      (a, b) =>
        (b.value ?? -1) - (a.value ?? -1) ||
        b.closingUnits - a.closingUnits ||
        a.productName.localeCompare(b.productName, 'es'),
    );
  const idleUnits = idle.reduce((sum, r) => sum + r.closingUnits, 0);
  const idleValue = idle.reduce((sum, r) => sum + (r.value ?? 0), 0);
  const name = (r: (typeof rows)[number]) =>
    `${r.brandName} · ${r.productName} · ${r.variantLabel}`;

  return (
    <main>
      <PageHeader eyebrow={`Informes · ${location.name}`} title="Rotación">
        <nav className="flex flex-wrap gap-2" aria-label="Periodo">
          {WINDOWS.map((w) => (
            <Link
              key={w}
              href={`/admin/informes/rotacion?dias=${w}`}
              aria-current={w === days ? 'page' : undefined}
              className={`tracking-caps-sm border px-3 py-2 text-xs uppercase ${w === days ? 'border-ink bg-ink text-ivory' : 'border-line hover:border-ink'}`}
            >
              {w} días
            </Link>
          ))}
        </nav>
      </PageHeader>
      <p className="text-smoke mb-10 max-w-3xl text-sm leading-relaxed">
        Últimos {days} días (del{' '}
        {period.firstDay.split('-').reverse().join('/')} a hoy). Rotación:
        unidades vendidas entre el stock medio del periodo (media de inicio y
        final). Cobertura: días que duran las existencias de hoy al ritmo de
        venta del periodo.
      </p>

      <section>
        <h2 className="mb-4 text-2xl font-light">
          Más vendidos · {sellers.length}
        </h2>
        {sellers.length === 0 ? (
          <p className="text-smoke text-sm">Sin ventas en el periodo.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table min-w-[40rem]">
              <thead>
                <tr>
                  <th>Perfume</th>
                  <th className="text-right">Vendidas</th>
                  <th className="text-right">Stock medio</th>
                  <th className="text-right">Rotación</th>
                  <th className="text-right">Hoy</th>
                  <th className="text-right">Cobertura</th>
                </tr>
              </thead>
              <tbody>
                {sellers.slice(0, TOP).map((r) => (
                  <tr key={r.variantId}>
                    <td className="text-sm">{name(r)}</td>
                    <td className="text-right font-semibold tabular-nums">
                      {r.soldUnits}
                    </td>
                    <td className="text-smoke text-right tabular-nums">
                      {ONE_DECIMAL.format(r.rotation.averageStock)}
                    </td>
                    <td className="text-right tabular-nums">
                      {r.rotation.turnover === null
                        ? '—'
                        : `${ONE_DECIMAL.format(r.rotation.turnover)}×`}
                    </td>
                    <td className="text-right tabular-nums">
                      {r.closingUnits}
                    </td>
                    <td
                      className={`text-right tabular-nums ${r.rotation.coverDays !== null && r.rotation.coverDays < 14 ? 'text-danger' : ''}`}
                    >
                      {r.rotation.coverDays === null
                        ? '—'
                        : `${r.rotation.coverDays} d`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {sellers.length > TOP && (
          <p className="text-smoke mt-3 text-sm">
            Se muestran los {TOP} primeros de {sellers.length}.
          </p>
        )}
      </section>

      <section className="mt-14">
        <h2 className="mb-2 text-2xl font-light">
          Sin ventas en el periodo · {idle.length}
        </h2>
        <p className="text-smoke mb-4 text-sm">
          {idleUnits} uds. en tienda
          {canCost && ` · ${formatEuros(idleValue, 'es')} a coste`} que no se
          han vendido en {days} días.
        </p>
        {idle.length > 0 && (
          <div className="overflow-x-auto">
            <table className="data-table min-w-[36rem]">
              <thead>
                <tr>
                  <th>Perfume</th>
                  <th className="text-right">En tienda</th>
                  {canCost && <th className="text-right">Valor a coste</th>}
                  <th className="text-right">Última venta</th>
                </tr>
              </thead>
              <tbody>
                {idle.map((r) => (
                  <tr key={r.variantId}>
                    <td className="text-sm">{name(r)}</td>
                    <td className="text-right tabular-nums">
                      {r.closingUnits}
                    </td>
                    {canCost && (
                      <td className="text-right tabular-nums">
                        {r.value === null
                          ? 'sin coste'
                          : formatEuros(r.value, 'es')}
                      </td>
                    )}
                    <td className="text-smoke text-right tabular-nums">
                      {r.rotation.daysSinceSale === null
                        ? 'nunca'
                        : `hace ${r.rotation.daysSinceSale} d`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
