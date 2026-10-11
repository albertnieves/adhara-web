import { MAX_DOWNLOAD_BYTES, backupFileName } from '@/modules/control';
import {
  backupSourceFrom,
  buildBackup,
  requireControl,
} from '@/modules/control/server';

/**
 * Descarga al momento de una copia completa de los datos del negocio, con la
 * sesión del titular. Se registra como copia manual (sin ruta: no se guarda en
 * el bucket). Vercel corta las respuestas de más de 4,5 MB: si la copia pasa
 * de 4 MB, se avisa y queda la copia diaria del bucket.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  const { supabase } = await requireControl();
  const now = new Date();
  const backup = await buildBackup(backupSourceFrom(supabase), now);
  await supabase.rpc('admin_control_log_backup', {
    p_kind: 'manual',
    p_path: '',
    p_size_bytes: backup.sizeBytes,
    p_sha256: backup.sha256,
    p_table_rows: backup.rowCounts,
    p_status: 'ok',
  });
  if (backup.sizeBytes > MAX_DOWNLOAD_BYTES)
    return new Response(
      'La copia pasa de 4 MB y no se puede descargar desde aquí: descarga la última copia diaria del bucket o pide una copia con supabase db dump.',
      {
        status: 413,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'private, no-store',
        },
      },
    );
  return new Response(new Uint8Array(backup.gzip), {
    headers: {
      'Content-Type': 'application/gzip',
      'Content-Disposition': `attachment; filename="${backupFileName(now)}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
