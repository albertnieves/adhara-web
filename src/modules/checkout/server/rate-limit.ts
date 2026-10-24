import 'server-only';
import { createHash } from 'node:crypto';
import { headers } from 'next/headers';
import { createOrdersClient } from '@/lib/supabase/privileged';

/*
 * Freno de las acciones públicas de la tienda: las del checkout (DECISIONS
 * §160) y el formulario de contacto (§168). Sin él, un
 * script podía crear pedidos sin pagar que reservan el stock 30 minutos (la
 * tienda física también lo ve agotado) o probar códigos de descuento sin fin.
 * Cuenta por acción y cliente en la base (web_order_rate_limit, solo el
 * servidor); a la base llega una huella de la IP que cambia cada día, nunca la
 * IP. Las Server Actions se pueden llamar desde cualquier página, así que el
 * freno va en la acción, no en una ruta del Firewall.
 */

export const RATE_LIMITS = {
  // Pedidos creados: cada uno reserva stock hasta que caduca.
  checkout_order: { limit: 6, windowSeconds: 600 },
  // «Aplicar» un código: freno para quien prueba códigos al azar.
  checkout_discount: { limit: 20, windowSeconds: 600 },
  // «Volver a intentar el pago» crea un intento nuevo cada vez.
  checkout_retry: { limit: 10, windowSeconds: 600 },
  // Formulario de contacto: la base ya limita por email (3 por hora) y el
  // total (30 cada 10 minutos); esto frena a quien cambia de email para
  // agotar el total y dejar sin formulario a los demás.
  contact_message: { limit: 5, windowSeconds: 600 },
} as const;
export type RateLimitBucket = keyof typeof RATE_LIMITS;

/** IP del cliente según Vercel (x-real-ip, o la primera de x-forwarded-for). */
export function clientIp(get: (name: string) => string | null): string | null {
  const ip =
    get('x-real-ip')?.trim() || get('x-forwarded-for')?.split(',')[0]?.trim();
  return ip ? ip.slice(0, 64) : null;
}

/** Huella de la IP para una acción y un día (UTC): nunca la IP. */
export function clientKey(
  bucket: RateLimitBucket,
  ip: string,
  now: Date = new Date(),
): string {
  const day = now.toISOString().slice(0, 10);
  return createHash('sha256').update(`${bucket}:${ip}:${day}`).digest('hex');
}

/**
 * Las pruebas E2E crean muchos pedidos desde la misma IP: pueden apagar el
 * freno con RATE_LIMITS=off, pero nunca en producción.
 */
export function rateLimitsOff(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.RATE_LIMITS === 'off' && env.VERCEL_ENV !== 'production';
}

/**
 * true si la petición puede seguir. Si la base no responde, deja pasar (y lo
 * anota): el freno no debe tumbar la tienda.
 */
export async function withinRateLimit(
  bucket: RateLimitBucket,
): Promise<boolean> {
  if (rateLimitsOff()) return true;
  const supabase = createOrdersClient();
  if (!supabase) return true;
  const store = await headers();
  const ip = clientIp((name) => store.get(name)) ?? 'sin-ip';
  const { limit, windowSeconds } = RATE_LIMITS[bucket];
  const { data, error } = await supabase.rpc('web_order_rate_limit', {
    p_bucket: bucket,
    p_client_key: clientKey(bucket, ip),
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error('[checkout] freno de peticiones', error.code, error.message);
    return true;
  }
  return data === true;
}
