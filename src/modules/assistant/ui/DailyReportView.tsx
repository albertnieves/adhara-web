import Link from 'next/link';
import { FINDING_LABELS, SEVERITY_LABELS } from '@/modules/inventory';
import { BUCKET_LABELS, REPORT_BUCKETS } from '@/modules/reports';
import type { DailyReport, DailyTaskKey } from '../domain/daily-report';

const DATE = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});
const TIME = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Madrid',
});

export function reportDayLabel(day: string) {
  return DATE.format(new Date(`${day}T12:00:00Z`));
}

function Figure({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'alert';
}) {
  return (
    <div className="border-line border-t pt-3">
      <p className="text-smoke text-2xs tracking-caps-sm font-semibold break-words hyphens-auto uppercase">
        {label}
      </p>
      <p
        className={`font-display mt-1 text-3xl font-light tabular-nums ${tone === 'alert' && value > 0 ? 'text-danger' : ''}`}
      >
        {value}
      </p>
    </div>
  );
}

/** Informe diario: tareas con enlace, actividad, stock y compras. */
export function DailyReportView({
  report,
  summary,
  visibleTasks,
}: {
  report: DailyReport;
  summary: string | null;
  /** Tareas cuya pantalla puede abrir quien mira (permisos de su rol). */
  visibleTasks: ReadonlySet<DailyTaskKey>;
}) {
  const { activity, stock, watch, purchasing } = report;
  const tasks = report.tasks.filter((task) => visibleTasks.has(task.key));
  return (
    <div className="space-y-10">
      {summary && (
        <section
          aria-label="Resumen del asistente"
          data-tone="dark"
          className="border-gold bg-night text-ivory border-l-2 px-6 py-5"
        >
          <p className="text-gold-soft text-2xs tracking-caps font-semibold uppercase">
            Resumen del asistente
          </p>
          <div className="mt-3 text-sm leading-relaxed whitespace-pre-line">
            {summary}
          </div>
        </section>
      )}

      <section aria-labelledby="tareas">
        <h2 id="tareas" className="text-2xl font-light">
          Qué hay que hacer
        </h2>
        {tasks.length === 0 ? (
          <p className="text-smoke mt-3 text-sm">
            Nada pendiente con los datos de este informe.
          </p>
        ) : (
          <ul className="divide-line border-line mt-4 divide-y border-y">
            {tasks.map((task) => (
              <li key={task.key}>
                <Link
                  href={task.href}
                  className="hover:bg-surface-raised/60 flex min-h-12 items-center justify-between gap-4 py-2 text-sm"
                >
                  <span>{task.label}</span>
                  <span
                    className={`font-display text-2xl tabular-nums ${task.tone === 'alert' ? 'text-danger' : ''}`}
                  >
                    {task.count}
                    <span
                      aria-hidden="true"
                      className="text-fg-muted ml-3 text-sm"
                    >
                      →
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="actividad">
        <h2 id="actividad" className="text-2xl font-light">
          Actividad del día
        </h2>
        <p className="text-smoke mt-1 text-sm">
          {activity.movements === 0
            ? 'Sin movimientos de stock.'
            : `${activity.movements} movimientos${activity.storeTickets ? ` · ${activity.storeTickets} tickets de mostrador` : ''}.`}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
          {REPORT_BUCKETS.map((bucket) => (
            <Figure
              key={bucket}
              label={BUCKET_LABELS[bucket]}
              value={activity.units[bucket]}
            />
          ))}
        </div>
        {activity.topSold.length > 0 && (
          <div className="mt-6">
            <h3 className="eyebrow">Más vendidos</h3>
            <ol className="mt-2 space-y-1 text-sm">
              {activity.topSold.map((row) => (
                <li
                  key={`${row.product}-${row.variant}`}
                  className="flex justify-between gap-4"
                >
                  <span>
                    <span className="text-smoke">{row.brand} · </span>
                    {row.product} {row.variant}
                  </span>
                  <span className="tabular-nums">{row.units} uds.</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>

      <section aria-labelledby="stock" className="grid gap-10">
        <div>
          <h2 id="stock" className="text-2xl font-light">
            Stock
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
            <Figure label="Unidades" value={stock.unitsOnHand} />
            <Figure label="Formatos" value={stock.activeFormats} />
            <Figure
              label="Agotados"
              value={stock.outOfStock.count}
              tone="alert"
            />
            <Figure label="Stock bajo" value={stock.low.count} tone="alert" />
          </div>
          {watch.items.length > 0 && (
            <ul className="divide-line border-line mt-6 divide-y border-y text-sm">
              {watch.items.map((row) => (
                <li
                  key={`${row.kind}-${row.product}-${row.variant}`}
                  className="flex items-baseline justify-between gap-4 py-2"
                >
                  <span className="min-w-0">
                    {row.product} {row.variant}
                    <span className="text-smoke block text-xs">
                      {row.brand} · {FINDING_LABELS[row.kind]}
                    </span>
                  </span>
                  <span
                    className={`tracking-caps-sm shrink-0 text-xs uppercase ${row.severity === 'critical' ? 'text-danger' : 'text-smoke'}`}
                  >
                    {SEVERITY_LABELS[row.severity]}
                    {row.proposedUnits ? ` · pedir ${row.proposedUnits}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h2 className="text-2xl font-light">Compras</h2>
          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
            <Figure label="Pedidos abiertos" value={purchasing.open} />
            <Figure label="Uds. en camino" value={purchasing.unitsPending} />
          </div>
          {purchasing.overdue.length > 0 && (
            <ul className="mt-6 space-y-1 text-sm">
              {purchasing.overdue.map((order) => (
                <li key={order.number} className="text-danger">
                  {order.number}: debía llegar el{' '}
                  {reportDayLabel(order.expectedOn)} · {order.unitsPending} uds.
                  pendientes
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <p className="text-fg-muted text-xs">
        {report.location} · calculado el{' '}
        {TIME.format(new Date(report.generatedAt))}. Unidades, sin costes.
      </p>
    </div>
  );
}
