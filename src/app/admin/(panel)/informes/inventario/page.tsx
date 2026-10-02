import type { Metadata } from 'next';
import Link from 'next/link';
import { formatEuros } from '@/lib/money';
import { PageHeader } from '@/modules/admin';
import { isAllowed } from '@/modules/auth';
import { requirePermission } from '@/modules/auth/server';
import { getDefaultLocation } from '@/modules/inventory/server';
import type { ValuationTotals } from '@/modules/reports';
import {
  balances,
  currentMonth,
  hasActivity,
  monthLabel,
  monthPeriod,
  shiftMonth,
  summarize,
} from '@/modules/reports';
import { getInventoryPeriod } from '@/modules/reports/server';

export const metadata: Metadata = { title: 'Existencias y cierre' };

function Value({
  totals,
  canCost,
}: {
  totals: ValuationTotals;
  canCost: boolean;
}) {
  if (!canCost) return null;
  return (
    <p className="text-smoke mt-2 text-xs">
      {totals.units > 0 && totals.unitsWithoutCost === totals.units
        ? 'Sin coste registrado'
        : `${formatEuros(totals.valueCents, 'es')} a coste`}
      {totals.unitsWithoutCost > 0 &&
        ` · ${totals.unitsWithoutCost} uds. sin coste no suman`}
    </p>
  );
}

export default async function InventoryReport({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const staff = await requirePermission('reports.view');
  const canCost = isAllowed(
    { role: staff.role, aal: 'aal2' },
    'pricing.view_cost',
  );
  const now = new Date();
  const { mes } = await searchParams;
  const thisMonth = currentMonth(now);
  const month = mes && monthPeriod(mes) && mes <= thisMonth ? mes : thisMonth;
  const period = monthPeriod(month)!;
  const location = await getDefaultLocation(staff.supabase);
  if (!location) {
    return (
      <main>
        <PageHeader eyebrow="Informes" title="Existencias y cierre" />
        <p className="text-smoke">No hay ninguna ubicación activa.</p>
      </main>
    );
  }
  const rows = (
    await getInventoryPeriod(staff.supabase, location.id, period)
  ).filter(hasActivity);
  const { groups, total } = summarize(rows, (r) => ({
    key: r.brandName,
    label: r.brandName,
  }));
  const unbalanced = rows.filter((r) => !balances(r));
  const open = month === thisMonth;

  const stats = [
    {
      label: 'Existencias iniciales',
      units: total.openingUnits,
      totals: total.opening,
    },
    { label: 'Entradas', units: total.receivedUnits },
    { label: 'Ventas', units: total.soldUnits },
    {
      label: open ? 'Existencias hoy' : 'Existencias finales',
      units: total.closingUnits,
      totals: total.closing,
    },
  ];

  return (
    <main>
      <PageHeader
        eyebrow={`Informes · ${location.name}`}
        title={monthLabel(month)}
      >
        <Link
          href={`/admin/informes/inventario?mes=${shiftMonth(month, -1)}`}
          className="border-line hover:border-ink inline-flex min-h-11 items-center border px-4 text-xs font-semibold tracking-[0.18em] uppercase"
        >
          ← Anterior
        </Link>
        {!open && (
          <Link
            href={`/admin/informes/inventario?mes=${shiftMonth(month, 1)}`}
            className="border-line hover:border-ink inline-flex min-h-11 items-center border px-4 text-xs font-semibold tracking-[0.18em] uppercase"
          >
            Siguiente →
          </Link>
        )}
        <a
          href={`/admin/informes/inventario/exportar?mes=${month}`}
          className="bg-ink text-ivory hover:bg-ink-soft inline-flex min-h-11 items-center px-5 text-xs font-semibold tracking-[0.18em] uppercase transition-colors"
        >
          CSV para la gestoría
        </a>
      </PageHeader>

      <p className="text-smoke mb-8 max-w-3xl text-sm leading-relaxed">
        Del {period.firstDay.split('-').reverse().join('/')} al{' '}
        {period.lastDay.split('-').reverse().join('/')}
        {open && ' (mes en curso: las finales son las de hoy)'}. Iniciales +
        entradas − ventas + devoluciones − mermas ± ajustes − traslados =
        finales.
        {canCost &&
          ' Valor al último coste neto registrado en cada fecha; si un formato no tenía coste todavía, se usa el primero registrado después y se indica.'}
      </p>

      {unbalanced.length > 0 && (
        <p role="alert" className="text-danger mb-8 text-sm">
          {unbalanced.length} formatos no cuadran con sus movimientos. Revisa
          Reposición (niveles que no cuadran) antes de enviar el cierre.
        </p>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="panel-card">
            <p className="eyebrow">{stat.label}</p>
            <p className="font-display mt-3 text-5xl font-light lining-nums tabular-nums">
              {stat.units}
            </p>
            {stat.totals && <Value totals={stat.totals} canCost={canCost} />}
          </div>
        ))}
      </section>

      {canCost && total.closing.unitsWithLaterCost > 0 && (
        <p className="text-smoke mt-6 text-sm">
          {total.closing.unitsWithLaterCost} uds. finales se valoran con un
          coste registrado después del cierre (no había coste a esa fecha).
        </p>
      )}

      {groups.length === 0 ? (
        <p className="text-smoke py-16 text-center">
          No hay existencias ni movimientos en este mes.
        </p>
      ) : (
        <section className="mt-12">
          <h2 className="mb-4 text-2xl font-light">Por marca</h2>
          <div className="overflow-x-auto">
            <table className="data-table min-w-[44rem]">
              <thead>
                <tr>
                  <th>Marca</th>
                  <th className="text-right">Iniciales</th>
                  <th className="text-right">Entradas</th>
                  <th className="text-right">Ventas</th>
                  <th className="text-right">Mermas</th>
                  <th className="text-right">Ajustes</th>
                  <th className="text-right">Finales</th>
                  {canCost && <th className="text-right">Valor final</th>}
                </tr>
              </thead>
              <tbody>
                {[...groups, total].map((g) => (
                  <tr
                    key={g.key}
                    className={g.key === 'total' ? 'font-semibold' : ''}
                  >
                    <td className="text-sm">
                      {g.label}
                      {g.key !== 'total' && (
                        <span className="text-smoke text-xs">
                          {' '}
                          · {g.formats}{' '}
                          {g.formats === 1 ? 'formato' : 'formatos'}
                        </span>
                      )}
                    </td>
                    <td className="text-right tabular-nums">
                      {g.openingUnits}
                    </td>
                    <td className="text-right tabular-nums">
                      {g.receivedUnits}
                    </td>
                    <td className="text-right tabular-nums">{g.soldUnits}</td>
                    <td className="text-right tabular-nums">{g.lostUnits}</td>
                    <td className="text-right tabular-nums">
                      {g.adjustedUnits > 0 ? '+' : ''}
                      {g.adjustedUnits}
                    </td>
                    <td className="text-right tabular-nums">
                      {g.closingUnits}
                    </td>
                    {canCost && (
                      <td className="text-right tabular-nums">
                        {g.closing.units > 0 &&
                        g.closing.unitsWithoutCost === g.closing.units
                          ? '—'
                          : formatEuros(g.closing.valueCents, 'es')}
                        {g.closing.unitsWithoutCost > 0 && (
                          <p className="text-danger text-xs font-normal">
                            {g.closing.unitsWithoutCost} uds. sin coste
                          </p>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
