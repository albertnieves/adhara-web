import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import type { TestProduct } from './support';
import {
  admin,
  archiveProduct,
  login,
  psql,
  sellableProduct,
  user,
} from './support';

/*
 * Cesta y checkout de la tienda (PLAN_PEDIDOS_WEB, P03) contra Supabase
 * local, con WEB_CHECKOUT=1 (e2e.yml). Sin TPV todavía: el pedido queda
 * pendiente de pago con su reserva y la confirmación lo dice.
 */

test.use({ viewport: { width: 390, height: 844 } });

const created: TestProduct[] = [];
test.afterEach(() => {
  for (const product of created.splice(0)) archiveProduct(product);
});

async function makeProduct(units: number) {
  const product = await sellableProduct(units);
  created.push(product);
  return product;
}

/** Tarifas de prueba directas en la base (el panel exige MFA; lo prueba otro caso). */
function setRates() {
  psql(`insert into public.shipping_rates (zone, price_cents, free_from_cents, active)
        values ('peninsula', 495, 10000, true), ('baleares', 995, null, false)
        on conflict (zone) do update set price_cents = excluded.price_cents,
          free_from_cents = excluded.free_from_cents, active = excluded.active;`);
}

async function addToBasket(page: Page, product: TestProduct) {
  await page.goto(`/es/perfume/${product.slug}`);
  await page.getByRole('button', { name: 'Añadir a la cesta' }).click();
  await expect(page.getByText('Añadido a tu cesta.')).toBeVisible();
}

async function orderByEmail(email: string) {
  const { data, error } = await admin
    .from('order_contacts')
    .select(
      'email, postal_code, orders!inner(status, reservation, fulfillment, items_cents, shipping_cents, total_cents)',
    )
    .eq('email', email)
    .single();
  if (error) throw error;
  return data as unknown as {
    email: string;
    postal_code: string | null;
    orders: {
      status: string;
      reservation: string;
      fulfillment: string;
      items_cents: number;
      shipping_cents: number;
      total_cents: number;
    };
  };
}

test('cesta y recogida en tienda: del perfume al pedido reservado', async ({
  page,
}) => {
  const product = await makeProduct(5);
  await addToBasket(page, product);
  await expect(
    page.getByRole('link', { name: 'Cesta, 1 artículo' }),
  ).toBeVisible();

  await page.getByRole('link', { name: 'Ver la cesta' }).click();
  await expect(page).toHaveURL(/\/es\/cesta$/);
  await expect(page.getByRole('link', { name: product.name })).toBeVisible();
  await page
    .getByRole('button', { name: `Una unidad más de ${product.name} 100 ml` })
    .click();
  await expect(page.getByText('99,80 €').first()).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  await page.getByRole('link', { name: 'Finalizar compra' }).click();
  await expect(page).toHaveURL(/\/es\/finalizar-compra$/);
  const email = `cliente-${randomUUID().slice(0, 8)}@test.invalid`;
  await page.getByLabel('Nombre y apellidos').fill('Cliente de prueba');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByRole('button', { name: 'Confirmar pedido y pagar' }).click();
  await expect(
    page.getByText('Para comprar, acepta las condiciones de venta.'),
  ).toBeVisible();
  // Lo escrito sigue ahí tras el error.
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue(email);
  await page.getByText('He leído y acepto las').click();
  await page.getByRole('button', { name: 'Confirmar pedido y pagar' }).click();
  await expect(
    page.getByRole('heading', { name: /^Pedido Nº \d+ registrado$/ }),
  ).toBeVisible();
  await expect(
    page.getByText('El pago con tarjeta aún no está conectado'),
  ).toBeVisible();

  const order = await orderByEmail(email);
  expect(order.orders).toMatchObject({
    status: 'pending_payment',
    reservation: 'active',
    fulfillment: 'click_collect',
    items_cents: 9980,
    shipping_cents: 0,
    total_cents: 9980,
  });
  // La cesta queda vacía.
  await page.goto('/es/cesta');
  await expect(page.getByText('Tu cesta está vacía')).toBeVisible();
});

test('envío a domicilio: zona, tarifa del panel y dirección', async ({
  page,
}) => {
  setRates();
  const product = await makeProduct(5);
  await addToBasket(page, product);
  await page.goto('/es/finalizar-compra');
  const email = `envio-${randomUUID().slice(0, 8)}@test.invalid`;
  await page.getByLabel('Nombre y apellidos').fill('Cliente de envío');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByText('Envío a domicilio', { exact: true }).click();
  await page.getByLabel('Calle y número').fill('Carrer de Prova 1');
  await page.getByLabel('Población').fill('Las Palmas');

  // Canarias: sin envío.
  await page.getByLabel('Código postal').fill('35001');
  await expect(
    page.getByText('Aún no enviamos a esta zona.').first(),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Confirmar pedido y pagar' }),
  ).toBeDisabled();
  // Baleares: tarifa apagada.
  await page.getByLabel('Código postal').fill('07001');
  await expect(
    page.getByRole('button', { name: 'Confirmar pedido y pagar' }),
  ).toBeDisabled();
  // Península: 4,95 € de envío.
  await page.getByLabel('Código postal').fill('08860');
  await page.getByLabel('Población').fill('Castelldefels');
  await expect(page.getByText('4,95 €')).toBeVisible();
  await expect(page.getByText('54,85 €')).toBeVisible();

  await page.getByText('He leído y acepto las').click();
  await page.getByRole('button', { name: 'Confirmar pedido y pagar' }).click();
  await expect(
    page.getByText('El envío a domicilio necesita un teléfono.'),
  ).toBeVisible();
  await page.getByLabel('Teléfono').fill('+34 600 000 000');
  await page.getByRole('button', { name: 'Confirmar pedido y pagar' }).click();
  await expect(
    page.getByRole('heading', { name: /^Pedido Nº \d+ registrado$/ }),
  ).toBeVisible();

  const order = await orderByEmail(email);
  expect(order.postal_code).toBe('08860');
  expect(order.orders).toMatchObject({
    fulfillment: 'shipping',
    items_cents: 4990,
    shipping_cents: 495,
    total_cents: 5485,
  });
});

test('la cesta y el checkout tienen sus rutas en catalán e inglés', async ({
  page,
}) => {
  for (const [path, heading] of [
    ['/ca/cistella', 'La teva cistella'],
    ['/en/basket', 'Your basket'],
    ['/ca/finalitzar-compra', 'Finalitza la compra'],
    ['/en/checkout', 'Checkout'],
  ] as const) {
    await page.goto(path);
    await expect(
      page.getByRole('heading', { level: 1, name: heading }),
    ).toBeVisible();
  }
});

test('panel: el administrador del sistema fija la tarifa de Baleares', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page, await user('system_admin'));
  await page.goto('/admin/configuracion/envios');
  const baleares = page.locator('section').filter({ hasText: 'Illes Balears' });
  await baleares.getByLabel('Precio (€, con IVA)').fill('9,95');
  await baleares.getByLabel('Ofrecer el envío').check();
  await baleares.getByRole('button', { name: 'Guardar' }).click();
  await expect(
    baleares.getByText('Illes Balears: envío activo.'),
  ).toBeVisible();
  const { data } = await admin
    .from('shipping_rates')
    .select('price_cents, active')
    .eq('zone', 'baleares')
    .single();
  expect(data).toEqual({ price_cents: 995, active: true });
});

test('el administrador de la tienda no ve las tarifas', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page, await user('store_admin'));
  await page.goto('/admin/configuracion/envios');
  await expect(
    page.getByRole('heading', { name: '404', exact: true }),
  ).toBeVisible();
});
