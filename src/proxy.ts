import createMiddleware from 'next-intl/middleware';
import { routing } from '@/modules/i18n';
export default createMiddleware(routing);
export const config = {
  matcher: ['/((?!api|admin|auth|_next|_vercel|.*\\..*).*)'],
};
