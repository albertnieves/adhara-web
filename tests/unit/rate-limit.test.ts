import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ headers: vi.fn() }));
vi.mock('@/lib/supabase/privileged', () => ({ createOrdersClient: vi.fn() }));

const { RATE_LIMITS, clientIp, clientKey, rateLimitsOff } =
  await import('@/modules/checkout/server/rate-limit');

/*
 * Freno de las acciones públicas del checkout (DECISIONS §160): la huella que
 * llega a la base no es la IP, cambia cada día y es distinta por acción; y el
 * interruptor de las pruebas nunca apaga el freno en producción.
 */

describe('freno de peticiones del checkout', () => {
  it('la IP sale de las cabeceras de Vercel', () => {
    const from = (values: Record<string, string>) => (name: string) =>
      values[name] ?? null;
    expect(clientIp(from({ 'x-real-ip': ' 203.0.113.7 ' }))).toBe(
      '203.0.113.7',
    );
    expect(
      clientIp(from({ 'x-forwarded-for': '198.51.100.2, 10.0.0.1' })),
    ).toBe('198.51.100.2');
    expect(clientIp(from({}))).toBeNull();
  });

  it('la huella no es la IP, cambia por acción y por día', () => {
    const day = new Date('2026-10-17T10:00:00Z');
    const key = clientKey('checkout_order', '203.0.113.7', day);
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(key).not.toContain('203');
    expect(clientKey('checkout_order', '203.0.113.7', day)).toBe(key);
    expect(clientKey('checkout_discount', '203.0.113.7', day)).not.toBe(key);
    expect(clientKey('checkout_order', '203.0.113.8', day)).not.toBe(key);
    expect(
      clientKey(
        'checkout_order',
        '203.0.113.7',
        new Date('2026-10-18T10:00:00Z'),
      ),
    ).not.toBe(key);
  });

  it('las pruebas pueden apagarlo, nunca en producción', () => {
    expect(rateLimitsOff({ RATE_LIMITS: 'off' })).toBe(true);
    expect(rateLimitsOff({ RATE_LIMITS: 'off', VERCEL_ENV: 'preview' })).toBe(
      true,
    );
    expect(
      rateLimitsOff({ RATE_LIMITS: 'off', VERCEL_ENV: 'production' }),
    ).toBe(false);
    expect(rateLimitsOff({})).toBe(false);
  });

  it('límites dentro de lo que acepta la base', () => {
    for (const { limit, windowSeconds } of Object.values(RATE_LIMITS)) {
      expect(limit).toBeGreaterThanOrEqual(1);
      expect(limit).toBeLessThanOrEqual(10_000);
      expect(windowSeconds).toBeGreaterThanOrEqual(1);
      expect(windowSeconds).toBeLessThanOrEqual(86_400);
    }
    for (const bucket of Object.keys(RATE_LIMITS))
      expect(bucket).toMatch(/^[a-z_]{1,40}$/);
  });
});
