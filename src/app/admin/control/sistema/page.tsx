import type { Metadata } from 'next';
import {
  BACKUP_STALE_HOURS,
  REPO_MIGRATIONS,
  dayLabel,
  formatBytes,
  hoursSince,
  integer,
  madridDateTime,
  madridToday,
  migrationDiff,
  percent,
} from '@/modules/control';
import {
  getEnvStatus,
  getSystemStatus,
  listBackups,
  requireControl,
} from '@/modules/control/server';
import {
  ConsoleHeader,
  ConsoleNotice,
  ConsoleSection,
  KeyFigure,
} from '@/modules/control/ui';
import { ratioBp } from '@/lib/money';
import { Badge, Table } from '@/components/ui';

export const metadata: Metadata = { title: 'Estado' };

/**
 * Límite de la base en el plan Free de Supabase: al pasar de 500 MB, la base
 * queda en solo lectura (documentación de Supabase consultada el 11/10/2026).
 */
const FREE_DATABASE_BYTES = 500_000_000;

const ENVIRONMENTS = {
  production: { label: 'Producción', tone: 'accent' },
  preview: { label: 'Preview', tone: 'warning' },
  development: { label: 'Desarrollo', tone: 'neutral' },
  local: { label: 'Local', tone: 'neutral' },
} as const;

