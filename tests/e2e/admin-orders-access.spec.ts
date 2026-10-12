import { expect, test } from '@playwright/test';

/*
 * Pedidos web (PLAN_PEDIDOS_WEB, P05): sin sesión no se abre la lista ni la
 * ficha, ni se filtra ningún dato del pedido o del cliente.
 */

const PATHS = [
  '/admin/pedidos',
  '/admin/pedidos?vista=incidencias',
  '/admin/pedidos/00000000-0000-4000-8000-000000000000',
];

const PRIVATE =
  /order_contacts|full_name|transaction_id|payment_reference|@test\.invalid/i;

for (const path of PATHS) {
  test(`sin sesión ${path} redirige al acceso`, async ({ request }) => {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers().location).toMatch(/\/admin\/acceso$/);
    expect(PRIVATE.test(await response.text())).toBe(false);
  });
}
