'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAuthAdminClient } from '@/lib/supabase/privileged';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { siteUrl } from '@/modules/i18n/seo';
import type { AccountFormState } from '../domain/input';
import {
  accountInput,
  authErrorKey,
  invalid,
  newPasswordInput,
  recoveryInput,
  signInInput,
  signUpInput,
} from '../domain/input';
import type { AccountLocale } from '../domain/paths';
import { accountPath, isAccountLocale, safeNextPath } from '../domain/paths';
import { accountsEnabled, getCustomerSession, isStaffAccount } from './session';

/*
 * Acciones de la cuenta de cliente (PLAN_CUENTA_CLIENTE, C02–C04). Sin el
 * interruptor CUSTOMER_ACCOUNTS no hacen nada. Los mensajes nunca revelan si
 * un email tiene cuenta.
 */

const DISABLED: AccountFormState = { status: 'error', error: 'disabled' };
const GENERIC: AccountFormState = { status: 'error', error: 'generic' };

function formLocale(form: FormData): AccountLocale {
  const value = form.get('locale');
  return isAccountLocale(value) ? value : 'es';
}

const text = (form: FormData, name: string) => String(form.get(name) ?? '');

/** Campo trampa invisible: lo rellenan los bots, no las personas. */
const isBot = (form: FormData) => text(form, 'company').trim() !== '';

/** URL absoluta de esta tienda (los enlaces de los correos y de Google). */
const absolute = (path: string) => new URL(path, siteUrl()).toString();

export async function signUpAction(
  _: AccountFormState,
  form: FormData,
): Promise<AccountFormState> {
  if (!accountsEnabled()) return DISABLED;
  if (isBot(form)) return GENERIC;
  const locale = formLocale(form);
  const parsed = signUpInput.safeParse({
    fullName: text(form, 'fullName'),
    email: text(form, 'email'),
    password: text(form, 'password'),
  });
  if (!parsed.success) return invalid(parsed.error.issues);
  const supabase = await createSupabaseServerClient();
  if (!supabase) return GENERIC;
  const next = safeNextPath(form.get('next')) ?? accountPath(locale, '/cuenta');
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // El enlace del correo pasa por /auth/confirm y vuelve aquí.
      emailRedirectTo: absolute(next),
      data: { full_name: parsed.data.fullName, locale },
    },
  });
  if (error) {
    // Con la confirmación del email apagada, Supabase dice que ya existe: se
    // responde igual que a un alta nueva para no revelarlo.
    if (error.code === 'user_already_exists' || error.code === 'email_exists')
      return { status: 'sent' };
    const key = authErrorKey(error.code);
    if (key === 'passwordWeak')
      return { status: 'error', error: key, fields: { password: key } };
    if (key === 'generic')
      console.error('[cuenta] alta', error.code, error.status);
    return { status: 'error', error: key === 'credentials' ? 'generic' : key };
  }
  // Sin confirmación del email (solo si se apaga en Supabase) ya hay sesión.
  if (data.session) redirect(next);
  return { status: 'sent' };
}

export async function signInAction(
  _: AccountFormState,
  form: FormData,
): Promise<AccountFormState> {
  if (!accountsEnabled()) return DISABLED;
  const locale = formLocale(form);
  const parsed = signInInput.safeParse({
    email: text(form, 'email'),
    password: text(form, 'password'),
  });
  if (!parsed.success) return { status: 'error', error: 'credentials' };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return GENERIC;
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    const key = authErrorKey(error.code);
    return {
      status: 'error',
      error:
        key === 'notConfirmed' || key === 'rateLimited' ? key : 'credentials',
    };
  }
  redirect(safeNextPath(form.get('next')) ?? accountPath(locale, '/cuenta'));
}

/**
 * Entrar con Google (OAuth con PKCE): el verificador queda en una cookie y
 * /auth/callback cambia el código por la sesión.
 */
export async function googleSignInAction(form: FormData) {
  const locale = formLocale(form);
  const signIn = accountPath(locale, '/cuenta/acceso');
  if (!accountsEnabled()) redirect(`/${locale}`);
  const next = safeNextPath(form.get('next')) ?? accountPath(locale, '/cuenta');
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect(`${signIn}?error=google`);
  const callback = new URL('/auth/callback', siteUrl());
  callback.searchParams.set('next', next);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: callback.toString(),
      // Deja elegir la cuenta de Google aunque haya una sola abierta.
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error || !data.url) redirect(`${signIn}?error=google`);
  redirect(data.url);
}

