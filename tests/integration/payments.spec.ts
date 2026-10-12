import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { CONSENT_ACCEPTED } from '../support/legal-consent';
import {
  GATEWAY,
  fakeBank,
  merchantCode,
  nextVisit,
  notificationBody,
  notify,
} from './bank';
import type { TestProduct } from './support';
import { admin, archiveProduct, psql, sellableProduct } from './support';

/*
 * Pago con tarjeta de extremo a extremo (PLAN_PEDIDOS_WEB, P04 y P07) contra
 * Supabase local y un banco simulado (./bank.ts): pago correcto y denegado,
 * reintento, firma falsa, importe alterado, notificación repetida, última
 * unidad y pago tardío tras caducar la reserva.
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

/** Del perfume a «Confirmar pedido y pagar», con recogida en la tienda. */
async function checkout(page: Page, product: TestProduct, email?: string) {
  await page.goto(`/es/perfume/${product.slug}`);
  await page.getByRole('button', { name: 'Añadir a la cesta' }).click();
  await expect(page.getByText('Añadido a tu cesta.')).toBeVisible();
  await page.goto('/es/finalizar-compra');
  const address = email ?? `pago-${randomUUID().slice(0, 8)}@test.invalid`;
  await page.getByLabel('Nombre y apellidos').fill('Cliente de pagos');
  await page.getByLabel('Email', { exact: true }).fill(address);
  await page.getByText('He leído y acepto las').click();
  return {
    email: address,
    submit: () =>
      page.getByRole('button', { name: 'Confirmar pedido y pagar' }).click(),
  };
}

async function order(email: string) {
  const { data, error } = await admin
    .from('order_contacts')
    .select('orders!inner(id, number, status, reservation, total_cents)')
    .eq('email', email)
    .single();
  if (error) throw error;
  return data.orders as unknown as {
    id: string;
    number: number;
    status: string;
    reservation: string;
    total_cents: number;
  };
}

async function payments(orderId: string) {
  const { data, error } = await admin
    .from('order_payments')
    .select('outcome, decision, reason, amount_cents')
    .eq('order_id', orderId)
    .order('id');
  if (error) throw error;
  return data;
}

