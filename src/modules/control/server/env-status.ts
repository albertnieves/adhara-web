import 'server-only';

/*
 * Qué variables de entorno están configuradas, para la consola: solo sí/no.
 * Los valores de los secretos nunca salen de aquí. Las de Vercel (entorno,
 * región y commit) no son secretas.
 */

export const TRACKED_VARIABLES = [
  { name: 'NEXT_PUBLIC_SUPABASE_URL', use: 'Conexión con Supabase' },
  {
    name: 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    use: 'Clave publicable de Supabase',
  },
  { name: 'NEXT_PUBLIC_SITE_URL', use: 'URL pública de la tienda' },
  {
    name: 'SUPABASE_SECRET_KEY',
    use: 'Invitaciones, informe diario y copia diaria',
  },
  { name: 'CRON_SECRET', use: 'Tareas programadas' },
  { name: 'ANTHROPIC_API_KEY', use: 'Asistente' },
  { name: 'SENDER_API_TOKEN', use: 'Envío de suscriptores a Sender' },
  { name: 'SENDER_GROUP_ID', use: 'Grupo de Sender' },
  {
    name: 'SUPABASE_BACKUPS_TOKEN',
    use: 'Copias de la plataforma (token limitado, opcional)',
  },
] as const;

export type EnvStatus = {
  variables: { name: string; use: string; configured: boolean }[];
  environment: 'production' | 'preview' | 'development' | 'local';
  region: string | null;
  commit: string | null;
  assistantDailyLimit: number;
};

export function getEnvStatus(): EnvStatus {
  const vercel = process.env.VERCEL_ENV;
  const limit = Number(process.env.ASSISTANT_DAILY_LIMIT);
  return {
    variables: TRACKED_VARIABLES.map(({ name, use }) => ({
      name,
      use,
      configured: Boolean(process.env[name]),
    })),
    environment:
      vercel === 'production' ||
      vercel === 'preview' ||
      vercel === 'development'
        ? vercel
        : 'local',
    region: process.env.VERCEL_REGION ?? null,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    assistantDailyLimit: Number.isInteger(limit) && limit > 0 ? limit : 40,
  };
}
