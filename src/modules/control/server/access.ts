import 'server-only';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import type { StaffContext } from '@/modules/auth/server';
import { requirePermission } from '@/modules/auth/server';

/*
 * Acceso a la consola: business.control (administrador del sistema con MFA)
 * y, además, estar en la lista de titulares (internal.control_owners,
 * DECISIONS §118). Cualquier otra sesión recibe 404, igual que sin permiso.
 * Las funciones admin_control_* lo vuelven a comprobar en la base.
 */
export const requireControl = cache(async (): Promise<StaffContext> => {
  const staff = await requirePermission('business.control');
  const { data, error } = await staff.supabase.rpc('control_access');
  if (error || data !== true) notFound();
  return staff;
});

/** Para mostrar el acceso desde el panel de la tienda, sin redirigir. */
export async function hasControlAccess(
  supabase: StaffContext['supabase'],
): Promise<boolean> {
  const { data, error } = await supabase.rpc('control_access');
  return !error && data === true;
}
