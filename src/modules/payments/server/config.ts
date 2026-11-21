import 'server-only';
import type { RedsysEnvironment } from '../domain/redsys';
import { REDSYS_ENVIRONMENTS } from '../domain/redsys';

export type RedsysConfig = {
  merchantCode: string;
  terminal: string;
  /** Clave de firma SHA-256 del comercio, en base64 (la da el banco). */
  secretKey: string;
  environment: RedsysEnvironment;
  merchantName: string;
};

/**
 * Datos del TPV virtual (STATUS, pendiente 6), solo como variables de
 * servidor en Vercel; nunca en el repositorio ni por chat. Sin alguno, o con
 * uno mal formado, no hay pago con tarjeta: el checkout registra el pedido
 * y dice que el pago aún no está conectado. REDSYS_ENVIRONMENT es obligatoria
 * (test o live) para no mandar nunca una clave real al entorno equivocado.
 */
export function redsysConfig(
  env: Record<string, string | undefined> = process.env,
): RedsysConfig | null {
  const merchantCode = env.REDSYS_MERCHANT_CODE?.trim() ?? '';
  const terminal = env.REDSYS_TERMINAL?.trim() ?? '';
  const secretKey = env.REDSYS_SECRET_KEY?.trim() ?? '';
  const environment = env.REDSYS_ENVIRONMENT?.trim() as RedsysEnvironment;
  if (
    !/^\d{9}$/.test(merchantCode) ||
    !/^\d{1,3}$/.test(terminal) ||
    !REDSYS_ENVIRONMENTS.includes(environment) ||
    !validSecretKey(secretKey)
  )
    return null;
  // El entorno de pruebas del banco acepta tarjetas de prueba públicas y su
  // notificación va firmada: en producción daría pedidos «pagados» sin cobrar
  // nada (DECISIONS §161). Solo se admite con el interruptor explícito de la
  // venta en pruebas, que además enseña el aviso al comprador (§193).
  if (
    environment === 'test' &&
    env.VERCEL_ENV === 'production' &&
    !checkoutTestModeRequested(env)
  )
    return null;
  return {
    merchantCode,
    terminal,
    secretKey,
    environment,
    merchantName: env.REDSYS_MERCHANT_NAME?.trim() || 'L’Atelier du Désert',
  };
}

/**
 * Interruptor de la venta en pruebas (DECISIONS §193): `WEB_CHECKOUT_TEST=1`
 * deja usar en Production el entorno de pruebas del banco mientras BBVA valida
 * el comercio. Se quita al recibir la clave real: con `live` no hace nada.
 */
function checkoutTestModeRequested(
  env: Record<string, string | undefined>,
): boolean {
  return env.WEB_CHECKOUT_TEST === '1';
}

/**
 * La tienda cobra con el entorno de pruebas del banco: ningún pago es real.
 * La cesta, el pago y la página del pedido lo avisan, y el panel también.
 */
export function checkoutTestMode(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return redsysConfig(env)?.environment === 'test';
}

/** Clave 3DES: 32 caracteres en base64 (24 bytes). */
function validSecretKey(value: string): boolean {
  return (
    /^[A-Za-z0-9+/]{32}$/.test(value) &&
    Buffer.from(value, 'base64').length === 24
  );
}
