import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/modules/admin';
import { requirePermission } from '@/modules/auth/server';
import {
  businessMonths,
  euros,
  madridToday,
  monthLabel,
  monthOf,
  monthsEndingAt,
  percent,
  sumMonths,
  topVariants,
} from '@/modules/control';
import { listCosts, listMonthFacts } from '@/modules/control/server';
import { MonthBars } from '@/modules/control/ui';
import { VAT_GENERAL_BP } from '@/modules/pricing';
import { listAllVariants } from '@/modules/reports/server';
import { Table } from '@/components/ui';

export const metadata: Metadata = { title: 'Ventas y beneficio' };

const PERIODS = [6, 12, 24] as const;

export default async function BusinessPage({
  searchParams,
}: {
  searchParams: Promise<{ meses?: string }>;
}) {
  const { supabase } = await requirePermission('business.control');
  const { meses } = await searchParams;
  const count: number = PERIODS.find((p) => String(p) === meses) ?? 12;
  const today = madridToday();
  const months = monthsEndingAt(monthOf(today), count);
  const [facts, costs, variants] = await Promise.all([
    listMonthFacts(supabase, months[0]!, months.at(-1)!),
    listCosts(supabase),
    listAllVariants(supabase),
  ]);
  const rows = businessMonths(facts, costs, months, VAT_GENERAL_BP);
  const total = sumMonths(rows);
  const top = topVariants(facts, 10);
  const newestFirst = [...rows].reverse();

  return (
    <main>
      <PageHeader eyebrow="Negocio" title="Ventas y beneficio">
        <nav aria-label="Periodo" className="flex flex-wrap gap-2">
          {PERIODS.map((p) => (
            <Link
              key={p}
              href={`/admin/control/negocio?meses=${p}`}
              aria-current={p === count ? 'page' : undefined}
              className={`tracking-caps inline-flex min-h-11 items-center border px-4 text-xs uppercase ${
                p === count
                  ? 'border-fg text-fg'
                  : 'border-border text-fg-muted hover:border-fg hover:text-fg'
              }`}
            >
              {p} meses
            </Link>
          ))}
        </nav>
      </PageHeader>

      <p className="text-fg-muted mb-10 max-w-3xl text-sm leading-relaxed">
        Ventas de la tienda (mostrador y ventas registradas desde Inventario)
        menos devoluciones. El importe es el cobrado en el mostrador; lo que no
        tiene precio cobrado se estima con el PVP vigente. Ventas sin IVA (
        {VAT_GENERAL_BP / 100} %), coste de lo vendido con el coste vigente en
        cada venta y beneficio después de los{' '}
        <Link href="/admin/control/costes" className="underline">
          costes del negocio
        </Link>{' '}
        pagados cada mes. Las compras recibidas son salida de caja: no restan
        del beneficio, lo hace el coste de lo vendido.
      </p>

      <div className="grid gap-10 lg:grid-cols-2">
        <MonthBars
          title="Beneficio por mes"
          data={rows.map((r) => ({ month: r.month, value: r.profitCents }))}
          format={euros}
          highlight={rows.at(-1)!.month}
        />
        <MonthBars
          title="Margen bruto por mes"
          data={rows.map((r) => ({
            month: r.month,
            value: r.grossMarginCents,
          }))}
          format={euros}
          highlight={rows.at(-1)!.month}
        />
      </div>

      <section className="mt-14">
        <h2 className="mb-4 text-2xl font-light">Mes a mes</h2>
        <div className="overflow-x-auto">
          <Table
            caption={`Cuenta de resultados de los últimos ${count} meses`}
            stacked={false}
            className="min-w-[60rem]"
          >
            <thead>
              <tr>
                <th>Mes</th>
                <th className="text-right">Uds netas</th>
                <th className="text-right">Ventas con IVA</th>
                <th className="text-right">Ventas sin IVA</th>
                <th className="text-right">Coste vendido</th>
                <th className="text-right">Margen</th>
                <th className="text-right">Costes negocio</th>
                <th className="text-right">Beneficio</th>
                <th className="text-right">Compras</th>
              </tr>
            </thead>
            <tbody>
              {newestFirst.map((r) => (
                <tr key={r.month}>
                  <td className="text-sm whitespace-nowrap">
                    {monthLabel(r.month)}
                    {r.estimatedGrossCents !== 0 && (
                      <span className="text-fg-muted block text-xs">
                        {euros(r.estimatedGrossCents)} estimados
                      </span>
                    )}
                  </td>
                  <td className="text-right tabular-nums">
                    {r.soldUnits - r.returnedUnits}
                  </td>
                  <td className="text-right tabular-nums">
                    {euros(r.grossSalesCents)}
                  </td>
                  <td className="text-right tabular-nums">
                    {euros(r.netSalesCents)}
                  </td>
                  <td
                    className={`text-right tabular-nums ${r.uncostedUnits > 0 ? 'text-danger' : ''}`}
                    title={
                      r.uncostedUnits > 0
                        ? `${r.uncostedUnits} uds sin coste`
                        : undefined
                    }
                  >
                    {euros(r.cogsCents)}
                  </td>
                  <td className="text-right tabular-nums">
                    {euros(r.grossMarginCents)}
                    <span className="text-fg-muted block text-xs">
                      {percent(r.marginBp)}
                    </span>
                  </td>
                  <td className="text-right tabular-nums">
                    {euros(r.expensesCents)}
                  </td>
                  <td
                    className={`text-right font-semibold tabular-nums ${r.profitCents < 0 ? 'text-danger' : ''}`}
                  >
                    {euros(r.profitCents)}
                  </td>
                  <td className="text-right tabular-nums">
                    {euros(r.purchasesCents)}
                    {r.receivedUnits > 0 && (
                      <span className="text-fg-muted block text-xs">
                        {r.receivedUnits} uds
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td className="text-sm">Total</td>
                <td className="text-right tabular-nums">
                  {total.soldUnits - total.returnedUnits}
                </td>
                <td className="text-right tabular-nums">
                  {euros(total.grossSalesCents)}
                </td>
                <td className="text-right tabular-nums">
                  {euros(total.netSalesCents)}
                </td>
                <td className="text-right tabular-nums">
                  {euros(total.cogsCents)}
                </td>
                <td className="text-right tabular-nums">
                  {euros(total.grossMarginCents)}
                  <span className="text-fg-muted block text-xs font-normal">
                    {percent(total.marginBp)}
                  </span>
                </td>
                <td className="text-right tabular-nums">
                  {euros(total.expensesCents)}
                </td>
                <td
                  className={`text-right tabular-nums ${total.profitCents < 0 ? 'text-danger' : ''}`}
                >
                  {euros(total.profitCents)}
                </td>
                <td className="text-right tabular-nums">
                  {euros(total.purchasesCents)}
                </td>
              </tr>
            </tfoot>
          </Table>
        </div>
        {(total.uncostedUnits > 0 ||
          total.unpricedUnits > 0 ||
          total.uncostedReceivedUnits > 0) && (
          <ul className="text-fg-muted mt-4 space-y-1 text-xs">
            {total.uncostedUnits > 0 && (
              <li>
                {total.uncostedUnits} uds vendidas o devueltas sin coste
                registrado: no restan en el coste vendido y el margen real es
                menor. Regístralo en Catálogo o al recibir un pedido.
              </li>
            )}
            {total.unpricedUnits > 0 && (
              <li>
                {total.unpricedUnits} uds vendidas sin precio cobrado ni PVP: no
                cuentan en las ventas.
              </li>
            )}
            {total.uncostedReceivedUnits > 0 && (
              <li>
                {total.uncostedReceivedUnits} uds recibidas sin coste: no
                cuentan en las compras.
              </li>
            )}
          </ul>
        )}
      </section>

      <section className="mt-14">
        <h2 className="mb-4 text-2xl font-light">
          Lo más vendido en {count} meses
        </h2>
        {top.length === 0 ? (
          <p className="text-fg-muted text-sm">Aún no hay ventas.</p>
        ) : (
          <ol className="divide-border border-border divide-y border-y">
            {top.map((row, index) => {
              const v = variants.get(row.variantId);
              return (
                <li
                  key={row.variantId}
                  className="flex flex-wrap items-center justify-between gap-4 py-3 text-sm"
                >
                  <span className="min-w-0">
                    <span className="text-fg-muted tabular-nums">
                      {index + 1}.{' '}
                    </span>
                    {v ? (
                      <Link
                        href={`/admin/catalogo/${v.productId}`}
                        className="hover:underline"
                      >
                        <span className="text-fg-muted">{v.brandName} · </span>
                        {v.productName} · {v.variantLabel}
                      </Link>
                    ) : (
                      'Formato borrado'
                    )}
                  </span>
                  <span className="tabular-nums">
                    {row.units} uds · {euros(row.grossCents)} con IVA
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </main>
  );
}
