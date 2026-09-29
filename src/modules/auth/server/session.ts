import 'server-only';
import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { AdminAccess } from '../domain/access';
import { decideAdminAccess } from '../domain/access';
import type { Permission, StaffRole } from '../domain/permissions';
import { STAFF_ROLES, isAllowed } from '../domain/permissions';

export const ADMIN_HOME = '/admin';
export const ADMIN_LOGIN = '/admin/acceso';
export const ADMIN_MFA = '/admin/mfa';

const staffRow = z.object({
  role: z.enum(STAFF_ROLES),
  active: z.boolean(),
  display_name: z.string().nullable(),
});

type Supabase = NonNullable<
  Awaited<ReturnType<typeof createSupabaseServerClient>>
>;

type AccessState = {
  supabase: Supabase | null;
  userId: string | null;
  email: string | null;
  displayName: string | null;
  access: AdminAccess;
};

/** Una sola lectura por petición. getUser() valida el token contra Supabase Auth. */
const loadAccess = cache(async (): Promise<AccessState> => {
  const supabase = await createSupabaseServerClient();
  const closed = {
    supabase,
    userId: null,
    email: null,
    displayName: null,
    access: { kind: 'login' } as const,
  };
  if (!supabase) return closed;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return closed;

  const [staffResult, aalResult, factorsResult] = await Promise.all([
    supabase
      .from('staff_members')
      .select('role, active, display_name')
      .eq('user_id', data.user.id)
      .maybeSingle(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.mfa.listFactors(),
  ]);
  const staff = staffRow.safeParse(staffResult.data);
  const hasVerifiedTotp = (factorsResult.data?.all ?? []).some(
    (factor) => factor.factor_type === 'totp' && factor.status === 'verified',
  );
  return {
    supabase,
    userId: data.user.id,
    email: data.user.email ?? null,
    displayName: staff.success ? staff.data.display_name : null,
    access: decideAdminAccess({
      userId: data.user.id,
      staff: staff.success ? staff.data : null,
      aal: aalResult.data?.currentLevel === 'aal2' ? 'aal2' : 'aal1',
      hasVerifiedTotp,
    }),
  };
});

export type StaffContext = {
  supabase: Supabase;
  userId: string;
  email: string | null;
  displayName: string | null;
  role: StaffRole;
};

/** Personal activo con MFA verificada; si no, redirige o responde 404. */
export async function requireStaff(): Promise<StaffContext> {
  const state = await loadAccess();
  const { access } = state;
  if (access.kind === 'login') redirect(ADMIN_LOGIN);
  if (access.kind === 'not_found') notFound();
  if (access.kind !== 'allow') redirect(ADMIN_MFA);
  if (!state.supabase || !state.userId) redirect(ADMIN_LOGIN);
  return {
    supabase: state.supabase,
    userId: state.userId,
    email: state.email,
    displayName: state.displayName,
    role: access.role,
  };
}

export async function requirePermission(
  permission: Permission,
): Promise<StaffContext> {
  const context = await requireStaff();
  if (!isAllowed({ role: context.role, aal: 'aal2' }, permission)) notFound();
  return context;
}

/** Personal con sesión pendiente de alta o verificación de MFA. */
export async function requireMfaStep() {
  const state = await loadAccess();
  const { access } = state;
  if (access.kind === 'login') redirect(ADMIN_LOGIN);
  if (access.kind === 'not_found') notFound();
  if (access.kind === 'allow') redirect(ADMIN_HOME);
  if (!state.supabase) redirect(ADMIN_LOGIN);
  return { supabase: state.supabase, step: access.kind };
}

/** Sesión válida de personal activo, aunque aún no tenga MFA (fijar contraseña). */
export async function requireStaffSessionAnyLevel() {
  const state = await loadAccess();
  if (state.access.kind === 'login' || !state.supabase) redirect(ADMIN_LOGIN);
  if (state.access.kind === 'not_found') notFound();
  return { supabase: state.supabase, email: state.email };
}
