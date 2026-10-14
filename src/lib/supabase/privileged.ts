import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from './config';
import type { Database } from './database.types';

/**
 * Solo Auth: invitaciones después de requirePermission('staff.manage') y, con
 * la cuenta de cliente, borrar la cuenta de la sesión validada que no es del
 * personal (DECISIONS §145). Nunca usar para CRUD ordinario.
 */
export function createAuthAdminClient() {
  const config = getSupabaseConfig();
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!config || !key) return null;
  return createClient(config.url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Tareas del servidor sin sesión de personal: el informe diario del
 * asistente (tras CRON_SECRET o reports.view, que exige MFA) y la copia
 * diaria de la consola (tras CRON_SECRET; DECISIONS §128). Nunca para CRUD
 * ordinario ni con datos que lleguen del navegador.
 */
export function createJobClient() {
  const config = getSupabaseConfig();
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!config || !key) return null;
  return createClient<Database>(config.url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Pedidos web (DECISIONS §131): solo para llamar a las funciones web_order_*
 * desde el checkout (formatos, cantidades y contacto ya validados; la función
 * vuelve a validarlo todo y calcula precio, envío y stock), la tarea de
 * caducidad de reservas (tras CRON_SECRET) y, con P04, la notificación del TPV
 * tras verificar su firma. Nunca para leer o escribir tablas directamente.
 */
export function createOrdersClient() {
  const config = getSupabaseConfig();
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!config || !key) return null;
  return createClient<Database>(config.url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
