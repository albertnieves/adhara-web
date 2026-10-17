import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CUSTOMER_ORDER_STATUSES,
  MIN_PASSWORD_LENGTH,
  accountInput,
  accountPath,
  authErrorKey,
  customerOrderStatus,
  invalid,
  isNewPasswordPath,
  localeOfPath,
  newPasswordInput,
  readsCustomerSession,
  safeNextFromUrl,
  safeNextPath,
  signUpInput,
} from '@/modules/account';
import { ORDER_STATUSES } from '@/modules/orders';
import es from '../../messages/es.json';

/*
 * Cuenta de cliente (PLAN_CUENTA_CLIENTE): rutas a las que se puede volver
 * sin abrir una redirección a otro sitio, estados del pedido para el cliente
 * y validación de los formularios.
 */

describe('rutas de la cuenta', () => {
  it('traduce las rutas internas a cada idioma', () => {
    expect(accountPath('es', '/cuenta')).toBe('/es/cuenta');
    expect(accountPath('ca', '/cuenta/acceso')).toBe('/ca/compte/acces');
    expect(accountPath('en', '/cuenta/nueva-contrasena')).toBe(
      '/en/account/new-password',
    );
  });

  it('el proxy refresca la sesión en la cuenta y en el checkout, no en el resto', () => {
    for (const path of [
      '/es/cuenta',
      '/es/cuenta/pedidos/1001',
      '/ca/compte/dades',
      '/en/account/sign-in',
      '/es/finalizar-compra',
      '/ca/finalitzar-compra',
      '/en/checkout',
    ])
      expect(readsCustomerSession(path), path).toBe(true);
    for (const path of [
      '/es',
      '/es/catalogo',
      '/es/cuentas',
      '/es/cesta',
      '/es/pedido',
      '/admin',
      '/en/cuenta',
    ])
      expect(readsCustomerSession(path), path).toBe(false);
  });

  it('solo vuelve a rutas propias de la cuenta o del checkout', () => {
    expect(safeNextPath('/es/finalizar-compra')).toBe('/es/finalizar-compra');
    expect(safeNextPath('/ca/compte/comandes/1001')).toBe(
      '/ca/compte/comandes/1001',
    );
    for (const value of [
      'https://otro.example/es/cuenta',
      '//otro.example/es/cuenta',
      '/es/cuenta/../../admin',
      '/es/cuenta?x=1',
      '/es/cuenta#x',
      '/admin/equipo',
      '/es/catalogo',
      '/es\\cuenta',
      `/es/cuenta/${'a'.repeat(300)}`,
      null,
      ['/es/cuenta'],
    ])
      expect(safeNextPath(value), String(value)).toBeNull();
  });

  it('de una URL completa (RedirectTo de los correos) solo toma la ruta', () => {
    expect(
      safeNextFromUrl('https://latelierdudesert.com/en/account/new-password'),
    ).toBe('/en/account/new-password');
    expect(safeNextFromUrl('https://otro.example/es/cuenta')).toBe(
      '/es/cuenta',
    );
    expect(safeNextFromUrl('https://latelierdudesert.com/')).toBeNull();
    expect(safeNextFromUrl('http://[')).toBeNull();
    expect(safeNextFromUrl(undefined)).toBeNull();
  });

  it('distingue la página de nueva contraseña y el idioma de una ruta', () => {
    expect(isNewPasswordPath('/ca/compte/nova-contrasenya')).toBe(true);
    expect(isNewPasswordPath('/es/cuenta')).toBe(false);
    expect(isNewPasswordPath(null)).toBe(false);
    expect(localeOfPath('/en/account')).toBe('en');
    expect(localeOfPath('/xx/cuenta')).toBe('es');
    expect(localeOfPath(null)).toBe('es');
  });
});

