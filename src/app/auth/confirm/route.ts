import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  accountPath,
  isNewPasswordPath,
  localeOfPath,
  safeNextFromUrl,
} from '@/modules/account';
import { accountsEnabled, isStaffAccount } from '@/modules/account/server';

const params = z.object({
  token_hash: z.string().min(10).max(500),
  type: z.enum(['invite', 'recovery', 'email']),
  // RedirectTo de la plantilla: a dónde volver (solo rutas de la cuenta).
  next: z.string().max(500).optional(),
});

/**
 * Enlaces de los correos de Auth (plantillas con token_hash). Invitación y
 * recuperación del personal llevan al panel, como siempre. Con la cuenta de
 * cliente (PLAN_CUENTA_CLIENTE) también: confirmar el alta (type=email), que
 * vuelve a la cuenta, y la recuperación de un cliente, que va a la página de
 * nueva contraseña de su idioma. El personal siempre va al panel, que pide el
 * segundo factor antes de cambiar la contraseña.
 */
export async function GET(request: NextRequest) {
  const parsed = params.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  const accounts = accountsEnabled();
  const next = parsed.success ? safeNextFromUrl(parsed.data.next) : null;
  const locale = localeOfPath(next);
  const customerLink =
    accounts &&
    parsed.success &&
    (parsed.data.type === 'email' ||
      (parsed.data.type === 'recovery' && isNewPasswordPath(next)));
  const failure = customerLink
    ? `${accountPath(locale, '/cuenta/acceso')}?error=enlace`
    : '/admin/acceso?error=enlace';
  const go = (path: string) =>
    NextResponse.redirect(new URL(path, request.url));
  // Sin la cuenta de cliente, el alta no existe.
  if (!parsed.success || (parsed.data.type === 'email' && !accounts))
    return go(failure);

  const supabase = await createSupabaseServerClient();
  if (!supabase) return go(failure);
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: parsed.data.token_hash,
    type: parsed.data.type,
  });
  if (error || !data.user) return go(failure);

  switch (parsed.data.type) {
    case 'invite':
      return go('/admin/contrasena');
    case 'email':
      return go(`${next ?? accountPath(locale, '/cuenta')}?bienvenida=1`);
    case 'recovery': {
      // Aunque el enlace venga de la tienda, el personal va al panel.
      const staff =
        !accounts || (await isStaffAccount({ supabase, user: data.user }));
      return go(
        staff
          ? '/admin/contrasena'
          : accountPath(locale, '/cuenta/nueva-contrasena'),
      );
    }
  }
}
