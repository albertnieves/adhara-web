import {
  LEGAL_CONSENT_COOKIE,
  LEGAL_UPDATED_AT,
} from '../../src/modules/legal/domain/entity';
import type { ConsentChoice } from '../../src/modules/tracking/domain/consent';
import {
  ALL_DENIED,
  serializeConsent,
  TRACKING_CONSENT_COOKIE,
} from '../../src/modules/tracking/domain/consent';
import { TRACKING_VENDORS } from '../../src/modules/tracking/domain/vendors';

const cookie = (name: string, value: string) => ({
  name,
  value,
  domain: 'localhost',
  path: '/',
  expires: -1,
  httpOnly: false,
  secure: false,
  sameSite: 'Lax' as const,
});

/** Estado del navegador con el aviso contestado y esa elección de cookies. */
export function consentState(choice: ConsentChoice) {
  return {
    cookies: [
      cookie(LEGAL_CONSENT_COOKIE, LEGAL_UPDATED_AT),
      cookie(
        TRACKING_CONSENT_COOKIE,
        serializeConsent(choice, TRACKING_VENDORS, Date.now() / 1000),
      ),
    ],
    origins: [],
  };
}

/**
 * Estado del navegador con el aviso de entrada ya contestado y las cookies
 * opcionales rechazadas: el resto de pruebas navega como un visitante que
 * vuelve y no carga ninguna etiqueta de terceros. tests/e2e/legal.spec.ts y
 * consent.spec.ts prueban el aviso con un navegador limpio.
 */
export const CONSENT_ACCEPTED = consentState(ALL_DENIED);
