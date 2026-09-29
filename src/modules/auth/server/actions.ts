'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  ADMIN_HOME,
  ADMIN_LOGIN,
  requireMfaStep,
  requireStaffSessionAnyLevel,
} from './session';

type Supabase = NonNullable<
  Awaited<ReturnType<typeof createSupabaseServerClient>>
>;

/** Si quien actúa no es personal, la función SQL lo rechaza; no bloquea el flujo. */
async function audit(supabase: Supabase, action: string) {
  await supabase.rpc('record_audit_event', {
    action,
    entity: 'auth',
  });
}

const credentials = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(200),
});

export async function signIn(formData: FormData) {
  const parsed = credentials.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) redirect(`${ADMIN_LOGIN}?error=credenciales`);
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect(`${ADMIN_LOGIN}?error=servicio`);
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  // Mensaje genérico: no revela si el email existe.
  if (error) redirect(`${ADMIN_LOGIN}?error=credenciales`);
  await audit(supabase, 'auth.login');
  redirect(ADMIN_HOME);
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    await audit(supabase, 'auth.logout');
    await supabase.auth.signOut();
  }
  redirect(ADMIN_LOGIN);
}

export type EnrollState =
  | { status: 'idle' }
  | { status: 'error' }
  | { status: 'enrolled'; factorId: string; qrCode: string; secret: string };

export async function enrollTotp(): Promise<EnrollState> {
  const { supabase, step } = await requireMfaStep();
  if (step !== 'enroll_mfa') redirect(ADMIN_HOME);
  // Los factores sin verificar de intentos anteriores se descartan.
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const factor of factors?.all ?? []) {
    if (factor.status === 'unverified') {
      await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }
  }
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: 'ADHARA',
  });
  if (error || !data) return { status: 'error' };
  return {
    status: 'enrolled',
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
  };
}

const totpInput = z.object({
  factorId: z.string().min(1).max(100),
  code: z.string().regex(/^\d{6}$/),
});

export async function verifyTotp(formData: FormData) {
  const { supabase, step } = await requireMfaStep();
  let factorId = formData.get('factorId');
  if (step === 'verify_mfa') {
    const { data } = await supabase.auth.mfa.listFactors();
    factorId =
      data?.all.find(
        (factor) =>
          factor.factor_type === 'totp' && factor.status === 'verified',
      )?.id ?? null;
  }
  const parsed = totpInput.safeParse({
    factorId,
    code: String(formData.get('code') ?? '').replace(/\s/g, ''),
  });
  if (!parsed.success) redirect('/admin/mfa?error=codigo');
  const { error } = await supabase.auth.mfa.challengeAndVerify(parsed.data);
  if (error) redirect('/admin/mfa?error=codigo');
  await audit(
    supabase,
    step === 'enroll_mfa' ? 'auth.mfa_enrolled' : 'auth.mfa_verified',
  );
  redirect(ADMIN_HOME);
}

const newPassword = z
  .object({
    password: z.string().min(12).max(200),
    confirmation: z.string(),
  })
  .refine((value) => value.password === value.confirmation);

export async function setPassword(formData: FormData) {
  const { supabase } = await requireStaffSessionAnyLevel();
  const parsed = newPassword.safeParse({
    password: formData.get('password'),
    confirmation: formData.get('confirmation'),
  });
  if (!parsed.success) redirect('/admin/contrasena?error=requisitos');
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) redirect('/admin/contrasena?error=servicio');
  await audit(supabase, 'auth.password_set');
  redirect(ADMIN_HOME);
}
