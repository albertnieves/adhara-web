import { test, expect } from '@playwright/test';
test('redirige a español y negocia el catalán', async ({ request }) => {
  const es = await request.get('/', {
    maxRedirects: 0,
    headers: { 'Accept-Language': 'es' },
  });
  expect(es.status()).toBe(307);
  expect(es.headers().location).toMatch(/\/es$/);
  const ca = await request.get('/', {
    maxRedirects: 0,
    headers: { 'Accept-Language': 'ca' },
  });
  expect(ca.headers().location).toMatch(/\/ca$/);
});
test('la cookie de idioma tiene prioridad', async ({ request }) => {
  const result = await request.get('/', {
    maxRedirects: 0,
    headers: { 'Accept-Language': 'ca', Cookie: 'NEXT_LOCALE=en' },
  });
  expect(result.headers().location).toMatch(/\/en$/);
});
for (const [locale, path] of [
  ['es', '/es/catalogo'],
  ['ca', '/ca/cataleg'],
  ['en', '/en/catalog'],
]) {
  test(`ruta y html lang: ${locale}`, async ({ page }) => {
    const response = await page.goto(path!);
    expect(response?.status()).toBe(200);
    expect(response?.headers()['x-robots-tag']).toBe('noindex, nofollow');
    await expect(page.locator('html')).toHaveAttribute('lang', locale!);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
}
test('rutas no soportadas devuelven 404', async ({ request }) => {
  expect((await request.get('/xx')).status()).toBe(404);
});

test('un perfume inexistente devuelve 404 con la página de la tienda', async ({
  page,
}) => {
  const response = await page.goto('/es/perfume/no-existe');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Esta página no existe',
  );
});

test('la colección en inglés responde con su título', async ({ page }) => {
  const response = await page.goto('/en/catalog');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'All fragrances',
  );
});

for (const path of ['/es', '/es/catalogo', '/admin/acceso']) {
  test(`cabeceras de seguridad en ${path}`, async ({ request }) => {
    const headers = (await request.get(path)).headers();
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['permissions-policy']).toContain('camera=()');
    expect(headers['x-robots-tag']).toBe('noindex, nofollow');
    expect(headers['x-powered-by']).toBeUndefined();
  });
}

test('canonical y hreflang de la colección en catalán', async ({ page }) => {
  await page.goto('/ca/cataleg');
  const href = (selector: string) =>
    page.locator(selector).getAttribute('href');
  expect(await href('link[rel="canonical"]')).toMatch(/\/ca\/cataleg$/);
  expect(await href('link[hreflang="es"]')).toMatch(/\/es\/catalogo$/);
  expect(await href('link[hreflang="en"]')).toMatch(/\/en\/catalog$/);
  expect(await href('link[hreflang="x-default"]')).toMatch(/\/es\/catalogo$/);
});