describe('estado del pedido para el cliente', () => {
  it('cada estado del pedido tiene uno del cliente con su texto', () => {
    for (const status of ORDER_STATUSES) {
      const customer = customerOrderStatus(status);
      expect(CUSTOMER_ORDER_STATUSES).toContain(customer);
      expect(es.account.status[customer]).toBeTruthy();
    }
  });

  it('agrupa los internos y esconde la incidencia de cobro', () => {
    expect(customerOrderStatus('paid')).toBe('preparing');
    expect(customerOrderStatus('processing')).toBe('preparing');
    expect(customerOrderStatus('needs_attention')).toBe('review');
    expect(customerOrderStatus('desconocido')).toBe('review');
    expect(customerOrderStatus('ready_for_pickup')).toBe('readyForPickup');
  });
});

describe('formularios de la cuenta', () => {
  it('el alta pide nombre, email válido y contraseña larga', () => {
    const ok = signUpInput.safeParse({
      fullName: ' Ana ',
      email: ' Ana@Example.COM ',
      password: 'x'.repeat(MIN_PASSWORD_LENGTH),
    });
    expect(ok.success && ok.data).toEqual({
      fullName: 'Ana',
      email: 'ana@example.com',
      password: 'x'.repeat(MIN_PASSWORD_LENGTH),
    });
    const bad = signUpInput.safeParse({
      fullName: '',
      email: 'no-es-email',
      password: 'corta',
    });
    expect(bad.success).toBe(false);
    if (!bad.success)
      expect(invalid(bad.error.issues)).toEqual({
        status: 'error',
        error: 'nameRequired',
        fields: {
          fullName: 'nameRequired',
          email: 'emailInvalid',
          password: 'passwordShort',
        },
      });
  });

  it('la contraseña nueva se repite igual', () => {
    const password = 'una frase bastante larga';
    expect(
      newPasswordInput.safeParse({ password, confirmation: password }).success,
    ).toBe(true);
    const mismatch = newPasswordInput.safeParse({
      password,
      confirmation: `${password}!`,
    });
    expect(mismatch.success).toBe(false);
    if (!mismatch.success)
      expect(invalid(mismatch.error.issues)).toMatchObject({
        fields: { confirmation: 'passwordMismatch' },
      });
  });

  const empty = {
    locale: 'es',
    fullName: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    postalCode: '',
    city: '',
    province: '',
  };

  it('los datos se guardan sin dirección o con la dirección completa', () => {
    expect(accountInput.safeParse(empty).success).toBe(true);
    expect(
      accountInput.safeParse({
        ...empty,
        phone: '+34 600 000 000',
        addressLine1: 'Calle Mayor 1',
        postalCode: '08860',
        city: 'Castelldefels',
      }).success,
    ).toBe(true);
    const partial = accountInput.safeParse({ ...empty, city: 'Castelldefels' });
    expect(partial.success).toBe(false);
    if (!partial.success)
      expect(invalid(partial.error.issues)).toMatchObject({
        fields: {
          addressLine1: 'addressIncomplete',
          postalCode: 'postalCodeInvalid',
        },
      });
    expect(accountInput.safeParse({ ...empty, phone: 'llámame' }).success).toBe(
      false,
    );
    expect(accountInput.safeParse({ ...empty, locale: 'fr' }).success).toBe(
      false,
    );
  });

  it('los errores de Auth nunca dicen si el email tiene cuenta', () => {
    expect(authErrorKey('invalid_credentials')).toBe('credentials');
    expect(authErrorKey('user_not_found')).toBe('credentials');
    expect(authErrorKey('email_not_confirmed')).toBe('notConfirmed');
    expect(authErrorKey('signup_disabled')).toBe('signupDisabled');
    expect(authErrorKey('over_email_send_rate_limit')).toBe('rateLimited');
    expect(authErrorKey('weak_password')).toBe('passwordWeak');
    expect(authErrorKey(undefined)).toBe('generic');
  });

  it('la longitud mínima es la de Supabase Auth', () => {
    const config = readFileSync(
      new URL('../../supabase/config.toml', import.meta.url),
      'utf8',
    );
    expect(config).toContain(
      `minimum_password_length = ${MIN_PASSWORD_LENGTH}`,
    );
  });
});
