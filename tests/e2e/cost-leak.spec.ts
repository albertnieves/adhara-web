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

/*
 * Coste centinela (criterio 11 de la Fase 1): e2e.yml carga
 * tests/fixtures/test-db.sql en la base local, con un perfume publicado cuyo
 * coste es 987654 céntimos y un proveedor y una referencia con ese número.
 * Ni el número ni el importe en euros aparecen en HTML, RSC, JSON ni cabeceras.
 */
test.describe('coste centinela', () => {
  test.skip(
    !process.env.ADHARA_COST_SENTINEL,
    'Solo con tests/fixtures/test-db.sql cargado (e2e.yml)',
  );

  const SENTINEL = /987654|9[.,]?876[.,]54/;
  const SENTINEL_PATHS = [
    ...PUBLIC_PATHS,
    '/es/perfume/perfume-centinela',
    '/ca/perfum/perfume-centinela',
    '/en/fragrance/perfume-centinela',
    '/api/health',
    '/robots.txt',
  ];

  test('el perfume centinela está publicado', async ({ request }) => {
    const page = await request.get('/es/perfume/perfume-centinela');
    expect(page.status()).toBe(200);
    expect(await page.text()).toContain('Perfume centinela (prueba)');
    const catalog = await (await request.get('/es/catalogo')).text();
    expect(catalog).toContain('/es/perfume/perfume-centinela');
  });

  for (const path of SENTINEL_PATHS) {
    test(`sin el centinela en ${path}`, async ({ request }) => {
      const variants: Record<string, string>[] = [{}, { RSC: '1' }];
      for (const headers of variants) {
        const response = await request.get(path, { headers });
        expect(SENTINEL.test(await response.text())).toBe(false);
        expect(SENTINEL.test(JSON.stringify(response.headers()))).toBe(false);
      }
    });
  }
});
