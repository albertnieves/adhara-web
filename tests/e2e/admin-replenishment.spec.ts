import { expect, test } from '@playwright/test';

/*
 * Mostrador, reposición y compras (docs/PLAN_TIENDA_REPOSICION.md): sin
 * sesión no se abre ninguna pantalla ni se filtran datos internos.
 */

const PATHS = [
  '/admin/mostrador',
  '/admin/reposicion',
  '/admin/compras',
  '/admin/compras/proveedores',
  '/admin/compras/00000000-0000-4000-8000-000000000000',
  '/admin/compras/proveedores/00000000-0000-4000-8000-000000000000',
];

const INTERNAL = /supplier|proveedor|purchase_order|unit_cost|store_sale/i;

for (const path of PATHS) {
  test(`sin sesión ${path} redirige al acceso`, async ({ request }) => {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers().location).toMatch(/\/admin\/acceso$/);
    expect(INTERNAL.test(await response.text())).toBe(false);
  });
}
