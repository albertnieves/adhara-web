import { routing } from '@/modules/i18n/routing';

/*
 * Rutas de la cuenta de cliente (F14, PLAN_CUENTA_CLIENTE). Puras: las usan
 * el proxy, las acciones y las rutas de Auth (/auth/confirm y /auth/callback)
 * para decidir a dónde volver sin abrir una redirección a otro sitio.
 */

export type AccountLocale = (typeof routing.locales)[number];

/** Rutas internas (claves de next-intl) de la cuenta sin parámetros. */
export type AccountRoute =
  | '/cuenta'
  | '/cuenta/datos'
  | '/cuenta/acceso'
  | '/cuenta/registro'
  | '/cuenta/recuperar'
  | '/cuenta/nueva-contrasena';

export function isAccountLocale(value: unknown): value is AccountLocale {
  return (
    typeof value === 'string' &&
    (routing.locales as readonly string[]).includes(value)
  );
}

/** Ruta absoluta con idioma: accountPath('ca', '/cuenta/acceso') → /ca/compte/acces. */
export function accountPath(locale: AccountLocale, route: AccountRoute) {
  return `/${locale}${routing.pathnames[route][locale]}`;
}

/** Prefijos con idioma: /es/cuenta, /ca/compte, /en/account. */
const ACCOUNT_PREFIXES = routing.locales.map(
  (locale) => `/${locale}${routing.pathnames['/cuenta'][locale]}`,
);
/** Finalizar compra en cada idioma: el checkout rellena los datos de la cuenta. */
const CHECKOUT_PATHS = routing.locales.map(
  (locale) => `/${locale}${routing.pathnames['/finalizar-compra'][locale]}`,
);

const SAFE_PATH = /^\/[a-z0-9/-]*$/;

function under(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * Páginas que leen la sesión del cliente: el proxy refresca allí sus cookies
 * (un Server Component no puede escribirlas).
 */
export function readsCustomerSession(pathname: string): boolean {
  return (
    ACCOUNT_PREFIXES.some((prefix) => under(pathname, prefix)) ||
    CHECKOUT_PATHS.includes(pathname)
  );
}

/**
 * A dónde volver tras entrar: solo una ruta de esta tienda dentro de la cuenta
 * o el checkout, sin `//`, `..`, consulta ni fragmento. Si no, null.
 */
export function safeNextPath(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 200) return null;
  if (!SAFE_PATH.test(value) || value.includes('//') || value.includes('..'))
    return null;
  return readsCustomerSession(value) ? value : null;
}

/** Igual, para una URL completa (el RedirectTo de los correos de Auth). */
export function safeNextFromUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 500) return null;
  try {
    return safeNextPath(new URL(value, 'http://localhost').pathname);
  } catch {
    return null;
  }
}

/** Idioma de una ruta con prefijo; español si no lo tiene. */
export function localeOfPath(pathname: string | null): AccountLocale {
  const segment = pathname?.split('/')[1];
  return isAccountLocale(segment) ? segment : routing.defaultLocale;
}

/** La página para elegir contraseña tras el enlace de recuperación. */
export function isNewPasswordPath(pathname: string | null): boolean {
  return routing.locales.some(
    (locale) => pathname === accountPath(locale, '/cuenta/nueva-contrasena'),
  );
}