test('pago aceptado: banco, vuelta antes del aviso y pedido pagado una sola vez', async ({
  page,
}) => {
  const visits = await fakeBank(page);
  const product = await makeProduct(3);
  const { email, submit } = await checkout(page, product);
  await submit();
  const params = await nextVisit(page, visits, 1);

  const placed = await order(email);
  const { data: attempt } = await admin
    .from('order_payment_attempts')
    .select('reference, amount_cents')
    .eq('order_id', placed.id)
    .single();
  // Importe y referencia de la base; idioma, moneda y aviso del comercio.
  expect(params).toMatchObject({
    DS_MERCHANT_AMOUNT: '4990',
    DS_MERCHANT_ORDER: attempt!.reference,
    DS_MERCHANT_MERCHANTCODE: merchantCode(),
    DS_MERCHANT_CURRENCY: '978',
    DS_MERCHANT_TRANSACTIONTYPE: '0',
    DS_MERCHANT_CONSUMERLANGUAGE: '1',
    DS_MERCHANT_MERCHANTURL: 'http://localhost:3000/api/pagos/redsys',
    DS_MERCHANT_PRODUCTDESCRIPTION: `Pedido Nº ${placed.number}`,
  });

  // Vuelve del banco antes de su aviso: «confirmando», sin confirmar nada.
  await page.goto(params.DS_MERCHANT_URLOK!);
  await expect(page).toHaveURL(/\/es\/pedido\?resultado=ok$/);
  await expect(
    page.getByRole('heading', { name: 'Confirmando el pago…' }),
  ).toBeVisible();
  expect((await order(email)).status).toBe('pending_payment');

  const body = notificationBody({ order: attempt!.reference, amount: '4990' });
  expect((await notify(page.request, body)).status()).toBe(200);
  // La página se vuelve a leer sola.
  await expect(
    page.getByRole('heading', { name: 'Pago confirmado' }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(`Pedido Nº ${placed.number}`)).toBeVisible();
  expect(await order(email)).toMatchObject({
    status: 'paid',
    reservation: 'committed',
  });

  // La confirmación al cliente queda en la cola (P06), una sola vez.
  const { data: emails } = await admin
    .from('order_emails')
    .select('kind, status')
    .eq('order_id', placed.id);
  expect(emails).toEqual([{ kind: 'order_paid', status: 'pending' }]);

  // El banco repite la notificación: un solo cobro.
  expect((await notify(page.request, body)).status()).toBe(200);
  expect(await payments(placed.id)).toEqual([
    {
      outcome: 'succeeded',
      decision: 'confirm',
      reason: null,
      amount_cents: 4990,
    },
  ]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test('pago denegado: vuelve, reintenta con otra referencia y paga', async ({
  page,
}) => {
  const visits = await fakeBank(page);
  const product = await makeProduct(3);
  const { email, submit } = await checkout(page, product);
  await submit();
  const first = await nextVisit(page, visits, 1);

  expect(
    (
      await notify(
        page.request,
        notificationBody({
          order: first.DS_MERCHANT_ORDER!,
          amount: '4990',
          response: '0190',
          authorisation: '++++++',
        }),
      )
    ).status(),
  ).toBe(200);
  await page.goto(first.DS_MERCHANT_URLKO!);
  await expect(page).toHaveURL(/\/es\/pedido\?resultado=ko$/);
  await expect(
    page.getByRole('heading', { name: 'El pago no se ha completado' }),
  ).toBeVisible();
  await expect(
    page.getByText(/Tus perfumes siguen reservados hasta las \d/),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Volver a intentar el pago' }).click();
  const second = await nextVisit(page, visits, 2);
  expect(second.DS_MERCHANT_ORDER).not.toBe(first.DS_MERCHANT_ORDER);
  expect(second.DS_MERCHANT_AMOUNT).toBe('4990');

  expect(
    (
      await notify(
        page.request,
        notificationBody({ order: second.DS_MERCHANT_ORDER!, amount: '4990' }),
      )
    ).status(),
  ).toBe(200);
  await page.goto(second.DS_MERCHANT_URLOK!);
  await expect(
    page.getByRole('heading', { name: 'Pago confirmado' }),
  ).toBeVisible();
  const placed = await order(email);
  expect(placed.status).toBe('paid');
  expect(await payments(placed.id)).toEqual([
    {
      outcome: 'declined',
      decision: 'ignore',
      reason: 'not_paid',
      amount_cents: 4990,
    },
    {
      outcome: 'succeeded',
      decision: 'confirm',
      reason: null,
      amount_cents: 4990,
    },
  ]);
});

test('notificaciones falsas o ajenas no tocan el pedido; un importe distinto es incidencia', async ({
  page,
}) => {
  const visits = await fakeBank(page);
  const product = await makeProduct(3);
  const { email, submit } = await checkout(page, product);
  await submit();
  const params = await nextVisit(page, visits, 1);
  const reference = params.DS_MERCHANT_ORDER!;

  // Firma inventada.
  const forged = notificationBody({ order: reference, amount: '4990' });
  forged.Ds_Signature = `${'A'.repeat(43)}=`;
  expect((await notify(page.request, forged)).status()).toBe(400);
  // Importe cambiado después de firmar: la firma ya no cuadra.
  const tampered = notificationBody({ order: reference, amount: '4990' }, (e) =>
    Buffer.from(
      Buffer.from(e, 'base64')
        .toString('utf8')
        .replace('"Ds_Amount":"4990"', '"Ds_Amount":"1"'),
    ).toString('base64'),
  );
  expect((await notify(page.request, tampered)).status()).toBe(400);
  // Sin cuerpo, o con un cuerpo que no es del banco.
  expect(
    (await page.request.post('/api/pagos/redsys', { data: 'hola' })).status(),
  ).toBe(400);
  // Bien firmadas pero de otro comercio o de otro tipo de operación: se
  // reciben y no hacen nada.
  expect(
    (
      await notify(
        page.request,
        notificationBody({
          order: reference,
          amount: '4990',
          merchant: '123456789',
        }),
      )
    ).status(),
  ).toBe(200);
  expect(
    (
      await notify(
        page.request,
        notificationBody({
          order: reference,
          amount: '4990',
          response: '0900',
          transactionType: '3',
        }),
      )
    ).status(),
  ).toBe(200);
  // Referencia que no existe: la base la rechaza.
  expect(
    (
      await notify(
        page.request,
        notificationBody({ order: '999999999999', amount: '4990' }),
      )
    ).status(),
  ).toBe(200);
  const placed = await order(email);
  expect(placed.status).toBe('pending_payment');
  expect(await payments(placed.id)).toEqual([]);

  // Un cobro de otro importe (lo diría el banco): incidencia, no pagado.
  expect(
    (
      await notify(
        page.request,
        notificationBody({ order: reference, amount: '100' }),
      )
    ).status(),
  ).toBe(200);
  expect((await order(email)).status).toBe('needs_attention');
  expect(await payments(placed.id)).toEqual([
    {
      outcome: 'succeeded',
      decision: 'review',
      reason: 'amount_mismatch',
      amount_cents: 100,
    },
  ]);
  await page.goto(params.DS_MERCHANT_URLOK!);
  await expect(
    page.getByRole('heading', { name: 'Estamos revisando tu pago' }),
  ).toBeVisible();
});

test('la última unidad solo la compra uno', async ({ page, browser }) => {
  const product = await makeProduct(1);
  const other = await browser.newContext({
    baseURL: 'http://localhost:3000',
    storageState: CONSENT_ACCEPTED,
    viewport: { width: 390, height: 844 },
  });
  const second = await other.newPage();
  const visits = await fakeBank(page);
  await fakeBank(second);

  const a = await checkout(page, product);
  const b = await checkout(second, product);
  await a.submit();
  await nextVisit(page, visits, 1);
  await b.submit();
  await expect(
    second.getByText(/Algo ha cambiado en tu cesta|Ya no quedan unidades/),
  ).toBeVisible();
  await expect(
    second.getByRole('link', { name: 'Volver a la cesta' }).first(),
  ).toBeVisible();
  const { data: lines, error } = await admin
    .from('order_lines')
    .select('order_id')
    .eq('variant_id', product.variantId);
  if (error) throw error;
  expect(lines).toHaveLength(1);
  await other.close();
});

test('pago tardío: con la reserva ya liberada no se confirma, se revisa', async ({
  page,
}) => {
  const visits = await fakeBank(page);
  const product = await makeProduct(2);
  const { email, submit } = await checkout(page, product);
  await submit();
  const params = await nextVisit(page, visits, 1);
  const placed = await order(email);

  // Pasa la media hora sin pagar y la tarea programada libera la reserva.
  psql(
    `update public.orders set reserved_until = now() - interval '1 minute'
     where id = :'id';`,
    { id: placed.id },
  );
  const { error } = await admin.rpc('web_order_release_expired', {
    p_limit: 100,
  });
  if (error) throw error;
  expect(await order(email)).toMatchObject({
    status: 'pending_payment',
    reservation: 'released',
  });
  await page.goto(params.DS_MERCHANT_URLKO!);
  await expect(
    page.getByRole('heading', { name: 'La reserva ha caducado' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Volver a intentar el pago' }),
  ).toHaveCount(0);

  // Y entonces llega el cobro: incidencia para el personal, sin reservar.
  expect(
    (
      await notify(
        page.request,
        notificationBody({
          order: params.DS_MERCHANT_ORDER!,
          amount: '4990',
        }),
      )
    ).status(),
  ).toBe(200);
  expect(await order(email)).toMatchObject({
    status: 'needs_attention',
    reservation: 'released',
  });
  expect((await payments(placed.id))[0]).toMatchObject({
    decision: 'review',
    reason: 'reservation_unavailable',
  });
});

test('la página del pedido sin pedido en este navegador no enseña nada', async ({
  page,
}) => {
  await page.goto('/es/pedido?resultado=ok');
  await expect(
    page.getByRole('heading', { name: 'No encontramos tu pedido' }),
  ).toBeVisible();
  await page.context().addCookies([
    {
      name: 'atelier_pedido',
      value: randomUUID(),
      domain: 'localhost',
      path: '/',
    },
  ]);
  await page.goto('/ca/comanda');
  await expect(
    page.getByRole('heading', { name: 'No trobem la teva comanda' }),
  ).toBeVisible();
  for (const [path, heading] of [
    ['/en/order', 'We cannot find your order'],
    ['/es/pedido', 'No encontramos tu pedido'],
  ] as const) {
    await page.goto(path);
    await expect(
      page.getByRole('heading', { level: 1, name: heading }),
    ).toBeVisible();
  }
  expect(GATEWAY).toContain('sis-t.redsys.es');
});
