import 'server-only';
import { z } from 'zod';
import { supabaseRefOf } from '../domain/backup';

/*
 * Copias de la plataforma Supabase (Management API). Solo si el titular pone
 * en Vercel SUPABASE_BACKUPS_TOKEN: un token personal LIMITADO a «Backups:
 * Read» de este proyecto (DECISIONS §119). El token no sale de este módulo ni
 * se registra; los errores se resumen sin él.
 */

const backupsSchema = z.object({
  region: z.string(),
  walg_enabled: z.boolean(),
  pitr_enabled: z.boolean(),
  backups: z.array(
    z.object({
      id: z.number(),
      is_physical_backup: z.boolean(),
      status: z.string(),
      inserted_at: z.string(),
    }),
  ),
  physical_backup_data: z
    .object({
      earliest_physical_backup_date_unix: z.number().optional(),
      latest_physical_backup_date_unix: z.number().optional(),
    })
    .optional(),
});

export type PlatformBackups =
  | { status: 'not_configured' }
  | { status: 'no_project' }
  | { status: 'error'; message: string }
  | ({ status: 'ok' } & z.infer<typeof backupsSchema>);

export function backupsTokenConfigured(): boolean {
  return Boolean(process.env.SUPABASE_BACKUPS_TOKEN);
}

export async function getPlatformBackups(): Promise<PlatformBackups> {
  const token = process.env.SUPABASE_BACKUPS_TOKEN;
  if (!token) return { status: 'not_configured' };
  const ref = supabaseRefOf(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (!ref) return { status: 'no_project' };
  try {
    const response = await fetch(
      `https://api.supabase.com/v1/projects/${ref}/database/backups`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
      },
    );
    if (response.status === 401 || response.status === 403)
      return {
        status: 'error',
        message:
          'Supabase rechaza el token: revisa que tenga «Backups: Read» sobre este proyecto.',
      };
    if (!response.ok)
      return {
        status: 'error',
        message: `Supabase respondió ${response.status}.`,
      };
    const parsed = backupsSchema.safeParse(await response.json());
    if (!parsed.success)
      return {
        status: 'error',
        message: 'La respuesta de Supabase no tiene el formato esperado.',
      };
    return { status: 'ok', ...parsed.data };
  } catch {
    return {
      status: 'error',
      message: 'No se pudo consultar Supabase (tiempo de espera o red).',
    };
  }
}
