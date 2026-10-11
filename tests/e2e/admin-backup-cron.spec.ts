import { expect, test } from '@playwright/test';

/*
 * Copia diaria de la consola: la tarea programada no exporta nada sin su
 * secreto, y la descarga y los enlaces del bucket exigen sesión.
 */

test('la copia diaria exige su secreto', async ({ request }) => {
  const attempts: Record<string, string>[] = [
    {},
    { authorization: 'Bearer inventado' },
  ];
  for (const headers of attempts) {
    const response = await request.get('/api/cron/copia-diaria', { headers });
    // 503 sin CRON_SECRET configurado; 401 si lo está y no coincide.
    expect([401, 503]).toContain(response.status());
    expect(response.headers()['content-type'] ?? '').not.toContain('gzip');
    expect(await response.json()).toMatchObject({ ok: false });
  }
});

test('sin sesión no se descarga ninguna copia', async ({ request }) => {
  for (const path of [
    '/admin/control/copias/descargar',
    '/admin/control/copias/archivo?ruta=db/2026/10/2026-10-11.json.gz',
  ]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers().location).toMatch(/\/admin\/acceso$/);
    expect(response.headers()['content-type'] ?? '').not.toContain('gzip');
  }
});
