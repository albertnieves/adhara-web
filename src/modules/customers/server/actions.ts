'use server';

import { requirePermission } from '@/modules/auth/server';
import type { CustomerSearchState } from '../domain/records';
import { listCustomers } from './admin';

/**
 * Búsqueda de la lista de clientes. Va por POST y no en la URL: lo que se
 * busca suele ser un email, y la URL acaba en los registros de la plataforma
 * (DECISIONS §184).
 */
export async function searchCustomers(
  _: CustomerSearchState,
  formData: FormData,
): Promise<CustomerSearchState> {
  const { supabase } = await requirePermission('customers.view');
  const raw = formData.get('q');
  const search = (typeof raw === 'string' ? raw : '').trim().slice(0, 120);
  const page = Math.max(
    1,
    Number.parseInt(String(formData.get('pagina')), 10) || 1,
  );
  const { customers, total } = await listCustomers(supabase, { search, page });
  return { search, page, customers, total };
}
