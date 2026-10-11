import { z } from 'zod';

/**
 * Copias de seguridad lógicas de la consola: un JSON con las filas de las
 * tablas de la lista blanca de admin_control_export_catalog, comprimido con
 * gzip. Cubre los datos del negocio de la base; no las fotos de Storage, las
 * cuentas de Auth ni la pérdida del proyecto (DECISIONS §119).
 */

export const BACKUP_FORMAT = 'latelier-backup';
export const BACKUP_VERSION = 1;
/** Días que se guardan las copias diarias en el bucket. */
export const BACKUP_RETENTION_DAYS = 30;
/** Filas por llamada a admin_control_export (máximo de la función: 10000). */
export const BACKUP_PAGE_SIZE = 5000;
/** Vercel corta las respuestas de más de 4,5 MB: margen para la descarga. */
export const MAX_DOWNLOAD_BYTES = 4_000_000;
/** Sin copia correcta en más de estas horas, la consola avisa. */
export const BACKUP_STALE_HOURS = 36;

export const BACKUP_PATH_PATTERN =
  /^db\/\d{4}\/\d{2}\/\d{4}-\d{2}-\d{2}(?:-\d{4})?\.json\.gz$/;

const MADRID = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Madrid',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Fecha y hora de Madrid: { day: 'YYYY-MM-DD', hhmm: 'HHmm' }. */
export function madridStamp(now: Date): { day: string; hhmm: string } {
  const parts = Object.fromEntries(
    MADRID.formatToParts(now).map((p) => [p.type, p.value]),
  );
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    hhmm: `${parts.hour}${parts.minute}`,
  };
}

/** Nombre del archivo descargado: latelier-copia-2026-10-11-1730.json.gz. */
export function backupFileName(now: Date): string {
  const { day, hhmm } = madridStamp(now);
  return `latelier-copia-${day}-${hhmm}.json.gz`;
}

/** Ruta en el bucket: db/2026/10/2026-10-11.json.gz (con -HHmm si se repite). */
export function backupStoragePath(now: Date, withTime = false): string {
  const { day, hhmm } = madridStamp(now);
  const [year, month] = day.split('-');
  return `db/${year}/${month}/${day}${withTime ? `-${hhmm}` : ''}.json.gz`;
}

/** Día de la copia según su ruta, o null si la ruta no es de una copia. */
export function backupDayOf(path: string): string | null {
  if (!BACKUP_PATH_PATTERN.test(path)) return null;
  return path.slice(11, 21);
}

/** Copias de más de `days` días respecto a `today` (YYYY-MM-DD de Madrid). */
export function expiredBackups(
  paths: readonly string[],
  today: string,
  days = BACKUP_RETENTION_DAYS,
): string[] {
  const limit = Date.parse(`${today}T00:00:00Z`) - days * 86_400_000;
  return paths.filter((path) => {
    const day = backupDayOf(path);
    return day !== null && Date.parse(`${day}T00:00:00Z`) < limit;
  });
}

/** Horas desde una fecha ISO hasta `now`. */
export function hoursSince(iso: string, now: Date): number {
  return (now.getTime() - Date.parse(iso)) / 3_600_000;
}

export const backupDocumentSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(BACKUP_VERSION),
  generated_at: z.string(),
  source: z.object({
    supabase_ref: z.string().nullable(),
    app_migration: z.string().nullable(),
  }),
  row_counts: z.record(z.string(), z.number().int().nonnegative()),
  tables: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))),
});

export type BackupDocument = z.infer<typeof backupDocumentSchema>;

/** Referencia del proyecto a partir de su URL (<ref>.supabase.co); null en local. */
export function supabaseRefOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const { hostname } = new URL(url);
    const match = /^([a-z0-9]{20})\.supabase\.co$/.exec(hostname);
    return match ? match[1]! : null;
  } catch {
    return null;
  }
}

/** Tamaño legible: 1,2 MB, 340 kB, 512 B. */
export function formatBytes(bytes: number | null): string {
  if (bytes === null) return '—';
  const units = ['B', 'kB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }
  const digits = unit === 0 || value >= 100 ? 0 : 1;
  return `${value.toLocaleString('es-ES', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} ${units[unit]}`;
}
