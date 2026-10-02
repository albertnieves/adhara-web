import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from './config';
import type { Database } from './database.types';

/** Solo Auth: después de requirePermission('staff.manage'). Nunca usar para CRUD ordinario. */
export function createAuthAdminClient() {
  const config = getSupabaseConfig();
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!config || !key) return null;
  return createClient(config.url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Tareas del servidor sin sesión de personal: solo el informe diario del
 * asistente, después de comprobar CRON_SECRET o de autorizar agent.use con
 * MFA. Nunca para CRUD ordinario ni con datos que lleguen del navegador.
 */
export function createJobClient() {
  const config = getSupabaseConfig();
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!config || !key) return null;
  return createClient<Database>(config.url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
