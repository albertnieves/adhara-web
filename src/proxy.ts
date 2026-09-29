import createMiddleware from 'next-intl/middleware';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { refreshSupabaseSession } from '@/lib/supabase/proxy';
import { routing } from '@/modules/i18n';

const intl = createMiddleware(routing);
const ADMIN_LOGIN = '/admin/acceso';

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname !== '/admin' && !pathname.startsWith('/admin/')) {
    return intl(request);
  }
  // El proxy solo refresca la sesión y redirige sin ella; la autorización
  // real está en el layout del panel, en cada Server Action y en RLS.
  const { response, hasSession } = await refreshSupabaseSession(request);
  if (!hasSession && pathname !== ADMIN_LOGIN) {
    return NextResponse.redirect(new URL(ADMIN_LOGIN, request.url));
  }
  return response;
}

export const config = {
  matcher: ['/((?!api|auth|_next|_vercel|.*\\..*).*)'],
};
