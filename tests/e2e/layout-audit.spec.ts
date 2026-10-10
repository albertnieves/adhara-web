import { expect, test, type Page } from '@playwright/test';
import {
  AUDIT_WIDTHS,
  auditRoute,
  axeBaseline,
  collectLayoutIssues,
  formatFindings,
} from '../support/layout-audit';

/*
 * Red de seguridad del sistema de diseño (DS-01): la tienda pública y las
 * pantallas de acceso al panel, a 390, 768, 1280 y 1440 px, sin
 * desplazamiento horizontal, solapes, texto fuera de su caja ni controles
 * de menos de 24 px. axe guarda su línea base sin hacer fallar la prueba.
 * Recorre sus propias anchuras: solo se ejecuta en el proyecto de escritorio.
 */

const ROUTES: [path: string, name: string, status?: number][] = [
  ['/es', 'inicio-es'],
  ['/ca', 'inicio-ca'],
  ['/en', 'inicio-en'],
  ['/es/catalogo', 'coleccion-es'],
  ['/ca/cataleg', 'coleccion-ca'],
  ['/en/catalog', 'coleccion-en'],
  ['/es/catalogo-olfativo', 'catalogo-olfativo-es'],
  ['/ca/cataleg-olfactiu', 'catalogo-olfativo-ca'],
  ['/en/scent-catalogue', 'catalogo-olfativo-en'],
  ['/es/catalogo-olfativo/no-existe', 'catalogo-olfativo-404', 404],
  ['/es/perfume/no-existe', 'ficha-404', 404],
  ['/es/aviso-legal', 'aviso-legal-es'],
  ['/es/condiciones-de-venta', 'condiciones-de-venta-es'],
  ['/ca/privacitat', 'privacidad-ca'],
  ['/en/cookie-policy', 'cookies-en'],
  ['/es/envios-y-devoluciones', 'envios-y-devoluciones-es'],
  ['/admin/acceso', 'panel-acceso'],
  ['/admin/recuperar', 'panel-recuperar'],
];

test.beforeEach(({}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop',
    'La auditoría recorre sus propias anchuras',
  );
  testInfo.setTimeout(120_000);
});

async function check(page: Page, path: string, name: string, status = 200) {
  const results = await auditRoute(page, path, name, AUDIT_WIDTHS, status);
  const report = formatFindings(name, results);
  expect(report, report).toBe('');
  // Criterio 6: sin infracciones de axe (WCAG 2.2 AA).
  const axe = await axeBaseline(page, path, name);
  expect(axe.violations, JSON.stringify(axe.violations, null, 2)).toEqual([]);
}

for (const [path, name, status] of ROUTES) {
  test(`diseño sin solapes ni desbordes en ${path}`, async ({ page }) => {
    await check(page, path, name, status);
  });
}

test('diseño sin solapes ni desbordes en una ficha publicada', async ({
  page,
  request,
}) => {
  const catalog = await (await request.get('/es/catalogo')).text();
  const slug = catalog.match(/href="\/es\/perfume\/([a-z0-9-]+)"/)?.[1];
  test.skip(!slug, 'No hay perfumes publicados en esta base');
  await check(page, `/es/perfume/${slug}`, 'ficha-es');
  await check(page, `/ca/perfum/${slug}`, 'ficha-ca');
  await check(page, `/en/fragrance/${slug}`, 'ficha-en');
  await check(page, `/es/catalogo-olfativo/${slug}`, 'ficha-olfativa-es');
});

test('la auditoría detecta solapes, desbordes, letra y controles pequeños', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.setContent(`
    <main>
      <p style="width: 200px">Texto encima</p>
      <p style="width: 200px; margin-top: -30px">Texto que lo pisa</p>
      <p style="width: 900px">Una línea más ancha que la pantalla</p>
      <div style="width: 60px"><span style="display: block; white-space: nowrap">Texto que se sale de su caja</span></div>
      <button style="width: 16px; height: 16px; padding: 0">x</button>
      <p><span style="position: absolute; top: 0">Capa superpuesta a propósito</span></p>
      <p style="font-size: 9px; margin-top: 40px">Texto diminuto</p>
      <div data-print-size><p style="font-size: 6pt">Etiqueta impresa</p></div>
    </main>`);
  const { blocking } = await page.evaluate(collectLayoutIssues, 24);
  const kinds = blocking.map((issue) => issue.split(':')[0]);
  expect(kinds).toContain('desplazamiento horizontal');
  expect(kinds).toContain('solape');
  expect(kinds).toContain('texto fuera de su caja');
  expect(kinds).toContain('control de menos de 24 px');
  expect(kinds).toContain('texto de menos de 11 px');
  expect(blocking.join('\n')).not.toContain('Capa superpuesta');
  expect(blocking.join('\n')).not.toContain('Etiqueta impresa');
});
