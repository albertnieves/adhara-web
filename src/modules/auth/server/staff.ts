'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { ActionState } from '@/modules/admin';
import { describeDbError, fail, ok } from '@/modules/admin';
import { STAFF_ROLES } from '../domain/permissions';
import { requirePermission } from './session';

/* Alta de personal: la cuenta se crea en Supabase Auth; aquí se le da rol. */

const grantInput = z.object({
  email: z.email('Escribe un email válido.').max(254),
  role: z.enum(STAFF_ROLES),
  displayName: z.string().trim().max(80),
});

export async function grantStaff(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requirePermission('staff.manage');
  const parsed = grantInput.safeParse({
    email: String(formData.get('email') ?? '').trim(),
    role: formData.get('role'),
    displayName: formData.get('displayName') ?? '',
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? 'Revisa los datos.');
  }
  const { error } = await supabase.rpc('admin_grant_staff', {
    p_email: parsed.data.email,
    p_role: parsed.data.role,
    p_display_name: parsed.data.displayName || undefined,
  });
  if (error) return fail(describeDbError(error));
  revalidatePath('/admin/equipo');
  return ok(
    'Acceso concedido. En su primer acceso configurará la verificación en dos pasos.',
  );
}

export async function setStaffActive(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requirePermission('staff.manage');
  const id = z.uuid().safeParse(formData.get('userId'));
  if (!id.success) return fail('Usuario no válido.');
  const active = formData.get('active') === 'true';
  const { error } = await supabase.rpc('admin_set_staff_active', {
    p_user_id: id.data,
    p_active: active,
  });
  if (error) return fail(describeDbError(error));
  revalidatePath('/admin/equipo');
  return ok(active ? 'Acceso reactivado.' : 'Acceso desactivado.');
}
