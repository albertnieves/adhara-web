import { cronGuard } from '@/lib/cron';
import { createJobClient } from '@/lib/supabase/privileged';
import {
  backupStoragePath,
  expiredBackups,
  madridStamp,
} from '@/modules/control';
import { backupSourceFrom, buildBackup } from '@/modules/control/server';

/**
 * Copia diaria de la consola (Vercel Cron, vercel.json): exporta los datos del
 * negocio, los sube al bucket privado system-backups, lo registra y borra las
 * copias de más de 30 días. Solo responde a quien envía CRON_SECRET y usa la
 * clave privilegiada únicamente para esto (DECISIONS §128).
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BUCKET = 'system-backups';

export async function GET(request: Request) {
  const denied = cronGuard(request);
  if (denied) return denied;
  const client = createJobClient();
  if (!client)
    return Response.json(
      { ok: false, message: 'SUPABASE_SECRET_KEY no configurada' },
      { status: 503 },
    );

  const now = new Date();
  let path = backupStoragePath(now);
  try {
    const backup = await buildBackup(backupSourceFrom(client), now);
    const upload = (target: string) =>
      client.storage.from(BUCKET).upload(target, backup.gzip, {
        contentType: 'application/gzip',
        upsert: false,
      });
    let { error } = await upload(path);
    if (error) {
      // Ya había copia de hoy: se guarda otra con la hora.
      path = backupStoragePath(now, true);
      ({ error } = await upload(path));
    }
    if (error) throw new Error(`subida: ${error.message}`);

    await client.rpc('admin_control_log_backup', {
      p_kind: 'scheduled',
      p_path: path,
      p_size_bytes: backup.sizeBytes,
      p_sha256: backup.sha256,
      p_table_rows: backup.rowCounts,
      p_status: 'ok',
    });

    // Retención: se listan los meses de la carpeta db/ y se borra lo antiguo.
    const removed = await pruneOldBackups(client, madridStamp(now).day);
    return Response.json({
      ok: true,
      path,
      sizeBytes: backup.sizeBytes,
      removed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'error';
    console.error('[copias] copia diaria', message);
    await client.rpc('admin_control_log_backup', {
      p_kind: 'scheduled',
      p_path: path,
      p_size_bytes: 0,
      p_sha256: '',
      p_table_rows: {},
      p_status: 'error',
      p_error: message.slice(0, 200),
    });
    return Response.json({ ok: false }, { status: 500 });
  }
}

type JobClient = NonNullable<ReturnType<typeof createJobClient>>;

async function pruneOldBackups(client: JobClient, today: string) {
  const bucket = client.storage.from(BUCKET);
  const { data: years } = await bucket.list('db', { limit: 100 });
  const paths: string[] = [];
  for (const year of years ?? []) {
    const { data: months } = await bucket.list(`db/${year.name}`, {
      limit: 100,
    });
    for (const month of months ?? []) {
      const { data: files } = await bucket.list(
        `db/${year.name}/${month.name}`,
        { limit: 1000 },
      );
      for (const file of files ?? [])
        paths.push(`db/${year.name}/${month.name}/${file.name}`);
    }
  }
  const expired = expiredBackups(paths, today);
  if (expired.length > 0) await bucket.remove(expired);
  return expired.length;
}