export async function recoveryAction(
  _: AccountFormState,
  form: FormData,
): Promise<AccountFormState> {
  if (!accountsEnabled()) return DISABLED;
  if (isBot(form)) return GENERIC;
  const locale = formLocale(form);
  const parsed = recoveryInput.safeParse({ email: text(form, 'email') });
  if (!parsed.success) return invalid(parsed.error.issues);
  const supabase = await createSupabaseServerClient();
  if (!supabase) return GENERIC;
  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    // La plantilla lleva este destino en next= a /auth/confirm.
    { redirectTo: absolute(accountPath(locale, '/cuenta/nueva-contrasena')) },
  );
  // Nunca se dice si la cuenta existe; solo si hay que esperar.
  if (error && authErrorKey(error.code) === 'rateLimited')
    return { status: 'error', error: 'rateLimited' };
  if (error) console.error('[cuenta] recuperación', error.code, error.status);
  return { status: 'sent' };
}

export async function newPasswordAction(
  _: AccountFormState,
  form: FormData,
): Promise<AccountFormState> {
  if (!accountsEnabled()) return DISABLED;
  const locale = formLocale(form);
  const session = await getCustomerSession();
  if (!session) return { status: 'error', error: 'link' };
  // El personal cambia su contraseña en el panel, con el segundo factor.
  if (await isStaffAccount(session)) redirect('/admin/contrasena');
  const parsed = newPasswordInput.safeParse({
    password: text(form, 'password'),
    confirmation: text(form, 'confirmation'),
  });
  if (!parsed.success) return invalid(parsed.error.issues);
  const { error } = await session.supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    const key = authErrorKey(error.code);
    if (key === 'passwordWeak')
      return { status: 'error', error: key, fields: { password: key } };
    console.error('[cuenta] nueva contraseña', error.code, error.status);
    return GENERIC;
  }
  redirect(`${accountPath(locale, '/cuenta')}?contrasena=1`);
}

/** Cierra la sesión solo en este navegador: no saca al personal del panel en otros. */
export async function signOutAction(form: FormData) {
  const locale = formLocale(form);
  const supabase = await createSupabaseServerClient();
  if (supabase) await supabase.auth.signOut({ scope: 'local' });
  redirect(`/${locale}`);
}

const SAVE_ERRORS: Record<string, AccountFormState> = {
  invalid_address: {
    status: 'error',
    error: 'addressIncomplete',
    fields: { addressLine1: 'addressIncomplete' },
  },
  invalid_account: { status: 'error', error: 'phoneInvalid' },
};

export async function saveAccountAction(
  _: AccountFormState,
  form: FormData,
): Promise<AccountFormState> {
  if (!accountsEnabled()) return DISABLED;
  const session = await getCustomerSession();
  if (!session) return { status: 'error', error: 'link' };
  const parsed = accountInput.safeParse({
    locale: text(form, 'locale'),
    fullName: text(form, 'fullName'),
    phone: text(form, 'phone'),
    addressLine1: text(form, 'addressLine1'),
    addressLine2: text(form, 'addressLine2'),
    postalCode: text(form, 'postalCode'),
    city: text(form, 'city'),
    province: text(form, 'province'),
  });
  if (!parsed.success) return invalid(parsed.error.issues);
  const input = parsed.data;
  const { error } = await session.supabase.rpc('customer_save_account', {
    p_full_name: input.fullName,
    p_phone: input.phone,
    p_locale: input.locale,
    p_address: input.addressLine1
      ? {
          address_line1: input.addressLine1,
          address_line2: input.addressLine2,
          postal_code: input.postalCode,
          city: input.city,
          province: input.province,
        }
      : null,
  });
  if (error) {
    const known = SAVE_ERRORS[error.message];
    if (known) return known;
    console.error('[cuenta] guardar ficha', error.code, error.message);
    return GENERIC;
  }
  revalidatePath(accountPath(input.locale, '/cuenta/datos'));
  return { status: 'saved' };
}

/**
 * Borra la cuenta de Auth (y con ella su ficha; los pedidos se conservan sin
 * el vínculo). Única vía con la clave privilegiada de la cuenta: tras validar
 * la sesión con Supabase Auth y comprobar que no es del personal (DECISIONS §145).
 */
export async function deleteAccountAction(
  _: AccountFormState,
  form: FormData,
): Promise<AccountFormState> {
  if (!accountsEnabled()) return DISABLED;
  const locale = formLocale(form);
  const session = await getCustomerSession();
  if (!session) return { status: 'error', error: 'link' };
  if (form.get('confirm') !== 'on')
    return {
      status: 'error',
      error: 'confirmRequired',
      fields: { confirm: 'confirmRequired' },
    };
  if (await isStaffAccount(session)) return { status: 'error', error: 'staff' };
  const admin = createAuthAdminClient();
  if (!admin) return GENERIC;
  const { error } = await admin.auth.admin.deleteUser(session.user.id);
  if (error) {
    console.error('[cuenta] borrar cuenta', error.code, error.status);
    return GENERIC;
  }
  // La sesión ya no vale: se quitan sus cookies de este navegador.
  await session.supabase.auth.signOut({ scope: 'local' });
  redirect(`${accountPath(locale, '/cuenta/acceso')}?borrada=1`);
}
