import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { accountPath, localeOfPath, safeNextPath } from '@/modules/account';
import { accountsEnabled } from '@/modules/account/server';

/**
 * Vuelta de Google (OAuth con PKCE, PLAN_CUENTA_CLIENTE C03): cambia el código
 * por la sesión con el verificador que guardó la acción en una cookie de este
 * navegador. `next` solo puede ser una ruta de la cuenta o del checkout.
 */
export async function GET(request: NextRequest) {
  if (!accountsEnabled()) return new NextResponse(null, { status: 404 });
  const search = request.nextUrl.searchParams;
  const next = safeNextPath(search.get('next'));
  const locale = localeOfPath(next);
  const code = search.get('code');
  // Con varios accesos a la vez, supabase-js puede añadir el flujo a la vuelta.
  const flowId = search.get('sb_flow_id');
  if (code && code.length <= 500) {
    const supabase = await createSupabaseServerClient();
    const result = await supabase?.auth
      .exchangeCodeForSession(code, flowId ? { flowId } : undefined)
      .catch(() => null);
    if (result && !result.error)
      return NextResponse.redirect(
        new URL(next ?? accountPath(locale, '/cuenta'), request.url),
      );
  }
  // Sin código: Google o Supabase devolvieron un error (cancelado, alta
  // cerrada…). El detalle no se enseña.
  return NextResponse.redirect(
    new URL(
      `${accountPath(locale, '/cuenta/acceso')}?error=google`,
      request.url,
    ),
  );
}
