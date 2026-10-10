import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/modules/admin';
import { requirePermission } from '@/modules/auth/server';
import type { ControlTask } from '@/modules/control';
import {
  AREA_LABELS,
  CONTROL_AREAS,
  TASK_OWNER_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  countTasks,
  dayLabel,
  isDueSoon,
  isOneOf,
  isOpenTask,
  isOverdue,
  madridToday,
  sortTasks,
} from '@/modules/control';
import { listTasks } from '@/modules/control/server';
import { TaskDoneToggle } from '@/modules/control/ui';
import { Badge, buttonClass, EmptyState } from '@/components/ui';
import type { BadgeTone } from '@/components/ui';

export const metadata: Metadata = { title: 'Tareas' };

const VIEWS = {
  abiertas: 'Abiertas',
  hechas: 'Hechas',
  todas: 'Todas',
} as const;
type View = keyof typeof VIEWS;

const STATUS_TONES: Record<ControlTask['status'], BadgeTone> = {
  pending: 'neutral',
  in_progress: 'accent',
  blocked: 'warning',
  done: 'success',
};

function filterHref(view: View, area: string | null) {
  const params = new URLSearchParams();
  if (view !== 'abiertas') params.set('ver', view);
  if (area) params.set('area', area);
  const query = params.toString();
  return `/admin/control/tareas${query ? `?${query}` : ''}`;
}

function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`tracking-caps inline-flex min-h-11 items-center border px-4 text-xs uppercase ${
        active
          ? 'border-fg text-fg'
          : 'border-border text-fg-muted hover:border-fg hover:text-fg'
      }`}
    >
      {children}
    </Link>
  );
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ ver?: string; area?: string }>;
}) {
  const { supabase } = await requirePermission('business.control');
  const query = await searchParams;
  const view: View =
    query.ver === 'hechas' || query.ver === 'todas' ? query.ver : 'abiertas';
  const area = isOneOf(CONTROL_AREAS, query.area) ? query.area : null;
  const today = madridToday();
  const tasks = await listTasks(supabase);
  const counts = countTasks(tasks, today);
  const shown = sortTasks(tasks).filter(
    (t) =>
      (!area || t.area === area) &&
      (view === 'todas' || (view === 'abiertas') === isOpenTask(t)),
  );

  return (
    <main>
      <PageHeader eyebrow="Proyecto" title="Tareas">
        <Link
          href={`/admin/control/tareas/nueva${area ? `?area=${area}` : ''}`}
          className={buttonClass('primary', 'md')}
        >
          Nueva tarea
        </Link>
      </PageHeader>

      <p className="text-fg-muted mb-8 text-sm">
        {counts.open} abiertas · {counts.overdue} vencidas · {counts.blocked}{' '}
        bloqueadas · {counts.waitingOnClient} esperan al cliente
      </p>

      <div className="mb-8 flex flex-wrap gap-x-6 gap-y-3">
        <nav aria-label="Estado" className="flex flex-wrap gap-2">
          {(Object.keys(VIEWS) as View[]).map((v) => (
            <Chip key={v} href={filterHref(v, area)} active={v === view}>
              {VIEWS[v]}
            </Chip>
          ))}
        </nav>
        <nav aria-label="Área" className="flex flex-wrap gap-2">
          <Chip href={filterHref(view, null)} active={area === null}>
            Todas las áreas
          </Chip>
          {CONTROL_AREAS.map((a) => (
            <Chip key={a} href={filterHref(view, a)} active={a === area}>
              {AREA_LABELS[a]}
            </Chip>
          ))}
        </nav>
      </div>

      {shown.length === 0 ? (
        <EmptyState
          title={view === 'hechas' ? 'Ninguna tarea hecha' : 'Nada pendiente'}
          description={
            tasks.length === 0
              ? 'Apunta lo que falta por hacer en el proyecto o en el negocio, quién tiene que moverlo y para cuándo.'
              : undefined
          }
        />
      ) : (
        <ul className="divide-border border-border divide-y border-y">
          {shown.map((task) => {
            const overdue = isOpenTask(task) && isOverdue(task, today);
            const soon = isOpenTask(task) && isDueSoon(task, today);
            return (
              <li
                key={task.id}
                className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/admin/control/tareas/${task.id}`}
                    className={`inline-flex min-h-11 items-center text-sm hover:underline ${task.status === 'done' ? 'text-fg-muted line-through' : ''}`}
                  >
                    {task.title}
                  </Link>
                  <p className="text-fg-muted flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                    <Badge tone={STATUS_TONES[task.status]}>
                      {TASK_STATUS_LABELS[task.status]}
                    </Badge>
                    <span>{AREA_LABELS[task.area]}</span>
                    <span aria-hidden="true">·</span>
                    <span>{TASK_OWNER_LABELS[task.owner]}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      Prioridad{' '}
                      {TASK_PRIORITY_LABELS[task.priority].toLowerCase()}
                    </span>
                    {task.dueOn && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span
                          className={
                            overdue
                              ? 'text-danger font-semibold'
                              : soon
                                ? 'text-fg'
                                : ''
                          }
                        >
                          {overdue ? 'Vencida el ' : 'Para el '}
                          {dayLabel(task.dueOn)}
                        </span>
                      </>
                    )}
                  </p>
                </div>
                <TaskDoneToggle
                  id={task.id}
                  status={task.status}
                  title={task.title}
                />
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
