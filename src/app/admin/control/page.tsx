import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/modules/admin';
import { requirePermission } from '@/modules/auth/server';
import {
  TASK_OWNER_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  DELIVERY_STATUS_LABELS,
  billing,
  businessMonths,
  changeBp,
  countTasks,
  dayLabel,
  euros,
  isDueSoon,
  isOpenTask,
  isOverdue,
  isPendingDelivery,
  madridToday,
  monthLongLabel,
  monthOf,
  monthsEndingAt,
  percent,
  projectBalance,
  recurringMonthlyCents,
  signedPercent,
  sortDeliveries,
  sortTasks,
} from '@/modules/control';
import {
  listCosts,
  listDeliveries,
  listMonthFacts,
  listTasks,
} from '@/modules/control/server';
import { KeyFigure, MonthBars } from '@/modules/control/ui';
import { VAT_GENERAL_BP } from '@/modules/pricing';
import { Badge, buttonClass } from '@/components/ui';

export const metadata: Metadata = { title: 'Resumen' };

export default async function ControlHome() {
  const { supabase } = await requirePermission('business.control');
  const today = madridToday();
  const months = monthsEndingAt(monthOf(today), 12);
  const [facts, costs, tasks, deliveries] = await Promise.all([
    listMonthFacts(supabase, months[0]!, months.at(-1)!),
    listCosts(supabase),
    listTasks(supabase),
    listDeliveries(supabase),
  ]);

  const rows = businessMonths(facts, costs, months, VAT_GENERAL_BP);
  const current = rows.at(-1)!;
  const previous = rows.at(-2)!;
  const counts = countTasks(tasks, today);
  const money = billing(deliveries);
  const project = projectBalance(deliveries, costs, today);
  const fixedBusiness = recurringMonthlyCents(costs, current.month, 'business');
  const fixedProject = recurringMonthlyCents(costs, current.month, 'project');

  const urgent = sortTasks(tasks)
    .filter(
      (t) =>
        isOpenTask(t) &&
        (isOverdue(t, today) ||
          isDueSoon(t, today) ||
          t.priority === 'high' ||
          t.status === 'blocked'),
    )
    .slice(0, 6);
  const nextDeliveries = sortDeliveries(deliveries)
    .filter(isPendingDelivery)
    .slice(0, 5);
  const salesChange = changeBp(current.netSalesCents, previous.netSalesCents);

  return (
    <main>
      <PageHeader eyebrow={monthLongLabel(current.month)} title="Resumen">
        <Link
          href="/admin/control/tareas/nueva"
          className={buttonClass('primary', 'md')}
        >
          Nueva tarea
        </Link>
        <Link
          href="/admin/control/costes/nuevo"
          className={buttonClass('outline', 'md')}
        >
          Añadir coste
        </Link>
      </PageHeader>

      <section aria-labelledby="mes">
        <h2 id="mes" className="mb-4 text-2xl font-light">
          Negocio este mes
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KeyFigure
            label="Ventas sin IVA"
            value={euros(current.netSalesCents)}
            note={`${signedPercent(salesChange)} frente a ${monthLongLabel(previous.month)} · ${current.soldUnits - current.returnedUnits} uds`}
            href="/admin/control/negocio"
          />
          <KeyFigure
            label="Margen bruto"
            value={euros(current.grossMarginCents)}
            note={`${percent(current.marginBp)} sobre ventas, tras el coste de lo vendido`}
            href="/admin/control/negocio"
          />
          <KeyFigure
            label="Costes del negocio"
            value={euros(current.expensesCents)}
            note={`Pagados este mes · fijos: ${euros(fixedBusiness)} al mes`}
            href="/admin/control/costes"
          />
          <KeyFigure
            label="Beneficio"
            value={euros(current.profitCents)}
            tone={current.profitCents < 0 ? 'alert' : 'default'}
            note="Margen bruto − costes del negocio"
            href="/admin/control/negocio"
          />
        </div>
        {(current.estimatedGrossCents !== 0 ||
          current.uncostedUnits > 0 ||
          current.unpricedUnits > 0) && (
          <p className="text-fg-muted mt-3 max-w-3xl text-xs leading-relaxed">
            {current.estimatedGrossCents !== 0 &&
              `Incluye ${euros(current.estimatedGrossCents)} con IVA estimados con el PVP vigente (ventas sin precio cobrado). `}
            {current.unpricedUnits > 0 &&
              `${current.unpricedUnits} uds vendidas sin precio ni PVP no cuentan. `}
            {current.uncostedUnits > 0 &&
              `${current.uncostedUnits} uds sin coste: el margen real es menor.`}
          </p>
        )}
      </section>

      <section className="mt-12 grid gap-10 lg:grid-cols-2">
        <MonthBars
          title="Beneficio por mes"
          data={rows.map((r) => ({ month: r.month, value: r.profitCents }))}
          format={euros}
          highlight={current.month}
        />
        <MonthBars
          title="Ventas sin IVA por mes"
          data={rows.map((r) => ({ month: r.month, value: r.netSalesCents }))}
          format={euros}
          highlight={current.month}
        />
      </section>

      <section aria-labelledby="proyecto" className="mt-14">
        <h2 id="proyecto" className="mb-4 text-2xl font-light">
          Proyecto
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KeyFigure
            label="Tareas abiertas"
            value={counts.open}
            note={`Del cliente: ${counts.waitingOnClient} · hechas este mes: ${counts.doneThisMonth}`}
            href="/admin/control/tareas"
          />
          <KeyFigure
            label="Vencidas"
            value={counts.overdue}
            tone={counts.overdue > 0 ? 'alert' : 'default'}
            note={`Vencen en los próximos 14 días: ${counts.dueSoon}`}
            href="/admin/control/tareas"
          />
          <KeyFigure
            label="Pendiente de cobrar"
            value={euros(money.toInvoiceCents + money.invoicedCents)}
            note={`${euros(money.invoicedCents)} facturado sin cobrar · ${euros(money.plannedCents)} en entregas futuras`}
            href="/admin/control/entregas"
          />
          <KeyFigure
            label="Balance del proyecto"
            value={euros(project.balanceCents)}
            tone={project.balanceCents < 0 ? 'alert' : 'default'}
            note={`Facturado ${euros(project.billedCents)} − costes ${euros(project.costsCents)} · fijos: ${euros(fixedProject)} al mes`}
            href="/admin/control/entregas"
          />
        </div>
      </section>

      <div className="mt-14 grid gap-12 lg:grid-cols-2">
        <section aria-labelledby="urgente">
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <h2 id="urgente" className="text-2xl font-light">
              Lo urgente
            </h2>
            <Link
              href="/admin/control/tareas"
              className="text-fg-muted hover:text-fg tracking-caps inline-flex min-h-11 items-center text-xs uppercase"
            >
              Todas las tareas
            </Link>
          </div>
          {urgent.length === 0 ? (
            <p className="text-fg-muted text-sm">
              Nada vencido, bloqueado ni de prioridad alta.
            </p>
          ) : (
            <ul className="divide-border border-border divide-y border-y">
              {urgent.map((task) => (
                <li key={task.id}>
                  <Link
                    href={`/admin/control/tareas/${task.id}`}
                    className="hover:bg-surface-raised/60 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 text-sm"
                  >
                    <span className="min-w-0">
                      {task.title}
                      <span className="text-fg-muted block text-xs">
                        {TASK_STATUS_LABELS[task.status]} ·{' '}
                        {TASK_OWNER_LABELS[task.owner]} · prioridad{' '}
                        {TASK_PRIORITY_LABELS[task.priority].toLowerCase()}
                      </span>
                    </span>
                    {task.dueOn && (
                      <Badge
                        tone={isOverdue(task, today) ? 'danger' : 'neutral'}
                      >
                        {isOverdue(task, today) ? 'Vencida · ' : ''}
                        {dayLabel(task.dueOn)}
                      </Badge>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="entregas">
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <h2 id="entregas" className="text-2xl font-light">
              Próximas entregas
            </h2>
            <Link
              href="/admin/control/entregas"
              className="text-fg-muted hover:text-fg tracking-caps inline-flex min-h-11 items-center text-xs uppercase"
            >
              Todas las entregas
            </Link>
          </div>
          {nextDeliveries.length === 0 ? (
            <p className="text-fg-muted text-sm">
              No hay entregas planificadas ni en curso.
            </p>
          ) : (
            <ul className="divide-border border-border divide-y border-y">
              {nextDeliveries.map((d) => (
                <li key={d.id}>
                  <Link
                    href={`/admin/control/entregas/${d.id}`}
                    className="hover:bg-surface-raised/60 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 text-sm"
                  >
                    <span className="min-w-0">
                      {d.title}
                      <span className="text-fg-muted block text-xs">
                        {DELIVERY_STATUS_LABELS[d.status]}
                        {d.amountNetCents !== null &&
                          ` · ${euros(d.amountNetCents)}`}
                      </span>
                    </span>
                    {d.dueOn && (
                      <Badge tone={isOverdue(d, today) ? 'danger' : 'neutral'}>
                        {dayLabel(d.dueOn)}
                      </Badge>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
