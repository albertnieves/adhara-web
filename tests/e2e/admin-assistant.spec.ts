import { expect, test } from '@playwright/test';

/*
 * Asistente (A4): sin sesión no se abre la página ni se puede preguntar, y la
 * tarea programada no hace nada sin su secreto.
 */

test('sin sesión el asistente redirige al acceso', async ({ request }) => {
  const response = await request.get('/admin/asistente', { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers().location).toMatch(/\/admin\/acceso$/);
});

test('sin sesión no se puede preguntar al asistente', async ({ request }) => {
  const response = await request.post('/admin/asistente/consulta', {
    data: { messages: [{ role: 'user', content: '¿Qué está agotado?' }] },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(307);
  expect(response.headers()['content-type'] ?? '').not.toContain('ndjson');
});

test('la tarea programada exige su secreto', async ({ request }) => {
  const attempts: Record<string, string>[] = [
    {},
    { authorization: 'Bearer inventado' },
  ];
  for (const headers of attempts) {
    const response = await request.get('/api/cron/informe-diario', {
      headers,
    });
    // 503 sin CRON_SECRET configurado; 401 si lo está y no coincide.
    expect([401, 503]).toContain(response.status());
    expect(await response.json()).toMatchObject({ ok: false });
  }
});
