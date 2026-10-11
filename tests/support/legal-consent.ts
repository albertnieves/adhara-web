import {
  LEGAL_CONSENT_COOKIE,
  LEGAL_UPDATED_AT,
} from '../../src/modules/legal/domain/entity';

/**
 * Estado del navegador con el aviso de entrada ya aceptado: el resto de
 * pruebas navega como un visitante que vuelve. tests/e2e/legal.spec.ts
 * prueba el aviso con un navegador limpio.
 */
export const CONSENT_ACCEPTED = {
  cookies: [
    {
      name: LEGAL_CONSENT_COOKIE,
      value: LEGAL_UPDATED_AT,
      domain: 'localhost',
      path: '/',
      expires: -1,
      httpOnly: false,
      secure: false,
      sameSite: 'Lax' as const,
    },
  ],
  origins: [],
};
