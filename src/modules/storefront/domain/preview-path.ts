import { routing } from '@/modules/i18n/routing';

/**
 * Destino tras entrar o salir de la vista previa: solo rutas de la tienda en
 * un idioma soportado (nunca URLs externas ni del panel).
 */
export function storefrontPath(value: unknown): string {
  const path = typeof value === 'string' ? value : '';
  const locale = path.split(/[/?#]/)[1] ?? '';
  const valid =
    path.startsWith('/') &&
    !path.startsWith('//') &&
    !path.includes('\\') &&
    (routing.locales as readonly string[]).includes(locale);
  return valid ? path : `/${routing.defaultLocale}`;
}
