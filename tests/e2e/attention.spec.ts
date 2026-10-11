import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

/*
 * Medición anónima de visitas e interés (POST /api/eventos): responde 204 sin
 * datos cuente o no, 400 solo si el cuerpo no es JSON y nada más que POST. Las
 * fichas publicadas envían su evento desde el navegador; con Global Privacy
 * Control no se envía nada. Sin perfumes publicados en la base, las pruebas de
 * las fichas se saltan.
 */

const AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

function isEvent(url: string, method: string) {
  return new URL(url).pathname === '/api/eventos' && method === 'POST';
}

/** Espera el evento de un tipo (la escena 3D puede enviar el suyo antes). */
function waitForEvent(page: Page, kind: string) {
  return page.waitForRequest(
    (r) =>
      isEvent(r.url(), r.method()) &&
      r.postData()?.includes(`"kind":"${kind}"`) === true,
  );
}

/** Primer perfume publicado del catálogo, o null si no hay ninguno. */
async function publishedSlug(page: Page) {
  const response = await page.request.get('/es/catalogo');
  const match = (await response.text()).match(
    /href="\/es\/perfume\/([a-z0-9-]+)"/,
  );
  return match?.[1] ?? null;
}

test('un evento válido responde 204 sin datos ni caché', async ({
  request,
}) => {
  for (const slug of ['perfume-centinela', 'perfume-que-no-existe']) {
    const response = await request.post('/api/eventos', {
      data: { slug, kind: 'view' },
      headers: { 'User-Agent': AGENT },
    });
    expect(response.status()).toBe(204);
    expect(response.headers()['cache-control']).toContain('no-store');
    expect(await response.text()).toBe('');
  }
});

test('lo que no cuenta también responde 204', async ({ request }) => {
  const cases: { data: object; headers: Record<string, string> }[] = [
    // Tipo que la tienda no envía (add_to_cart llegará con el carrito).
    { data: { slug: 'perfume-centinela', kind: 'add_to_cart' }, headers: {} },
    // Bot y otro origen.
    {
      data: { slug: 'perfume-centinela', kind: 'view' },
      headers: {
        'User-Agent': 'Googlebot/2.1 (+http://www.google.com/bot.html)',
      },
    },
    {
      data: { slug: 'perfume-centinela', kind: 'view' },
      headers: {
        Origin: 'https://ejemplo.com',
        'Sec-Fetch-Site': 'cross-site',
      },
    },
    // Más de 512 bytes.
    { data: { slug: 'a'.repeat(600), kind: 'view' }, headers: {} },
  ];
  for (const { data, headers } of cases) {
    const response = await request.post('/api/eventos', {
      data,
      headers: { 'User-Agent': AGENT, ...headers },
    });
    expect(response.status()).toBe(204);
    expect(await response.text()).toBe('');
  }
});

test('un cuerpo que no es JSON responde 400', async ({ request }) => {
  const response = await request.post('/api/eventos', {
    data: 'esto no es json',
    headers: { 'Content-Type': 'application/json', 'User-Agent': AGENT },
  });
  expect(response.status()).toBe(400);
  expect(await response.text()).toBe('');
});

test('solo acepta POST', async ({ request }) => {
  const response = await request.get('/api/eventos');
  expect(response.status()).toBe(405);
});

test('las fichas publicadas envían su evento', async ({ page }) => {
  const slug = await publishedSlug(page);
  test.skip(slug === null, 'Sin perfumes publicados en esta base');
  // Con la petición enrutada (sin cambiarla), Playwright conserva el cuerpo
  // de sendBeacon y se puede comprobar qué se envía.
  await page.route('**/api/eventos', (route) => route.continue());

  const view = waitForEvent(page, 'view');
  await page.goto(`/es/perfume/${slug}`);
  expect((await view).postDataJSON()).toEqual({ slug, kind: 'view' });

  const scent = waitForEvent(page, 'scent_view');
  await page.goto(`/es/catalogo-olfativo/${slug}`);
  expect((await scent).postDataJSON()).toEqual({ slug, kind: 'scent_view' });
});

test('con Global Privacy Control no se envía nada', async ({ page }) => {
  const slug = await publishedSlug(page);
  test.skip(slug === null, 'Sin perfumes publicados en esta base');
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'globalPrivacyControl', {
      get: () => true,
    });
  });
  const events: string[] = [];
  page.on('request', (r) => {
    if (isEvent(r.url(), r.method())) events.push(r.url());
  });
  await page.goto(`/es/perfume/${slug}`);
  await page.waitForLoadState('networkidle');
  expect(events).toEqual([]);
});
