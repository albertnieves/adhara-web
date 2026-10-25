import { expect, test } from '@playwright/test';
import { indexingEnabled } from '../../src/modules/i18n/indexing';

test('las cabeceras de indexación coinciden con la bandera y protegen las operaciones', async ({
  request,
}) => {
  const publicPage = await request.get('/es/catalogo');
  if (indexingEnabled())
    expect(publicPage.headers()['x-robots-tag']).toBeUndefined();
  else expect(publicPage.headers()['x-robots-tag']).toBe('noindex, nofollow');
  for (const path of [
    '/admin/acceso',
    '/api/health',
    '/auth/confirm',
    '/es/cesta',
    '/ca/cistella',
    '/en/basket',
    '/es/cuenta/acceso',
    '/ca/compte/acces',
    '/en/account/sign-in',
    '/es/finalizar-compra',
    '/ca/finalitzar-compra',
    '/en/checkout',
    '/es/pedido',
    '/ca/comanda',
    '/en/order',
  ]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.headers()['x-robots-tag'], path).toBe('noindex, nofollow');
  }
});

test('el entorno de pruebas mantiene robots y sitemap cerrados', async ({
  request,
}) => {
  const robots = await request.get('/robots.txt');
  expect(robots.ok()).toBe(true);
  expect(await robots.text()).toContain('Disallow: /');
  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.ok()).toBe(true);
  expect(sitemap.headers()['content-type']).toContain('xml');
  expect(await sitemap.text()).not.toContain('<loc>');
});
