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

/**
 * Mensajes con clientes (DECISIONS §154): solo para las funciones
 * web_contact_submit (formulario ya validado, tras CONTACT_FORM),
 * web_inbound_email_record (correo con la firma del proveedor comprobada) y
 * la cola de respuestas web_message_emails_* (tras CRON_SECRET o justo
 * después de una respuesta del panel). Nunca para leer o escribir tablas.
 */
export function createMessagesClient() {
  const config = getSupabaseConfig();
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!config || !key) return null;
  return createClient<Database>(config.url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Envíos (DECISIONS §175): solo para web_shipment_event, con el aviso de
 * seguimiento de la plataforma ya verificado con su firma HMAC. La función
 * solo apunta el estado de un paquete que ya es de la tienda. Nunca para leer
 * o escribir tablas.
 */
export function createShippingClient() {
  const config = getSupabaseConfig();
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!config || !key) return null;
  return createClient<Database>(config.url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
