import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/modules/admin';
import { requirePermission } from '@/modules/auth/server';
import type { ControlArea, ControlCost, CostState } from '@/modules/control';
import {
  AREA_LABELS,
  CONTROL_AREAS,
  COST_CATEGORY_LABELS,
  COST_FREQUENCY_LABELS,
  costState,
  costsByMonth,
  dayLabel,
  euros,
  madridToday,
  monthOf,
  monthlyEquivalent,
  monthsEndingAt,
  recurringMonthlyCents,
} from '@/modules/control';
import { listCosts } from '@/modules/control/server';
import { KeyFigure, MonthBars } from '@/modules/control/ui';
import { Badge, buttonClass, EmptyState, Table } from '@/components/ui';

export const metadata: Metadata = { title: 'Costes' };

const STATE_LABELS: Record<CostState, string> = {
  active: 'Vigente',
  upcoming: 'Próximo',
  ended: 'Terminado',
};

function CostTable({
  area,
  costs,
  today,
}: {
  area: ControlArea;
  costs: ControlCost[];
  today: string;
}) {
  if (costs.length === 0) {
    return (
      <p className="text-fg-muted text-sm">
        Sin costes de {AREA_LABELS[area].toLowerCase()}.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <Table
        caption={`Costes del ${AREA_LABELS[area].toLowerCase()}`}
        stacked={false}
        className="min-w-[48rem]"
      >
        <thead>
          <tr>
            <th>Concepto</th>
            <th>Categoría</th>
            <th>Frecuencia</th>
            <th className="text-right">Importe</th>
            <th className="text-right">Al mes</th>
            <th>Vigencia</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {costs.map((cost) => {
            const state = costState(cost, today);
            return (
              <tr
                key={cost.id}
                className={state === 'ended' ? 'text-fg-muted' : ''}
              >
                <td className="text-sm">
                  <Link
                    href={`/admin/control/costes/${cost.id}`}
                    className="inline-flex min-h-11 items-center hover:underline"
                  >
                    {cost.concept}
                  </Link>
                </td>
                <td className="text-sm">
                  {COST_CATEGORY_LABELS[cost.category]}
                </td>
                <td className="text-sm">
                  {COST_FREQUENCY_LABELS[cost.frequency]}
                </td>
                <td className="text-right tabular-nums">
                  {euros(cost.amountNetCents)}
                </td>
                <td className="text-right tabular-nums">
                  {cost.frequency === 'once'
                    ? '—'
                    : euros(monthlyEquivalent(cost))}
                </td>
                <td className="text-sm">
                  {cost.frequency === 'once'
                    ? dayLabel(cost.startsOn)
                    : `${dayLabel(cost.startsOn)} – ${cost.endsOn ? dayLabel(cost.endsOn) : 'sin fin'}`}
                </td>
                <td>
                  <Badge tone={state === 'active' ? 'success' : 'neutral'}>
                    {STATE_LABELS[state]}
                  </Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
}

export default async function CostsPage() {
  const { supabase } = await requirePermission('business.control');
  const today = madridToday();
  const month = monthOf(today);
  const months = monthsEndingAt(month, 12);
  const costs = await listCosts(supabase);
  const paid = costsByMonth(costs, months);
  const business = recurringMonthlyCents(costs, month, 'business');
  const project = recurringMonthlyCents(costs, month, 'project');
  const thisMonth = paid.at(-1)!;
  const yearTotal = paid.reduce((sum, m) => sum + m.totalCents, 0);

  return (
    <main>
      <PageHeader eyebrow="Negocio" title="Costes">
        <Link
          href="/admin/control/costes/nuevo"
          className={buttonClass('primary', 'md')}
        >
          Añadir coste
        </Link>
      </PageHeader>

      <p className="text-fg-muted mb-10 max-w-3xl text-sm leading-relaxed">
        Importes sin IVA. Los mensuales cuentan cada mes de su vigencia, los
        anuales en el mes en que se pagan y los puntuales una vez. Los del
        negocio restan del beneficio de la tienda; los del proyecto, del balance
        del proyecto. El coste de la mercancía no va aquí: sale del coste de
        cada formato al venderse.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KeyFigure
          label="Fijos del negocio"
          value={euros(business)}
          note="Al mes, con los anuales repartidos"
        />
        <KeyFigure
          label="Fijos del proyecto"
          value={euros(project)}
          note="Al mes, con los anuales repartidos"
        />
        <KeyFigure
          label="Pagado este mes"
          value={euros(thisMonth.totalCents)}
          note="Negocio y proyecto, también anuales y puntuales"
        />
        <KeyFigure
          label="Últimos 12 meses"
          value={euros(yearTotal)}
          note="Negocio y proyecto"
        />
      </div>

      <section className="mt-12">
        <MonthBars
          title="Costes pagados por mes"
          data={paid.map((m) => ({ month: m.month, value: m.totalCents }))}
          format={euros}
          highlight={month}
        />
      </section>

      {costs.length === 0 ? (
        <EmptyState
          className="mt-14"
          title="Aún no hay costes"
          description="Añade el alquiler, los servicios (dominio, alojamiento, correo), la asesoría o cualquier gasto fijo o puntual para verlo mes a mes."
        />
      ) : (
        CONTROL_AREAS.map((area) => (
          <section key={area} className="mt-14">
            <h2 className="mb-4 text-2xl font-light">{AREA_LABELS[area]}</h2>
            <CostTable
              area={area}
              costs={costs.filter((c) => c.area === area)}
              today={today}
            />
          </section>
        ))
      )}
    </main>
  );
}
