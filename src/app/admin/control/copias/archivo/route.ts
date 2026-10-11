import { notFound } from 'next/navigation';
import { BACKUP_PATH_PATTERN } from '@/modules/control';
import { requireControl } from '@/modules/control/server';

/**
 * Enlace temporal (60 s) a una copia del bucket privado, firmado con la sesión
 * del titular (la política de lectura del bucket solo le deja a él). La URL
 * firmada no se registra en ningún sitio.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { supabase } = await requireControl();
  const path = new URL(request.url).searchParams.get('ruta') ?? '';
  if (!BACKUP_PATH_PATTERN.test(path)) notFound();
  const { data, error } = await supabase.storage
    .from('system-backups')
    .createSignedUrl(path, 60, { download: true });
  if (error || !data) notFound();
  return new Response(null, {
    status: 303,
    headers: { Location: data.signedUrl, 'Cache-Control': 'private, no-store' },
  });
}
