import { expect, test } from '@playwright/test';

/*
 * Informes (docs/PLAN_INFORMES.md): sin sesión no se abre ninguna pantalla
 * ni la exportación, y la respuesta no lleva datos.
 */

const PATHS = [
  '/admin/informes',
  '/admin/informes/inventario',
  '/admin/informes/inventario?mes=2026-09',
  '/admin/informes/inventario/exportar?mes=2026-09',
  '/admin/informes/rotacion',
  '/admin/informes/margenes',
  '/admin/informes/compras',
  '/admin/informes/auditoria',
];

for (const path of PATHS) {
  test(`sin sesión ${path} redirige al acceso`, async ({ request }) => {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers().location).toMatch(/\/admin\/acceso$/);
    expect(response.headers()['content-type'] ?? '').not.toContain('text/csv');
    expect(await response.text()).not.toMatch(/Existencias|cost_net|audit/i);
  });
}
