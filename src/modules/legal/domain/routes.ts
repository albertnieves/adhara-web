import type { LegalDocumentKey } from './types';

/**
 * Ruta interna de cada texto legal (la de español). Las traducidas están en
 * modules/i18n/routing.ts; una prueba comprueba que coinciden.
 */
export const LEGAL_PATHS = {
  legalNotice: '/aviso-legal',
  terms: '/condiciones-de-venta',
  privacy: '/privacidad',
  cookies: '/cookies',
  shipping: '/envios-y-devoluciones',
} as const satisfies Record<LegalDocumentKey, string>;