export default async function SystemPage() {
  const { supabase } = await requireControl();
  const now = new Date();
  const [status, backups] = await Promise.all([
    getSystemStatus(supabase),
    listBackups(supabase, 30),
  ]);
  const env = getEnvStatus();
  const diff = status.migrations
    ? migrationDiff(REPO_MIGRATIONS, status.migrations)
    : null;
  const dbShareBp = ratioBp(status.database.size_bytes, FREE_DATABASE_BYTES);
  // Solo cuenta la copia diaria: la descarga al momento no se guarda.
  const scheduled = backups.filter((b) => b.kind === 'scheduled');
  const lastBackup = scheduled.find((b) => b.status === 'ok') ?? null;
  const backupHours = lastBackup ? hoursSince(lastBackup.createdAt, now) : null;
  const backupStale =
    backupHours === null ||
    backupHours > BACKUP_STALE_HOURS ||
    scheduled[0]?.status === 'error';
  const required = env.variables.filter(
    (v) => v.name !== 'SUPABASE_BACKUPS_TOKEN',
  );
  const missing = required.filter((v) => !v.configured);
  const tables = [...status.tables]
    .sort((a, b) => b.total_bytes - a.total_bytes)
    .slice(0, 15);
  const storageBytes = status.storage.reduce((s, b) => s + b.bytes, 0);
  const environment = ENVIRONMENTS[env.environment];

  return (
    <main>
      <ConsoleHeader
        section="Sistema"
        title="Estado del sistema"
        description={`Base de datos, migraciones, variables de entorno, cuentas, archivos y tareas programadas. Datos de ${madridDateTime(status.generated_at)}.`}
      >
        <Badge tone={environment.tone}>{environment.label}</Badge>
        {env.region && <Badge tone="neutral">Región {env.region}</Badge>}
        {env.commit && <Badge tone="neutral">Commit {env.commit}</Badge>}
      </ConsoleHeader>

      {diff && diff.pending.length > 0 && (
        <div className="mb-6">
          <ConsoleNotice
            tone="danger"
            title={`${diff.pending.length} migraciones del código sin aplicar en esta base`}
          >
            <p>
              Las pantallas que dependen de ellas fallarán hasta aplicarlas. Las
              migraciones remotas se aplican con autorización, con el conector
              de Supabase, y con la misma versión que en supabase/migrations.
            </p>
          </ConsoleNotice>
        </div>
      )}

      <div className="grid grid-cols-4 gap-3">
        <KeyFigure
          label="Base de datos"
          value={formatBytes(status.database.size_bytes)}
          tone={dbShareBp !== null && dbShareBp >= 8000 ? 'alert' : 'default'}
          note={`${percent(dbShareBp)} de los 500 MB del plan Free (después, solo lectura)`}
        />
        <KeyFigure
          label="Migraciones"
          value={
            diff
              ? diff.pending.length === 0
                ? 'Al día'
                : `${diff.pending.length} pendientes`
              : '—'
          }
          tone={diff && diff.pending.length > 0 ? 'alert' : 'default'}
          note={
            diff
              ? `${diff.applied} aplicadas · ${REPO_MIGRATIONS.length} en el código`
              : 'No se puede leer el registro de migraciones'
          }
        />
        <KeyFigure
          label="Variables"
          value={`${required.length - missing.length}/${required.length}`}
          tone={missing.length > 0 ? 'alert' : 'default'}
          note={
            missing.length === 0
              ? 'Todas las necesarias configuradas'
              : `Faltan: ${missing.map((v) => v.name).join(', ')}`
          }
        />
        <KeyFigure
          label="Última copia diaria"
          value={
            lastBackup
              ? dayLabel(madridToday(new Date(lastBackup.createdAt)))
              : '—'
          }
          tone={backupStale ? 'alert' : 'default'}
          note={
            scheduled[0]?.status === 'error'
              ? 'La última falló'
              : lastBackup
                ? `${madridDateTime(lastBackup.createdAt)} · ${formatBytes(lastBackup.sizeBytes)}`
                : 'Aún no hay copias diarias'
          }
          href="/admin/control/copias"
        />
      </div>

      <div className="mt-3 grid grid-cols-4 gap-3">
        <KeyFigure
          label="Cuentas"
          value={status.auth.users}
          note={`${status.auth.confirmed} confirmadas · ${status.auth.with_totp} con MFA`}
        />
        <KeyFigure
          label="Archivos"
          value={formatBytes(storageBytes)}
          note={`${integer(status.storage.reduce((s, b) => s + b.objects, 0))} archivos en ${status.storage.length} buckets`}
        />
        <KeyFigure
          label="Informe diario"
          value={
            status.daily_report
              ? dayLabel(status.daily_report.report_date)
              : '—'
          }
          note={
            status.daily_report
              ? `${status.daily_report.by_cron ? 'Programado' : 'Manual'} · ${status.daily_report.has_summary ? 'con resumen' : 'sin resumen del asistente'}`
              : 'Todavía no se ha generado'
          }
        />
        <KeyFigure
          label="Visitas 30 días"
          value={
            status.attention_30d === null ? '—' : integer(status.attention_30d)
          }
          note="Eventos anónimos de la tienda"
          href="/admin/control/atencion"
        />
      </div>

      <div className="mt-10 flex flex-col gap-10">
        <ConsoleSection
          id="variables"
          title="Variables de entorno"
          className=""
        >
          <Table
            caption="Variables de entorno (solo si están configuradas, nunca su valor)"
            stacked={false}
            density="compact"
          >
            <thead>
              <tr>
                <th>Variable</th>
                <th>Para qué</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {env.variables.map((v) => (
                <tr key={v.name}>
                  <td className="font-mono text-xs">{v.name}</td>
                  <td className="text-fg-muted">{v.use}</td>
                  <td>
                    {v.configured ? (
                      <Badge tone="success">Configurada</Badge>
                    ) : (
                      <Badge
                        tone={
                          v.name === 'SUPABASE_BACKUPS_TOKEN'
                            ? 'neutral'
                            : 'danger'
                        }
                      >
                        {v.name === 'SUPABASE_BACKUPS_TOKEN'
                          ? 'Opcional'
                          : 'Falta'}
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          <p className="text-fg-muted mt-2 text-xs">
            Límite diario del asistente: {env.assistantDailyLimit} consultas por
            persona (ASSISTANT_DAILY_LIMIT).
          </p>
        </ConsoleSection>

        <ConsoleSection id="migraciones" title="Migraciones" className="">
          {!diff ? (
            <p className="text-fg-muted text-sm">
              Esta base no tiene registro de migraciones de Supabase.
            </p>
          ) : (
            <>
              {diff.pending.length === 0 && diff.unknown.length === 0 && (
                <p className="text-fg-muted mb-3 text-sm">
                  Las {REPO_MIGRATIONS.length} migraciones del código están
                  aplicadas.
                </p>
              )}
              {(diff.pending.length > 0 || diff.unknown.length > 0) && (
                <Table
                  caption="Diferencias entre el código y la base"
                  stacked={false}
                  density="compact"
                >
                  <thead>
                    <tr>
                      <th>Versión</th>
                      <th>Nombre</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diff.pending.map((m) => (
                      <tr key={m.version}>
                        <td className="font-mono text-xs">{m.version}</td>
                        <td>{m.name}</td>
                        <td>
                          <Badge tone="danger">Sin aplicar</Badge>
                        </td>
                      </tr>
                    ))}
                    {diff.unknown.map((m) => (
                      <tr key={m.version}>
                        <td className="font-mono text-xs">{m.version}</td>
                        <td>{m.name ?? '—'}</td>
                        <td>
                          <Badge tone="warning">No está en el código</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
              <p className="text-fg-muted mt-2 text-xs">
                Última del código:{' '}
                <span className="font-mono">
                  {REPO_MIGRATIONS.at(-1)?.[0]} {REPO_MIGRATIONS.at(-1)?.[1]}
                </span>
              </p>
            </>
          )}
        </ConsoleSection>
      </div>

      <div className="mt-10 grid grid-cols-[2fr_1fr] gap-8">
        <ConsoleSection id="tablas" title="Tablas más grandes" className="">
          <Table
            caption="Tablas por espacio ocupado (datos e índices)"
            stacked={false}
            density="compact"
          >
            <thead>
              <tr>
                <th>Tabla</th>
                <th className="text-right">Filas aprox.</th>
                <th className="text-right">Espacio</th>
              </tr>
            </thead>
            <tbody>
              {tables.map((t) => (
                <tr key={`${t.schema}.${t.name}`}>
                  <td className="font-mono text-xs">
                    <span className="text-fg-muted">{t.schema}.</span>
                    {t.name}
                  </td>
                  <td className="text-right font-mono tabular-nums">
                    {integer(t.rows)}
                  </td>
                  <td className="text-right font-mono tabular-nums">
                    {formatBytes(t.total_bytes)}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </ConsoleSection>

        <div className="flex flex-col gap-8">
          <ConsoleSection
            id="archivos"
            title="Archivos por bucket"
            className=""
          >
            {status.storage.length === 0 ? (
              <p className="text-fg-muted text-sm">No hay buckets.</p>
            ) : (
              <Table
                caption="Archivos por bucket de Storage"
                stacked={false}
                density="compact"
              >
                <thead>
                  <tr>
                    <th>Bucket</th>
                    <th className="text-right">Archivos</th>
                    <th className="text-right">Tamaño</th>
                  </tr>
                </thead>
                <tbody>
                  {status.storage.map((b) => (
                    <tr key={b.bucket}>
                      <td className="font-mono text-xs">{b.bucket}</td>
                      <td className="text-right font-mono tabular-nums">
                        {integer(b.objects)}
                      </td>
                      <td className="text-right font-mono tabular-nums">
                        {formatBytes(b.bytes)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </ConsoleSection>

          <ConsoleSection id="suscriptores" title="Suscriptores" className="">
            <dl className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <dt className="text-fg-muted text-xs">Activos</dt>
                <dd className="font-mono text-lg tabular-nums">
                  {integer(status.newsletter.active)}
                </dd>
              </div>
              <div>
                <dt className="text-fg-muted text-xs">Bajas</dt>
                <dd className="font-mono text-lg tabular-nums">
                  {integer(status.newsletter.unsubscribed)}
                </dd>
              </div>
              <div>
                <dt className="text-fg-muted text-xs">Sin enviar a Sender</dt>
                <dd
                  className={`font-mono text-lg tabular-nums ${status.newsletter.pending_sender > 0 ? 'text-warning' : ''}`}
                >
                  {integer(status.newsletter.pending_sender)}
                </dd>
              </div>
            </dl>
          </ConsoleSection>
        </div>
      </div>
    </main>
  );
}
