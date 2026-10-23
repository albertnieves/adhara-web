import type { Metadata } from 'next';
import {
  BACKUP_RETENTION_DAYS,
  BACKUP_STALE_HOURS,
  expiredBackups,
  formatBytes,
  hoursSince,
  integer,
  madridDateTime,
  madridToday,
} from '@/modules/control';
import {
  getEnvStatus,
  getPlatformBackups,
  listBackups,
  requireControl,
} from '@/modules/control/server';
import type { BackupRecord, PlatformBackups } from '@/modules/control/server';
import {
  ConsoleHeader,
  ConsoleNotice,
  ConsoleSection,
  KeyFigure,
} from '@/modules/control/ui';
import { Badge, Table, buttonClass } from '@/components/ui';

export const metadata: Metadata = { title: 'Copias' };

function totalRows(backup: BackupRecord) {
  return Object.values(backup.tableRows).reduce((sum, n) => sum + n, 0);
}

function hoursLabel(hours: number) {
  if (hours < 1) return 'hace menos de 1 hora';
  if (hours < 48) return `hace ${Math.floor(hours)} h`;
  return `hace ${Math.floor(hours / 24)} días`;
}

export default async function BackupsPage() {
  const { supabase } = await requireControl();
  const now = new Date();
  const today = madridToday(now);
  const [backups, platform] = await Promise.all([
    listBackups(supabase, 90),
    getPlatformBackups(),
  ]);
  const env = getEnvStatus();
  const configured = (name: string) =>
    env.variables.find((v) => v.name === name)?.configured ?? false;

  const lastScheduled = backups.find(
    (b) => b.kind === 'scheduled' && b.status === 'ok',
  );
  const lastError = backups.find((b) => b.status === 'error');
  const ageHours = lastScheduled
    ? hoursSince(lastScheduled.createdAt, now)
    : null;
  const stale = ageHours === null || ageHours > BACKUP_STALE_HOURS;
  const failedAfterLast =
    lastError &&
    (!lastScheduled ||
      Date.parse(lastError.createdAt) > Date.parse(lastScheduled.createdAt));
  const stored = backups.filter(
    (b) =>
      b.status === 'ok' &&
      b.path &&
      expiredBackups([b.path], today).length === 0,
  );
  const storedBytes = stored.reduce((sum, b) => sum + (b.sizeBytes ?? 0), 0);

  return (
    <main>
      <ConsoleHeader
        section="Sistema"
        title="Copias de seguridad"
        description={`Copia diaria de los datos del negocio en un bucket privado de Supabase (solo tu cuenta puede leerlo), guardada ${BACKUP_RETENTION_DAYS} días, y copias de la propia plataforma si hay token.`}
      >
        {/* Formulario GET y no enlace: navegación completa, así la copia se
            descarga y, si pasa de 4 MB, se ve el aviso. */}
        <form action="/admin/control/copias/descargar" method="get">
          <button type="submit" className={buttonClass('primary', 'md')}>
            Descargar copia ahora
          </button>
        </form>
      </ConsoleHeader>

      {(stale || failedAfterLast) && (
        <div className="mb-6 grid gap-3">
          {stale && (
            <ConsoleNotice
              tone="danger"
              title={
                lastScheduled
                  ? `La última copia diaria es de ${madridDateTime(lastScheduled.createdAt)} (${hoursLabel(ageHours!)})`
                  : 'Todavía no hay ninguna copia diaria'
              }
            >
              <p>
                La tarea programada corre cada noche a las 03:30 UTC en Vercel.
                Necesita CRON_SECRET y SUPABASE_SECRET_KEY en el entorno de
                producción y la migración de copias aplicada en la base.
              </p>
            </ConsoleNotice>
          )}
          {failedAfterLast && lastError && (
            <ConsoleNotice
              tone="danger"
              title={`Falló la copia de ${madridDateTime(lastError.createdAt)}`}
            >
              <p>{lastError.error ?? 'Sin detalle del error.'}</p>
            </ConsoleNotice>
          )}
        </div>
      )}

      <div className="grid grid-cols-4 gap-3">
        <KeyFigure
          label="Última copia diaria"
          value={lastScheduled ? hoursLabel(ageHours!) : '—'}
          tone={stale ? 'alert' : 'default'}
          note={
            lastScheduled
              ? `${madridDateTime(lastScheduled.createdAt)} · ${formatBytes(lastScheduled.sizeBytes)}`
              : `Aviso si pasan más de ${BACKUP_STALE_HOURS} h`
          }
        />
        <KeyFigure
          label="Copias guardadas"
          value={stored.length}
          note={`${formatBytes(storedBytes)} en el bucket · ${BACKUP_RETENTION_DAYS} días`}
        />
        <KeyFigure
          label="Filas en la última copia"
          value={lastScheduled ? integer(totalRows(lastScheduled)) : '—'}
          note={
            lastScheduled
              ? `${Object.keys(lastScheduled.tableRows).length} tablas`
              : 'Catálogo, stock, ventas, costes…'
          }
        />
        <KeyFigure
          label="Tarea programada"
          value={
            configured('CRON_SECRET') && configured('SUPABASE_SECRET_KEY')
              ? 'Lista'
              : 'Incompleta'
          }
          tone={
            configured('CRON_SECRET') && configured('SUPABASE_SECRET_KEY')
              ? 'default'
              : 'alert'
          }
          note={`CRON_SECRET: ${configured('CRON_SECRET') ? 'sí' : 'no'} · SUPABASE_SECRET_KEY: ${configured('SUPABASE_SECRET_KEY') ? 'sí' : 'no'}`}
        />
      </div>

      <ConsoleSection id="registro" title="Registro de copias">
        {backups.length === 0 ? (
          <p className="text-fg-muted border-border border-y py-8 text-center text-sm">
            Aún no se ha hecho ninguna copia. La primera llegará esta noche o al
            pulsar «Descargar copia ahora».
          </p>
        ) : (
          <Table
            caption="Copias registradas, de la más reciente a la más antigua"
            stacked={false}
            density="compact"
            stickyHeader
          >
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th className="text-right">Tamaño</th>
                <th className="text-right">Tablas</th>
                <th className="text-right">Filas</th>
                <th>SHA-256</th>
                <th>
                  <span className="sr-only">Archivo</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {backups.map((b) => {
                const available =
                  b.status === 'ok' &&
                  b.path &&
                  expiredBackups([b.path], today).length === 0;
                return (
                  <tr key={b.id}>
                    <td className="font-mono tabular-nums">
                      {madridDateTime(b.createdAt)}
                    </td>
                    <td>{b.kind === 'scheduled' ? 'Diaria' : 'Descarga'}</td>
                    <td>
                      {b.status === 'ok' ? (
                        <Badge tone="success">Correcta</Badge>
                      ) : (
                        <Badge tone="danger">Error</Badge>
                      )}
                      {b.error && (
                        <span className="text-fg-muted block max-w-80 truncate text-xs">
                          {b.error}
                        </span>
                      )}
                    </td>
                    <td className="text-right font-mono tabular-nums">
                      {formatBytes(b.sizeBytes)}
                    </td>
                    <td className="text-right font-mono tabular-nums">
                      {Object.keys(b.tableRows).length || '—'}
                    </td>
                    <td className="text-right font-mono tabular-nums">
                      {b.status === 'ok' ? integer(totalRows(b)) : '—'}
                    </td>
                    <td className="text-fg-muted font-mono text-xs">
                      {b.sha256 ? (
                        <span title={b.sha256}>{b.sha256.slice(0, 12)}…</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="text-right">
                      {available ? (
                        <a
                          href={`/admin/control/copias/archivo?ruta=${encodeURIComponent(b.path!)}`}
                          className="text-accent-fg hover:text-fg inline-flex min-h-6 items-center text-xs underline-offset-4 hover:underline"
                        >
                          Descargar
                        </a>
                      ) : (
                        <span className="text-fg-muted text-xs">
                          {b.kind === 'manual'
                            ? 'Descargada'
                            : b.status === 'ok'
                              ? 'Caducada'
                              : ''}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </ConsoleSection>

      <ConsoleSection id="plataforma" title="Copias de la plataforma Supabase">
        <PlatformSection platform={platform} />
      </ConsoleSection>

      <div className="mt-10 grid grid-cols-2 gap-6">
        <ConsoleSection id="cubre" title="Qué cubre" className="">
          <ul className="text-fg-muted list-disc space-y-1 pl-5 text-sm">
            <li>
              Las tablas del negocio: catálogo, formatos y fichas, historial de
              precios y costes, stock y movimientos, ventas del mostrador,
              proveedores y pedidos de compra, costes, tareas y entregas, equipo
              y permisos, contenido editable, informes, suscriptores, visitas y
              auditoría.
            </li>
            <li>
              Un archivo JSON comprimido con su huella SHA-256 y el número de
              filas por tabla, para comprobar que está completo.
            </li>
            <li>
              Cada tabla se lee por separado: si alguien edita durante la copia
              (unos segundos de madrugada), dos tablas pueden no coincidir del
              todo.
            </li>
          </ul>
          <p className="mt-4 text-sm font-semibold">Qué no cubre</p>
          <ul className="text-fg-muted mt-1 list-disc space-y-1 pl-5 text-sm">
            <li>
              Las fotos de Storage (las originales deben seguir en su carpeta de
              origen).
            </li>
            <li>
              Las cuentas de Auth: contraseñas y MFA no se exportan; al
              restaurar se crean cuentas mínimas y cada persona vuelve a entrar
              con invitación.
            </li>
            <li>
              La pérdida del proyecto de Supabase entero: para eso están las
              copias de la plataforma (plan de pago) o descargar una copia de
              vez en cuando y guardarla fuera.
            </li>
          </ul>
        </ConsoleSection>
        <ConsoleSection id="restaurar" title="Cómo restaurar" className="">
          <ol className="text-fg-muted list-decimal space-y-2 pl-5 text-sm">
            <li>
              Descarga la copia y pruébala primero en local:
              <code className="bg-surface-sunken mt-1 block overflow-x-auto px-2 py-1 font-mono text-xs whitespace-pre">
                {
                  'node scripts/local-env.ts node scripts/restore-backup.ts \\\n  copia.json.gz --dry-run'
                }
              </code>
            </li>
            <li>
              El simulacro carga todo en una transacción, comprueba las filas de
              cada tabla y la deshace. Sin{' '}
              <code className="whitespace-nowrap">--dry-run</code>, sustituye el
              contenido de esas tablas en la base local.
            </li>
            <li>
              Restaurar en atelier-dev o en producción es una decisión tuya y se
              hace a mano, nunca desde la consola ni desde un script del
              repositorio.
            </li>
          </ol>
        </ConsoleSection>
      </div>
    </main>
  );
}

function PlatformSection({ platform }: { platform: PlatformBackups }) {
  if (platform.status === 'not_configured')
    return (
      <ConsoleNotice title="Sin token para consultar la plataforma">
        <p>
          Para ver aquí las copias que hace Supabase, crea en Supabase un token
          personal limitado solo a «Backups: Read» de este proyecto y guárdalo
          en Vercel como SUPABASE_BACKUPS_TOKEN (nunca por chat). En el plan
          Free, Supabase no hace copias descargables: la copia diaria de esta
          pantalla es la única.
        </p>
      </ConsoleNotice>
    );
  if (platform.status === 'no_project')
    return (
      <ConsoleNotice title="Proyecto local">
        <p>
          La URL de Supabase no es la de un proyecto alojado: en local no hay
          copias de la plataforma.
        </p>
      </ConsoleNotice>
    );
  if (platform.status === 'error')
    return (
      <ConsoleNotice tone="warning" title="No se pudo consultar Supabase">
        <p>{platform.message}</p>
      </ConsoleNotice>
    );
  const latest =
    platform.physical_backup_data?.latest_physical_backup_date_unix;
  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        <Badge tone={platform.pitr_enabled ? 'success' : 'neutral'}>
          PITR {platform.pitr_enabled ? 'activo' : 'no activo'}
        </Badge>
        <Badge tone="neutral">Región {platform.region}</Badge>
        {latest && (
          <Badge tone="neutral">
            Última física{' '}
            {madridDateTime(new Date(latest * 1000).toISOString())}
          </Badge>
        )}
      </div>
      {platform.backups.length === 0 ? (
        <p className="text-fg-muted border-border border-y py-6 text-center text-sm">
          Supabase no tiene copias de este proyecto (el plan Free no las
          incluye).
        </p>
      ) : (
        <Table
          caption="Copias de la plataforma Supabase"
          stacked={false}
          density="compact"
        >
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {platform.backups.map((b) => (
              <tr key={b.id}>
                <td className="font-mono tabular-nums">
                  {madridDateTime(b.inserted_at)}
                </td>
                <td>{b.is_physical_backup ? 'Física' : 'Lógica'}</td>
                <td>
                  <Badge
                    tone={b.status === 'COMPLETED' ? 'success' : 'warning'}
                  >
                    {b.status === 'COMPLETED' ? 'Completa' : b.status}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <p className="text-fg-muted mt-2 text-xs">
        Las copias de la plataforma se restauran desde el panel de Supabase, no
        desde aquí.
      </p>
    </>
  );
}
