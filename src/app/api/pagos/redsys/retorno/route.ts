import { getPathname, routing } from '@/modules/i18n';

/**
 * Vuelta del navegador desde la página del banco (URLOK y URLKO). Admite GET
 * y POST y redirige con 303 a la página del pedido en su idioma, que lee el
 * estado de la base: lo que diga esta URL nunca confirma un pago. Con una
 * redirección propia la cookie del pedido (SameSite=Lax) llega aunque el
 * banco vuelva con un POST.
 */
export const dynamic = 'force-dynamic';

function back(request: Request) {
  const url = new URL(request.url);
  const result = url.searchParams.get('resultado') === 'ok' ? 'ok' : 'ko';
  const requested = url.searchParams.get('idioma');
  const locale = routing.locales.find((l) => l === requested) ?? 'es';
  const path = getPathname({ locale, href: '/pedido' });
  return Response.redirect(new URL(`${path}?resultado=${result}`, url), 303);
}

export function GET(request: Request) {
  return back(request);
}

export function POST(request: Request) {
  return back(request);
}
