import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import type { TestProduct } from './support';
import { admin, archiveProduct, login, sellableProduct, user } from './support';

/*
 * Pedidos web en el panel (PLAN_PEDIDOS_WEB, P05) contra Supabase local. Los
 * pedidos se crean y se pagan como lo hará el servidor (clave privilegiada y
 * funciones web_order_*). Cada prueba usa un perfume propio publicado, sin
 * coste (no altera el stock a coste del inicio), y lo archiva al terminar.
 */

type Product = TestProduct;

const created: Product[] = [];

async function makeProduct(units: number) {
  const made = await sellableProduct(units);
  created.push(made);
  return made;
}

test.afterEach(() => {
  for (const made of created.splice(0)) archiveProduct(made);
});

async function level(product: Product) {
  const { data, error } = await admin
    .from('inventory_levels')
    .select('on_hand, reserved, stock_locations!inner(code)')
    .eq('variant_id', product.variantId)
    .eq('stock_locations.code', 'castelldefels')
    .single();
  if (error) throw error;
  return { onHand: data.on_hand as number, reserved: data.reserved as number };
}

type Created = { order_id: string; number: number; payment_reference: string };

/** Pedido de recogida de una unidad, pagado con `paidCents`. */
async function paidOrder(
  product: Product,
  customer: { name: string; email: string },
  paidCents: number,
) {
  const { data: location } = await admin
    .from('stock_locations')
    .select('id')
    .eq('code', 'castelldefels')
    .single();
  const created = await admin.rpc('web_order_create', {
    p_request_id: randomUUID(),
    p_locale: 'es',
    p_fulfillment: 'click_collect',
    p_location_id: location!.id,
    p_items: [{ variant_id: product.variantId, quantity: 1 }],
    p_contact: { full_name: customer.name, email: customer.email },
    p_provider: 'redsys',
  });
  if (created.error) throw created.error;
  const order = created.data as Created;
  const paid = await admin.rpc('web_order_record_payment', {
    p_provider: 'redsys',
    p_reference: order.payment_reference,
    p_transaction_id: `tx-${randomUUID()}`,
    p_outcome: 'succeeded',
    p_amount_cents: paidCents,
    p_currency: 'EUR',
  });
  if (paid.error) throw paid.error;
  return order;
}

function customer() {
  const id = randomUUID().slice(0, 8);
  return { name: `Cliente ${id}`, email: `cliente-${id}@test.invalid` };
}

test('administrador de la tienda: prepara y entrega un pedido y resuelve una incidencia', async ({
  page,
}) => {
  const product = await makeProduct(3);
  const buyer = customer();
  const order = await paidOrder(product, buyer, 4990);
  const incident = await paidOrder(product, customer(), 499);

  await login(page, await user('store_admin'));
  // A 768 px el menú está plegado: basta con que el enlace esté en él.
  await expect(page.locator('a[href="/admin/pedidos"]').first()).toBeAttached();
  await page.goto('/admin/pedidos');
  await expect(page).toHaveURL(/\/admin\/pedidos$/);
  const row = page.getByRole('row').filter({ hasText: `Nº ${order.number}` });
  await expect(row).toContainText(buyer.name);
  await expect(row).toContainText('Por preparar');

  await page.getByRole('link', { name: /^Incidencias · / }).click();
  await expect(
    page.getByRole('link', { name: `Nº ${incident.number}`, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: `Nº ${order.number}`, exact: true }),
  ).toHaveCount(0);

  await page.goto(`/admin/pedidos/${order.order_id}`);
  await expect(
    page.getByRole('heading', { name: `Nº ${order.number}` }),
  ).toBeVisible();
  await expect(page.getByText(buyer.email)).toBeVisible();
  await expect(page.getByText(product.name)).toBeVisible();
  await page.getByRole('button', { name: 'Empezar a preparar' }).click();
  await page.getByRole('button', { name: 'Listo para recoger' }).click();
  const before = await level(product);
  await page.getByRole('button', { name: 'Entregado al cliente' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Entregado' })
    .click();
  await expect(page.getByText('Completado', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Entregado al cliente' }),
  ).toHaveCount(0);
  expect(await level(product)).toEqual({
    onHand: before.onHand - 1,
    reserved: before.reserved - 1,
  });
  await expect(page.getByText('unidades descontadas del stock')).toBeVisible();
  // Correos al cliente (P06): sin proveedor en la CI, esperan en la cola.
  const emails = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'Correos al cliente' }),
  });
  await expect(
    emails.getByText('Confirmación del pago, con las condiciones'),
  ).toBeVisible();
  await expect(
    emails.getByText('Aviso de «listo para recoger»'),
  ).toBeVisible();
  await expect(emails.getByText('Pendiente de envío')).toHaveCount(2);
  await expect(
    emails.getByText('El correo aún no está configurado'),
  ).toBeVisible();

  await page.goto(`/admin/pedidos/${incident.order_id}`);
  await expect(page.getByRole('note')).toContainText(
    'El importe cobrado no coincide con el del pedido',
  );
  await page.getByRole('button', { name: 'Dar por pagado' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Dar por pagado' })
    .click();
  await expect(
    page.getByRole('button', { name: 'Empezar a preparar' }),
  ).toBeVisible();
  await expect(page.getByText('Incidencia resuelta')).toBeVisible();
  await page.goto('/admin/pedidos?vista=incidencias');
  await expect(
    page.getByRole('link', { name: `Nº ${incident.number}`, exact: true }),
  ).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test('encargado: ve los pedidos sin datos del cliente ni pasos', async ({
  page,
}) => {
  const product = await makeProduct(1);
  const buyer = customer();
  const order = await paidOrder(product, buyer, 4990);

  await login(page, await user('viewer'));
  await page.goto('/admin/pedidos');
  await expect(
    page.getByRole('link', { name: `Nº ${order.number}`, exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Cliente' })).toHaveCount(
    0,
  );
  expect(await page.content()).not.toContain(buyer.name);

  await page.goto(`/admin/pedidos/${order.order_id}`);
  await expect(
    page.getByText(
      'Los datos del cliente solo los ve quien tiene el permiso de clientes.',
    ),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Empezar a preparar' }),
  ).toHaveCount(0);
  const html = await page.content();
  expect(html).not.toContain(buyer.email);
  expect(html).not.toContain(buyer.name);
});
