import type { Metadata } from 'next';
import Link from 'next/link';
import {
  BACKUP_STALE_HOURS,
  REPO_MIGRATIONS,
  TASK_OWNER_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  DELIVERY_STATUS_LABELS,
  addDays,
  attentionByProduct,
  attentionScore,
  billing,
  businessMonths,
  changeBp,
  countTasks,
  dayLabel,
  euros,
  hoursSince,
  integer,
  isDueSoon,
  isOpenTask,
  isOverdue,
  isPendingDelivery,
  madridToday,
  migrationDiff,
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
import type { ProductMetrics } from '@/modules/control/server';
import {
  getEnvStatus,
  getSystemStatus,
  listAttention,
  listBackups,
  listCosts,
  listDataQuality,
  listDeliveries,
  listMonthFacts,
  listTasks,
  loadProductMetrics,
  requireControl,
} from '@/modules/control/server';
import {
  ConsoleHeader,
  ConsoleSection,
  KeyFigure,
  MonthBars,
} from '@/modules/control/ui';
import { VAT_GENERAL_BP } from '@/modules/pricing';
import { Badge, buttonClass } from '@/components/ui';

export const metadata: Metadata = { title: 'Resumen' };

type Alert = { tone: 'danger' | 'warning'; text: string; href: string };

/** El valor de una lectura secundaria, o null si falló (el resumen sigue). */
function settled<T>(result: PromiseSettledResult<T>): T | null {
  if (result.status === 'fulfilled') return result.value;
  console.error('[consola] lectura del resumen', result.reason);
  return null;
}

function names(rows: readonly ProductMetrics[], max = 3) {
  const list = rows.slice(0, max).map((r) => r.productName);
  return rows.length > max
    ? `${list.join(', ')} y ${rows.length - max} más`
    : list.join(', ');
}

/** «1 tarea vencida», «2 tareas vencidas». */
function count(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

const rowLink =
  'hover:bg-surface-raised flex items-center justify-between gap-4 px-1 py-2 text-sm';

export default async function ControlHome() {
  const { supabase } = await requireControl();
  const now = new Date();
  const today = madridToday(now);
  const months = monthsEndingAt(monthOf(today), 12);
  const [facts, costs, tasks, deliveries] = await Promise.all([
    listMonthFacts(supabase, months[0]!, months.at(-1)!),
    listCosts(supabase),
    listTasks(supabase),
    listDeliveries(supabase),
  ]);
  const [
    metricsResult,
    statusResult,
    qualityResult,
    attentionResult,
    backupsResult,
  ] = await Promise.allSettled([
    loadProductMetrics(supabase, today),
    getSystemStatus(supabase),
    listDataQuality(supabase),
    listAttention(supabase, addDays(today, -6), addDays(today, 1)),
    listBackups(supabase, 30),
  ]);
  const metrics = settled(metricsResult);
  const status = settled(statusResult);
  const quality = settled(qualityResult);
  const attention = settled(attentionResult);
  const backups = settled(backupsResult);
  const env = getEnvStatus();

  const rows = businessMonths(facts, costs, months, VAT_GENERAL_BP);
  const current = rows.at(-1)!;
  const previous = rows.at(-2)!;
  const counts = countTasks(tasks, today);
  const money = billing(deliveries);
  const project = projectBalance(deliveries, costs, today);
  const fixedBusiness = recurringMonthlyCents(costs, current.month, 'business');
  const fixedProject = recurringMonthlyCents(costs, current.month, 'project');
  const salesChange = changeBp(current.netSalesCents, previous.netSalesCents);

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
  const pendingDeliveries =
    sortDeliveries(deliveries).filter(isPendingDelivery);
  const overdueDeliveries = pendingDeliveries.filter((d) =>
    isOverdue(d, today),
  );

  // Alertas: lo que pide atención hoy, de más a menos grave.
  const alerts: Alert[] = [];
  const products = metrics?.rows ?? [];
  const stockout = products.filter((r) => r.available === 0 && r.units12 > 0);
  const lowCover = products.filter(
    (r) =>
      r.available !== null &&
      r.available > 0 &&
      r.coverageDays !== null &&
      r.coverageDays < 14,
  );
  if (stockout.length > 0)
    alerts.push({
      tone: 'danger',
      text: `${count(stockout.length, 'perfume que se vende está', 'perfumes que se venden están')} sin disponible: ${names(stockout)}`,
      href: '/admin/control/productos?stock=rotura',
    });
  if (lowCover.length > 0)
    alerts.push({
      tone: 'warning',
      text: `${count(lowCover.length, 'perfume', 'perfumes')} con menos de 14 días de cobertura: ${names(lowCover)}`,
      href: '/admin/control/productos?orden=cobertura&dir=asc',
    });
  if (counts.overdue > 0)
    alerts.push({
      tone: 'danger',
      text: count(counts.overdue, 'tarea vencida', 'tareas vencidas'),
      href: '/admin/control/tareas',
    });
  if (overdueDeliveries.length > 0)
    alerts.push({
      tone: 'danger',
      text: count(
        overdueDeliveries.length,
        'entrega pasada de fecha',
        'entregas pasadas de fecha',
      ),
      href: '/admin/control/entregas',
    });
  if (backups) {
    // Solo cuenta la copia diaria: la descarga al momento no se guarda.
    const scheduled = backups.filter((b) => b.kind === 'scheduled');
    const lastOk = scheduled.find((b) => b.status === 'ok');
    const backupHours = lastOk ? hoursSince(lastOk.createdAt, now) : null;
    if (scheduled[0]?.status === 'error')
      alerts.push({
        tone: 'danger',
        text: 'La última copia diaria falló',
        href: '/admin/control/copias',
      });
    else if (backupHours === null || backupHours > BACKUP_STALE_HOURS)
      alerts.push({
        tone: 'danger',
        text:
          backupHours === null
            ? 'Todavía no hay ninguna copia diaria'
            : `La última copia diaria es de hace ${Math.floor(backupHours)} h`,
        href: '/admin/control/copias',
      });
  }
  if (status) {
    const pending = status.migrations
      ? migrationDiff(REPO_MIGRATIONS, status.migrations).pending.length
      : 0;
    if (pending > 0)
      alerts.push({
        tone: 'danger',
        text: `${count(pending, 'migración', 'migraciones')} del código sin aplicar en la base`,
        href: '/admin/control/sistema',
      });
  }
  const missing = env.variables.filter(
    (v) => !v.configured && v.name !== 'SUPABASE_BACKUPS_TOKEN',
  );
  if (missing.length > 0)
    alerts.push({
      tone: 'warning',
      text: `Variables sin configurar: ${missing.map((v) => v.name).join(', ')}`,
      href: '/admin/control/sistema',
    });
  const highQuality = quality?.filter((q) => q.severity === 'alta') ?? [];
  if (highQuality.length > 0)
    alerts.push({
      tone: 'warning',
      text: `${count(highQuality.length, 'incidencia grave', 'incidencias graves')} de datos (sin PVP, sin imagen o stock que no cuadra)`,
      href: '/admin/control/calidad?gravedad=alta',
    });
  const failed = [metrics, status, quality, attention, backups].filter(
    (r) => r === null,
  ).length;
  if (failed > 0)
    alerts.push({
      tone: 'warning',
      text: `${count(failed, 'lectura del resumen falló', 'lecturas del resumen fallaron')}: revisa el estado del sistema`,
      href: '/admin/control/sistema',
    });

  const risers = products
    .filter((r) => r.trend.direction === 'up' && r.trend.changeBp !== null)
    .sort((a, b) => b.trend.changeBp! - a.trend.changeBp!)
    .slice(0, 5);
  const fallers = products
    .filter((r) => r.trend.direction === 'down' && r.trend.changeBp !== null)
    .sort((a, b) => a.trend.changeBp! - b.trend.changeBp!)
    .slice(0, 5);
  const productNames = new Map<string, string>();
  for (const v of metrics?.variants.values() ?? [])
    productNames.set(v.productId, `${v.brandName} · ${v.productName}`);
  const mostViewed = [...attentionByProduct(attention ?? []).entries()]
    .map(([productId, c]) => ({ productId, score: attentionScore(c) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return (
    <main>
      <ConsoleHeader
        section={monthLongLabel(current.month)}
        title="Resumen"
        description="Lo que pide atención hoy, el negocio del mes y el proyecto."
      >
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
      </ConsoleHeader>

      <ConsoleSection id="alertas" title="Alertas" className="">
        {alerts.length === 0 ? (
          <p className="text-fg-muted border-border border-y py-3 text-sm">
            Nada urgente: sin roturas, tareas vencidas, copias atrasadas ni
            migraciones pendientes.
          </p>
        ) : (
          <ul className="divide-border border-border divide-y border-y">
            {alerts.map((a) => (
              <li key={a.text}>
                <Link href={a.href} className={rowLink}>
                  <span className="flex min-w-0 items-center gap-3">
                    <span
                      aria-hidden="true"
                      className={`size-2 shrink-0 ${a.tone === 'danger' ? 'bg-danger' : 'bg-warning'}`}
                    />
                    <span className="truncate">{a.text}</span>
                  </span>
                  <span className="text-fg-muted shrink-0 text-xs">
                    {a.tone === 'danger' ? 'Urgente' : 'Revisar'} →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </ConsoleSection>

      <ConsoleSection id="mes" title="Negocio este mes">
        <div className="grid grid-cols-4 gap-3">
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
          <p className="text-fg-muted mt-2 max-w-3xl text-xs leading-relaxed">
            {current.estimatedGrossCents !== 0 &&
              `Incluye ${euros(current.estimatedGrossCents)} con IVA estimados con el PVP vigente (ventas sin precio cobrado). `}
            {current.unpricedUnits > 0 &&
              `${current.unpricedUnits} uds vendidas sin precio ni PVP no cuentan. `}
            {current.uncostedUnits > 0 &&
              `${current.uncostedUnits} uds sin coste: el margen real es menor.`}
          </p>
        )}
        <div className="mt-6 grid grid-cols-2 gap-8">
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
        </div>
      </ConsoleSection>

      <div className="mt-10 grid grid-cols-3 gap-8">
        <ConsoleSection
          id="suben"
          title="Suben"
          className=""
          action={<MoreLink href="/admin/control/productos?tendencia=up" />}
        >
          <MoverList
            rows={risers}
            empty="Ningún perfume sube con datos suficientes."
          />
        </ConsoleSection>
        <ConsoleSection
          id="bajan"
          title="Bajan"
          className=""
          action={<MoreLink href="/admin/control/productos?tendencia=down" />}
        >
          <MoverList
            rows={fallers}
            empty="Ningún perfume baja con datos suficientes."
          />
        </ConsoleSection>
        <ConsoleSection
          id="vistos"
          title="Más vistos (7 días)"
          className=""
          action={<MoreLink href="/admin/control/atencion?periodo=7" />}
        >
          {mostViewed.length === 0 ? (
            <p className="text-fg-muted text-sm">Sin visitas esta semana.</p>
          ) : (
            <ol className="divide-border border-border divide-y border-y">
              {mostViewed.map((r) => (
                <li key={r.productId}>
                  <Link
                    href={`/admin/control/productos/${r.productId}`}
                    className={rowLink}
                  >
                    <span className="truncate">
                      {productNames.get(r.productId) ?? 'Perfume'}
                    </span>
                    <span className="text-fg-muted shrink-0 font-mono text-xs tabular-nums">
                      {integer(r.score)}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </ConsoleSection>
      </div>

      <ConsoleSection id="proyecto" title="Proyecto">
        <div className="grid grid-cols-4 gap-3">
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
      </ConsoleSection>

      <div className="mt-10 grid grid-cols-2 gap-8">
        <ConsoleSection
          id="urgente"
          title="Lo urgente"
          className=""
          action={
            <MoreLink href="/admin/control/tareas" label="Todas las tareas" />
          }
        >
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
                    className={rowLink}
                  >
                    <span className="min-w-0">
                      <span className="block truncate">{task.title}</span>
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
        </ConsoleSection>

        <ConsoleSection
          id="entregas"
          title="Próximas entregas"
          className=""
          action={
            <MoreLink
              href="/admin/control/entregas"
              label="Todas las entregas"
            />
          }
        >
          {pendingDeliveries.length === 0 ? (
            <p className="text-fg-muted text-sm">
              No hay entregas planificadas ni en curso.
            </p>
          ) : (
            <ul className="divide-border border-border divide-y border-y">
              {pendingDeliveries.slice(0, 5).map((d) => (
                <li key={d.id}>
                  <Link
                    href={`/admin/control/entregas/${d.id}`}
                    className={rowLink}
                  >
                    <span className="min-w-0">
                      <span className="block truncate">{d.title}</span>
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
        </ConsoleSection>
      </div>
    </main>
  );
}

function MoreLink({
  href,
  label = 'Ver todo',
}: {
  href: string;
  label?: string;
}) {
  return (
    <Link
      href={href}
      className="text-fg-muted hover:text-fg inline-flex min-h-9 items-center text-xs"
    >
      {label} →
    </Link>
  );
}

function MoverList({
  rows,
  empty,
}: {
  rows: readonly ProductMetrics[];
  empty: string;
}) {
  if (rows.length === 0)
    return <p className="text-fg-muted text-sm">{empty}</p>;
  return (
    <ol className="divide-border border-border divide-y border-y">
      {rows.map((r) => (
        <li key={r.productId}>
          <Link
            href={`/admin/control/productos/${r.productId}`}
            className={rowLink}
          >
            <span className="truncate">
              <span className="text-fg-muted">{r.brandName} · </span>
              {r.productName}
            </span>
            <span
              className={`shrink-0 font-mono text-xs tabular-nums ${r.trend.direction === 'up' ? 'text-success' : 'text-danger'}`}
            >
              {signedPercent(r.trend.changeBp)}
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
