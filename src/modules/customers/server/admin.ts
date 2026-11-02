import 'server-only';
import { createHash } from 'node:crypto';
import type { StaffContext } from '@/modules/auth/server';
import type { CustomerRecord, CustomerRow } from '../domain/records';
import {
  CUSTOMERS_PAGE_SIZE,
  isCustomerKey,
  parseCustomerList,
  parseCustomerRecord,
} from '../domain/records';

type Supabase = StaffContext['supabase'];

/**
 * La clave de la ficha de un email: la misma que calcula la base
 * (`private.customer_key`), para enlazar la ficha desde un pedido o una
 * consulta sin poner el email en la URL.
 */
export function customerKey(email: string): string {
  return createHash('sha256')
    .update(email.trim().toLowerCase(), 'utf8')
    .digest('hex');
}

/*
 * Ficha de cliente (A7, DECISIONS §184): todo pasa por funciones de la base
 * que comprueban customers.view (o customers.manage para exportar) con MFA.
 * La página ya lo exige; la base lo vuelve a comprobar.
 */

/** Una página de clientes, la actividad más reciente primero. */
export async function listCustomers(
  supabase: Supabase,
  { search, page }: { search: string; page: number },
): Promise<{ customers: CustomerRow[]; total: number }> {
  const { data, error } = await supabase.rpc('admin_customers', {
    p_search: search.trim().slice(0, 120) || undefined,
    p_limit: CUSTOMERS_PAGE_SIZE,
    p_offset: (Math.max(1, page) - 1) * CUSTOMERS_PAGE_SIZE,
  });
  if (error) throw new Error(`No se pudo leer los clientes: ${error.message}`);
  return parseCustomerList(data);
}

/** La ficha de un cliente por su clave; null si no es de nadie. */
export async function getCustomer(
  supabase: Supabase,
  key: string,
): Promise<CustomerRecord | null> {
  if (!isCustomerKey(key)) return null;
  const { data, error } = await supabase.rpc('admin_customer', {
    p_key: key,
  });
  if (error) throw new Error(`No se pudo leer el cliente: ${error.message}`);
  return parseCustomerRecord(data);
}

/**
 * Todos sus datos para el derecho de acceso (customers.manage). La base deja
 * constancia en la auditoría, sin el email. null si la clave no es de nadie.
 */
export async function exportCustomer(
  supabase: Supabase,
  key: string,
): Promise<unknown | null> {
  if (!isCustomerKey(key)) return null;
  const { data, error } = await supabase.rpc('admin_customer_export', {
    p_key: key,
  });
  if (error) {
    if (error.message.includes('unknown_customer')) return null;
    throw new Error(`No se pudo exportar el cliente: ${error.message}`);
  }
  return data;
}
