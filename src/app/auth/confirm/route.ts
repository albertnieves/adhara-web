import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  accountPath,
  isNewPasswordPath,
  localeOfPath,
  safeNextFromUrl,
} from '@/modules/account';
import type { AccountLocale } from '@/modules/account';
import { accountsEnabled, isStaffAccount } from '@/modules/account/server';
import { BRAND_NAME } from '@/modules/brand';

const params = z.object({
  token_hash: z.string().min(10).max(500),
  type: z.enum(['invite', 'recovery', 'email']),
  // RedirectTo de la plantilla: a dónde volver (solo rutas de la cuenta).
  next: z.string().max(500).optional(),
});
type Params = z.infer<typeof params>;

/*
 * Enlaces de los correos de Auth (plantillas con token_hash). Invitación y
 * recuperación del personal llevan al panel, como siempre. Con la cuenta de
 * cliente (PLAN_CUENTA_CLIENTE) también: confirmar el alta (type=email), que
 * vuelve a la cuenta, y la recuperación de un cliente, que va a la página de
 * nueva contraseña de su idioma. El personal siempre va al panel, que pide el
 * segundo factor antes de cambiar la contraseña.
 *
 * Abrir el enlace (GET) no abre sesión: enseña un botón que envía el token
 * por POST desde esta misma web (DECISIONS §187). Así nadie puede hacer que
 * otra persona entre en una cuenta ajena con un enlace o una imagen (inicio
 * de sesión forzado), y los antivirus del correo que abren los enlaces no
 * gastan la invitación ni la recuperación.
 */

function read(source: URLSearchParams | FormData) {
  const value = (name: string) => {
    const raw = source.get(name);
    return typeof raw === 'string' ? raw : undefined;
  };
  return params.safeParse({
    token_hash: value('token_hash'),
    type: value('type'),
    next: value('next'),
  });
}

/** Enlace de la cuenta de cliente (en su idioma) o del personal (panel). */
function audience(data: Params | null) {
  const accounts = accountsEnabled();
  const next = data ? safeNextFromUrl(data.next) : null;
  const locale = localeOfPath(next);
  const customer =
    accounts &&
    data !== null &&
    (data.type === 'email' ||
      (data.type === 'recovery' && isNewPasswordPath(next)));
  const failure = customer
    ? `${accountPath(locale, '/cuenta/acceso')}?error=enlace`
    : '/admin/acceso?error=enlace';
  return { accounts, next, locale, customer, failure };
}

const NO_STORE = {
  'Cache-Control': 'private, no-store',
  // El token va en la dirección: que no salga en el Referer.
  'Referrer-Policy': 'no-referrer',
};

const redirect = (request: NextRequest, path: string) =>
  NextResponse.redirect(new URL(path, request.url), {
    status: 303,
    headers: NO_STORE,
  });

const escapeHtml = (text: string) =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

/** Textos del botón: los del cliente en su idioma; el panel, en español. */
async function copy(customer: boolean, locale: AccountLocale) {
  if (!customer)
    return {
      lang: 'es',
      title: 'Confirma para continuar',
      body: 'Por seguridad, pulsa el botón para terminar de abrir el enlace.',
      submit: 'Continuar',
    };
  const t = await getTranslations({ locale, namespace: 'account.confirmLink' });
  return {
    lang: locale,
    title: t('title'),
    body: t('body'),
    submit: t('submit'),
  };
}

export async function GET(request: NextRequest) {
  const parsed = read(request.nextUrl.searchParams);
  const data = parsed.success ? parsed.data : null;
  const { accounts, locale, customer, failure } = audience(data);
  // Sin la cuenta de cliente, el alta no existe.
  if (!data || (data.type === 'email' && !accounts))
    return redirect(request, failure);

  const text = await copy(customer, locale);
  const hidden = Object.entries(data)
    .filter((entry): entry is [string, string] => entry[1] !== undefined)
    .map(
      ([name, value]) =>
        `<input type="hidden" name="${name}" value="${escapeHtml(value)}">`,
    )
    .join('');
  const html = `<!doctype html>
<html lang="${text.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">
<title>${escapeHtml(text.title)} · ${escapeHtml(BRAND_NAME)}</title>
<style>
:root{color-scheme:light dark;--bg:#ece2d1;--fg:#151311;--muted:#5d554b;--accent:#6f5229}
@media (prefers-color-scheme:dark){:root{--bg:#0d0c0b;--fg:#ece2d1;--muted:#a8a095;--accent:#d6bf98}}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px 16px;background:var(--bg);color:var(--fg);font:16px/1.5 Georgia,'Times New Roman',serif}
main{width:100%;max-width:28rem;text-align:center}
.brand{letter-spacing:.2em;text-transform:uppercase;font-size:.75rem;color:var(--accent);margin:0 0 2rem}
h1{font-weight:400;font-size:1.75rem;margin:0 0 1rem}
p{color:var(--muted);margin:0 0 2rem}
button{font:inherit;font-size:1rem;letter-spacing:.05em;width:100%;min-height:3rem;border:0;border-radius:2px;background:var(--fg);color:var(--bg);cursor:pointer}
button:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
</style>
</head>
<body>
<main>
<p class="brand">${escapeHtml(BRAND_NAME)}</p>
<h1>${escapeHtml(text.title)}</h1>
<p>${escapeHtml(text.body)}</p>
<form method="post" action="/auth/confirm">${hidden}<button type="submit">${escapeHtml(text.submit)}</button></form>
</main>
</body>
</html>`;
  return new NextResponse(html, {
    headers: { ...NO_STORE, 'Content-Type': 'text/html; charset=utf-8' },
  });
}

/** Solo el botón de la página de arriba: otra web no puede enviar el token. */
function sameOrigin(request: NextRequest) {
  const site = request.headers.get('sec-fetch-site');
  if (site !== null) return site === 'same-origin';
  const origin = request.headers.get('origin');
  if (origin === null) return false;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const parsed = form ? read(form) : null;
  const data = parsed?.success ? parsed.data : null;
  const { accounts, next, locale, failure } = audience(data);
  if (!data || !sameOrigin(request) || (data.type === 'email' && !accounts))
    return redirect(request, failure);

  const supabase = await createSupabaseServerClient();
  if (!supabase) return redirect(request, failure);
  const { data: verified, error } = await supabase.auth.verifyOtp({
    token_hash: data.token_hash,
    type: data.type,
  });
  if (error || !verified.user) return redirect(request, failure);

  switch (data.type) {
    case 'invite':
      return redirect(request, '/admin/contrasena');
    case 'email':
      return redirect(
        request,
        `${next ?? accountPath(locale, '/cuenta')}?bienvenida=1`,
      );
    case 'recovery': {
      // Aunque el enlace venga de la tienda, el personal va al panel.
      const staff =
        !accounts || (await isStaffAccount({ supabase, user: verified.user }));
      return redirect(
        request,
        staff
          ? '/admin/contrasena'
          : accountPath(locale, '/cuenta/nueva-contrasena'),
      );
    }
  }
}
