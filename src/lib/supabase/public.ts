import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from './config';
import type { Database } from './database.types';

/**
 * Cliente anónimo sin cookies para la tienda: las páginas pueden generarse
 * estáticamente y revalidarse. RLS limita las lecturas a lo publicado.
 */
export function createSupabasePublicClient() {
  const config = getSupabaseConfig();
  if (!config) return null;
  return createClient<Database>(config.url, config.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
