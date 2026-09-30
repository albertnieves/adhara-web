import { test, expect } from '@playwright/test';

/*
 * Ninguna respuesta pública (HTML ni carga RSC) contiene costes. Complementa
 * las pruebas pgTAP (03_costs) y la revisión estática del código.
 */

const COST_PATTERN =
  /cost_net|costNet|variant_cost|admin_variant_costs|pricing\.view_cost/;

const PUBLIC_PATHS = [
  '/es',
  '/ca',
  '/en',
  '/es/catalogo',
  '/ca/cataleg',
  '/en/catalog',
  '/es/perfume/no-existe',
];

for (const path of PUBLIC_PATHS) {
  test(`sin costes en ${path}`, async ({ request }) => {
    const html = await request.get(path);
    expect(COST_PATTERN.test(await html.text())).toBe(false);
    const rsc = await request.get(path, { headers: { RSC: '1' } });
    expect(COST_PATTERN.test(await rsc.text())).toBe(false);
  });
}

test('sin costes en las fichas publicadas', async ({ request }) => {
  const catalog = await (await request.get('/es/catalogo')).text();
  const slugs = [
    ...new Set(
      [...catalog.matchAll(/href="\/es\/perfume\/([a-z0-9-]+)"/g)].map(
        (match) => match[1],
      ),
    ),
  ];
  for (const slug of slugs) {
    const page = await request.get(`/es/perfume/${slug}`);
    expect(page.status()).toBe(200);
    expect(COST_PATTERN.test(await page.text())).toBe(false);
  }
});

test('el panel no responde con datos sin sesión', async ({ request }) => {
  const response = await request.get('/admin/catalogo', { maxRedirects: 0 });
  expect([307, 308, 404]).toContain(response.status());
  expect(COST_PATTERN.test(await response.text())).toBe(false);
});
