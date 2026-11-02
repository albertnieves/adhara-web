import { expect, test } from '@playwright/test';

/*
 * Feed de productos para Google Merchant Center y Meta (DECISIONS §180):
 * solo con la venta encendida, sin indexar y sin perfumes sin foto con
 * derechos (el centinela de tests/fixtures/test-db.sql no tiene foto).
 */

const ON = process.env.WEB_CHECKOUT === '1';

test('con la venta encendida, RSS de Google sin indexar ni perfumes sin foto', async ({
  request,
}) => {
  test.skip(!ON, 'Solo con WEB_CHECKOUT=1 (e2e.yml)');
  const response = await request.get('/feeds/productos.xml');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('application/xml');
  expect(response.headers()['x-robots-tag']).toContain('noindex');
  const xml = await response.text();
  expect(xml).toMatch(
    /^<\?xml version="1.0" encoding="UTF-8"\?>\n<rss version="2.0" xmlns:g="http:\/\/base.google.com\/ns\/1.0">\n<channel>/,
  );
  expect(xml).toContain('<link>http://localhost:3000/es</link>');
  expect(xml).not.toContain('perfume-centinela');
  expect(xml).not.toMatch(/gtin|mpn|identifier_exists/);
});

test('sin la venta, no existe', async ({ request }) => {
  test.skip(ON, 'Con WEB_CHECKOUT=1 el feed existe');
  expect((await request.get('/feeds/productos.xml')).status()).toBe(404);
});
