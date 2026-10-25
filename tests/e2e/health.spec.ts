import { test, expect } from '@playwright/test';

test('liveness y disponibilidad son comprobaciones distintas y sin caché', async ({
  request,
}) => {
  const live = await request.get('/api/health');
  expect(live.status()).toBe(200);
  expect(await live.json()).toEqual({ status: 'ok', service: 'adhara-web' });
  const ready = await request.get('/api/health?check=readiness');
  const connected = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  expect(ready.status()).toBe(connected ? 200 : 503);
  expect(await ready.json()).toEqual({
    status: connected ? 'ready' : 'unavailable',
    service: 'adhara-web',
  });
  expect(ready.headers()['cache-control']).toBe('no-store');
});
