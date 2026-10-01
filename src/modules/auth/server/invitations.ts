'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createAuthAdminClient } from '@/lib/supabase/privileged';
import { fail, ok, describeDbError } from '@/modules/admin';
import type { ActionState } from '@/modules/admin';
import { requirePermission } from './session';
import { STAFF_ROLES } from '../domain/permissions';

export async function inviteStaff(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requirePermission('staff.manage');
  const input = z
    .object({
      email: z.email().max(254),
      role: z.enum(STAFF_ROLES),
      name: z.string().trim().max(80),
    })
    .safeParse({
      email: String(formData.get('email') ?? '')
        .trim()
        .toLowerCase(),
      role: formData.get('role'),
      name: formData.get('displayName') ?? '',
    });
  if (!input.success) return fail('Revisa el email y el rol.');
  const admin = createAuthAdminClient();
  if (!admin)
    return fail(
      'El envío de invitaciones no está configurado. Contacta con el administrador del sistema.',
    );
  const { error } = await supabase.rpc('admin_prepare_invite', {
    p_email: input.data.email,
    p_role: input.data.role,
    p_display_name: input.data.name,
  });
  if (error)
    return fail(
      error.message === 'existing_user'
        ? 'La cuenta ya existe. Usa «Dar acceso».'
        : describeDbError(error),
    );
  const sent = await admin.auth.admin.inviteUserByEmail(input.data.email);
  revalidatePath('/admin/equipo');
  if (sent.error)
    return fail(
      'No se pudo enviar el correo. La invitación queda pendiente; revisa el servicio de correo antes de reenviar.',
    );
  return ok(
    'Invitación enviada. La persona fijará su contraseña y configurará la verificación en dos pasos.',
  );
}
export async function cancelInvite(formData: FormData) {
  const { supabase } = await requirePermission('staff.manage');
  const email = z.email().parse(formData.get('email'));
  const { error } = await supabase.rpc('admin_cancel_invite', {
    p_email: email,
  });
  if (error) throw new Error('No se pudo cancelar la invitación.');
  revalidatePath('/admin/equipo');
}
