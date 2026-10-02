import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/modules/admin';
import {
  DAILY_TASK_KEYS,
  DAILY_TASK_PERMISSIONS,
  isReportDay,
  previousDay,
} from '@/modules/assistant';
import {
  canStoreReports,
  collectDailyReport,
  getStoredReport,
  isAssistantConfigured,
  listReportDays,
} from '@/modules/assistant/server';
import { AssistantChat } from '@/modules/assistant/ui/AssistantChat';
import {
  DailyReportView,
  reportDayLabel,
} from '@/modules/assistant/ui/DailyReportView';
import { GenerateReportButton } from '@/modules/assistant/ui/GenerateReportButton';
import { isAllowed } from '@/modules/auth';
import { requirePermission } from '@/modules/auth/server';
import { madridDay } from '@/modules/reports';

export const metadata: Metadata = { title: 'Asistente' };

const TIME = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Madrid',
});

export default async function AssistantPage({
  searchParams,
}: {
  searchParams: Promise<{ dia?: string }>;
}) {
  const staff = await requirePermission('agent.use');
  const can = (permission: Parameters<typeof isAllowed>[1]) =>
    isAllowed({ role: staff.role, aal: 'aal2' }, permission);
  const visibleTasks = new Set(
    DAILY_TASK_KEYS.filter((key) => can(DAILY_TASK_PERMISSIONS[key])),
  );
  const { dia } = await searchParams;
  const today = madridDay(new Date());
  const day = isReportDay(dia) && dia <= today ? dia : today;
  const [stored, days] = await Promise.all([
    getStoredReport(staff.supabase, day),
    listReportDays(staff.supabase),
  ]);
  const live = stored ? null : await collectDailyReport(staff.supabase, day);
  const report = stored?.report ?? live?.report ?? null;
  const shortcuts = [
    { day: today, label: 'Hoy' },
    { day: previousDay(today), label: 'Ayer' },
    ...days
      .filter((d) => d.day < previousDay(today))
      .slice(0, 7)
      .map((d) => ({ day: d.day, label: reportDayLabel(d.day) })),
  ];

  return (
    <main>
      <PageHeader eyebrow="Asistente de inventario" title="Informe del día">
        <a href="#preguntar" className="panel-btn xl:hidden">
          Preguntar ↓
        </a>
      </PageHeader>

      <div className="grid gap-12 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="min-w-0">
          <nav aria-label="Días" className="mb-6 flex flex-wrap gap-2">
            {shortcuts.map((s) => (
              <Link
                key={s.day}
                href={
                  s.day === today
                    ? '/admin/asistente'
                    : `/admin/asistente?dia=${s.day}`
                }
                aria-current={s.day === day ? 'page' : undefined}
                className={`inline-flex min-h-10 items-center border px-3 text-xs tracking-[0.12em] uppercase ${s.day === day ? 'border-ink bg-ink text-ivory' : 'border-line hover:border-ink'}`}
              >
                {s.label}
              </Link>
            ))}
          </nav>

          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <p className="text-smoke text-sm first-letter:uppercase">
              {reportDayLabel(day)}
              {day === today && ' · hasta ahora'}
              <span className="block text-xs">
                {stored
                  ? `Guardado el ${TIME.format(new Date(stored.generatedAt))}${stored.generatedBy ? '' : ' por la tarea programada'}.`
                  : 'Calculado en directo; sin guardar.'}
              </span>
            </p>
            {canStoreReports() && can('reports.view') && (
              <GenerateReportButton
                day={day}
                label={
                  !isAssistantConfigured()
                    ? 'Guardar informe'
                    : stored?.summary
                      ? 'Actualizar con resumen'
                      : 'Guardar con resumen'
                }
              />
            )}
          </div>

          {report ? (
            <DailyReportView
              report={report}
              summary={stored?.summary ?? null}
              visibleTasks={visibleTasks}
            />
          ) : (
            <p className="text-smoke">No hay ninguna ubicación activa.</p>
          )}
        </div>

        <aside
          aria-labelledby="preguntar"
          className="xl:sticky xl:top-8 xl:self-start"
        >
          <h2 id="preguntar" className="mb-4 scroll-mt-6 text-2xl font-light">
            Pregunta al asistente
          </h2>
          <AssistantChat configured={isAssistantConfigured()} />
        </aside>
      </div>
    </main>
  );
}
