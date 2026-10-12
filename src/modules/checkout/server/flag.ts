import 'server-only';

/**
 * Interruptor del checkout (DECISIONS §136). Sin WEB_CHECKOUT=1 la tienda no
 * enseña la cesta ni vende online: se enciende en Vercel cuando el TPV del
 * banco esté conectado (P04). Se lee al generar cada página: cambiarlo exige
 * volver a desplegar.
 */
export function checkoutEnabled(): boolean {
  return process.env.WEB_CHECKOUT === '1';
}
