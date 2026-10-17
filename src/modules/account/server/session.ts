import 'server-only';
import type { User } from '@supabase/supabase-js';
import { notFound, redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { AccountLocale } from '../domain/paths';
import { accountPath } from '../domain/paths';

/**
 * Interruptor de la cuenta de cliente (PLAN_CUENTA_CLIENTE, DECISIONS §142).
 * Sin CUSTOMER_ACCOUNTS=1 las páginas de la cuenta responden 404, la cabecera
 * no la enlaza y el checkout no lee la sesión. El proxy lee la misma variable.
 */
export function accountsEnabled(): boolean {
  return process.env.CUSTOMER_ACCOUNTS === '1';
}

type Supabase = NonNullable<
  Awaited<ReturnType<typeof createSupabaseServerClient>>
>;
export type CustomerSession = { supabase: Supabase; user: User };

/**
 * Sesión validada contra Supabase Auth (getUser, no solo la cookie), o null.
 * Cliente o personal: cada uno solo ve lo suyo (RLS y customer_*).
 */
export async function getCustomerSession(): Promise<CustomerSession | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { supabase, user: data.user };
}

/**
 * Páginas privadas de la cuenta: 404 con el interruptor apagado y, sin
 * sesión, a «Entrar» con la vuelta a `next` (ruta con idioma).
 */
export async function requireCustomer(
  locale: AccountLocale,
  next: string,
): Promise<CustomerSession> {
  if (!accountsEnabled()) notFound();
  const session = await getCustomerSession();
  if (!session)
    redirect(
      `${accountPath(locale, '/cuenta/acceso')}?next=${encodeURIComponent(next)}`,
    );
  return session;
}

/**
 * La cuenta es (o fue) del personal: no se borra ni cambia la contraseña desde
 * la tienda (eso pide el segundo factor en el panel). Ante un error, sí: así
 * se bloquea antes que dejar pasar.
 */
export async function isStaffAccount({
  supabase,
  user,
}: CustomerSession): Promise<boolean> {
  const { data, error } = await supabase
    .from('staff_members')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  return Boolean(error || data);
}
