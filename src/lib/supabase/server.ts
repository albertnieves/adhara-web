import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseConfig } from './config';

/** Cliente con la sesión del usuario (RLS aplica). Uno por petición. */
export async function createSupabaseServerClient() {
  // Leer cookies antes de la configuración: fuerza render por petición
  // aunque el build se haga sin variables de Supabase.
  const cookieStore = await cookies();
  const config = getSupabaseConfig();
  if (!config) return null;
  return createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // En Server Components no se pueden escribir cookies; el proxy refresca la sesión.
        }
      },
    },
  });
}
