import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatEuros } from '@/lib/money';
import { PageHeader } from '@/modules/admin';
import { isAllowed } from '@/modules/auth';
import { requirePermission } from '@/modules/auth/server';
import type { LeadTimeCheck } from '@/modules/reports';
import {
  LEAD_TIME_TOLERANCE_DAYS,
  checkLeadTime,
  dayRangePeriod,
  lastDaysPeriod,
} from '@/modules/reports';
import { getPurchasesReport } from '@/modules/reports/server';

export const metadata: Metadata = { title: 'Compras por proveedor' };

const DAYS = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });

function LeadTime({ check }: { check: LeadTimeCheck }) {
  switch (check.kind) {
    case 'no_data':
      return <span className="text-smoke">Sin recepciones</span>;
    case 'no_declared':
      return (
        <span>
          {DAYS.format(check.realDays)} d
          <span className="text-warning block text-xs">
            Sin plazo declarado: anótalo en el proveedor
          </span>
        </span>
      );
    default:
      return (
        <span
          className={
            check.kind === 'slower'
              ? 'text-danger'
              : check.kind === 'faster'
                ? 'text-accent-fg'
                : ''
          }
        >
          {DAYS.format(check.realDays)} d
          <span className="text-smoke block text-xs">
            declarado {check.declaredDays} d
            {check.kind === 'slower' && ' · tarda más'}
            {check.kind === 'faster' && ' · llega antes'}
          </span>
        </span>
      );
  }
}

export default async function PurchasesReport({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const staff = await requirePermission('purchasing.manage');
  const can = (p: Parameters<typeof isAllowed>[1]) =>
    isAllowed({ role: staff.role, aal: 'aal2' }, p);
  if (!can('reports.view')) notFound();
  const canCost = can('pricing.view_cost');
  const { desde = '', hasta = '' } = await searchParams;
  const period =
    (desde && hasta ? dayRangePeriod(desde, hasta) : null) ??
    lastDaysPeriod(90, new Date());
  const suppliers = await getPurchasesReport(staff.supabase, period);

  return (
    <main>
      <PageHeader eyebrow="Informes" title="Compras por proveedor" />
      <form className="border-line mb-8 flex flex-wrap items-end gap-x-6 gap-y-4 border-y py-5">
        <label className="flex flex-col gap-2">
          <span className="eyebrow">Desde</span>
          <input
            type="date"
            name="desde"
            defaultValue={period.firstDay}
            className="input"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="eyebrow">Hasta</span>
          <input
            type="date"
            name="hasta"
            defaultValue={period.lastDay}
            className="input"
          />
        </label>
        <button
          type="submit"
          className="border-line hover:border-ink tracking-caps inline-flex min-h-11 items-center border px-5 text-xs font-semibold uppercase"
        >
          Ver
        </button>
      </form>
      <p className="text-smoke mb-8 max-w-3xl text-sm leading-relaxed">
        Pedidos enviados y recepciones del periodo. Plazo real: de la fecha en
        que se marcó como pedido a su primera recepción, en los pedidos cuya
        primera recepción cae en el periodo. Si difiere del declarado en más de{' '}
        {LEAD_TIME_TOLERANCE_DAYS} día, conviene corregirlo en el proveedor: es
        el que usa Reposición para proponer cantidades.
      </p>

      {suppliers.length === 0 ? (
        <p className="text-smoke py-16 text-center">
          No hay proveedores ni compras en el periodo.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table min-w-[44rem]">
            <thead>
              <tr>
                <th>Proveedor</th>
                <th className="text-right">Pedidos</th>
                <th className="text-right">Uds. pedidas</th>
                <th className="text-right">Uds. recibidas</th>
                {canCost && <th className="text-right">Recibido a coste</th>}
                <th className="text-right">Plazo real</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.supplierId} className="align-top">
                  <td className="text-sm">
                    <Link
                      href={`/admin/compras/proveedores/${s.supplierId}`}
                      className="link-underline"
                    >
                      {s.supplierName}
                    </Link>
                    {!s.supplierActive && (
                      <p className="text-fg-muted text-xs">inactivo</p>
                    )}
                  </td>
                  <td className="text-right tabular-nums">{s.ordersPlaced}</td>
                  <td className="text-right tabular-nums">{s.unitsOrdered}</td>
                  <td className="text-right tabular-nums">
                    {s.unitsReceived}
                    {s.receipts > 0 && (
                      <p className="text-smoke text-xs">
                        {s.receipts}{' '}
                        {s.receipts === 1 ? 'recepción' : 'recepciones'}
                      </p>
                    )}
                  </td>
                  {canCost && (
                    <td className="text-right tabular-nums">
                      {s.valueReceivedNetCents === null
                        ? '—'
                        : formatEuros(s.valueReceivedNetCents, 'es')}
                      {!!s.unitsReceivedWithoutCost && (
                        <p className="text-danger text-xs">
                          {s.unitsReceivedWithoutCost} uds. sin coste
                        </p>
                      )}
                    </td>
                  )}
                  <td className="text-right text-sm tabular-nums">
                    <LeadTime
                      check={checkLeadTime(
                        s.declaredLeadTimeDays,
                        s.avgLeadTimeDays,
                      )}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
