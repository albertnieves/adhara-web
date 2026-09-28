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
test('rutas no implementadas permanecen inaccesibles', async ({ request }) => {
  expect((await request.get('/admin')).status()).toBe(404);
  expect((await request.get('/xx')).status()).toBe(404);
});
