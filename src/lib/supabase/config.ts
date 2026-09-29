import { z } from 'zod';

const schema = z.object({
  url: z.url(),
  publishableKey: z.string().min(20),
});

export type SupabaseConfig = z.infer<typeof schema>;

/**
 * Configuración pública de Supabase. Devuelve null si falta: el panel
 * se comporta como sin sesión (cerrado), nunca abierto.
 */
export function getSupabaseConfig(
  env: Record<string, string | undefined> = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  },
): SupabaseConfig | null {
  const parsed = schema.safeParse({
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  return parsed.success ? parsed.data : null;
}
