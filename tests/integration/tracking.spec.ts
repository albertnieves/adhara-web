import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import {
  ALL_DENIED,
  ALL_GRANTED,
} from '../../src/modules/tracking/domain/consent';
import { consentState } from '../support/legal-consent';
import { readQueues, stubTrackers, TRACKING_ON } from '../support/tracking';
import { fakeBank, nextVisit, notificationBody, notify } from './bank';
import type { TestProduct } from './support';
import { archiveProduct, sellableProduct } from './support';

/*
 * Eventos de compra para la analítica y la publicidad aceptadas (DECISIONS
 * §179), de la ficha al pedido pagado, con el TPV simulado: lo que recibe
 * cada proveedor, una sola compra por pedido y nada si se rechazaron. Las
 * etiquetas se sirven vacías: las llamadas se leen en sus colas.
 */

test.skip(!TRACKING_ON, 'Solo con IDs de analítica y publicidad (e2e.yml)');
test.use({ viewport: { width: 390, height: 844 } });

const created: TestProduct[] = [];
test.afterEach(() => {
  for (const product of created.splice(0)) archiveProduct(product);
});

/** Nombre de los eventos de Google (gtag('event', nombre, …)), en orden. */
async function googleEvents(page: Page) {
  const { gtag } = await page.evaluate(readQueues);
  return gtag.filter((call) => call[0] === 'event');
}

async function buy(page: Page, product: TestProduct) {
  await page.goto(`/es/perfume/${product.slug}`);
  await page.getByRole('button', { name: 'Añadir a la cesta' }).click();
  await expect(page.getByText('Añadido a tu cesta.')).toBeVisible();
  const afterCart = await googleEvents(page);
  await page.goto('/es/finalizar-compra');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Finalizar compra' }),
  ).toBeVisible();
  const atCheckout = await googleEvents(page);
  await page.getByLabel('Nombre y apellidos').fill('Cliente de medición');
  await page
    .getByLabel('Email', { exact: true })
    .fill(`medicion-${randomUUID().slice(0, 8)}@test.invalid`);
  await page.getByText('He leído y acepto las').click();
  return { afterCart, atCheckout };
}

test.describe('con todo aceptado', () => {
  test.use({ storageState: consentState(ALL_GRANTED) });

  test('ficha, cesta, pedido y una sola compra, sin datos de contacto', async ({
    page,
    context,
  }) => {
    await stubTrackers(context);
    const visits = await fakeBank(page);
    const product = await sellableProduct(3);
    created.push(product);

    const { afterCart, atCheckout } = await buy(page, product);
    const item = {
      item_id: product.variantId,
      item_name: product.name,
      price: 49.9,
      quantity: 1,
    };
    expect(afterCart.map((call) => call[1])).toEqual([
      'view_item',
      'add_to_cart',
    ]);
    expect(afterCart[1]![2]).toMatchObject({
      currency: 'EUR',
      value: 49.9,
      items: [item],
    });
    expect(atCheckout.map((call) => call[1])).toEqual(['begin_checkout']);
    expect(atCheckout[0]![2]).toMatchObject({ value: 49.9, items: [item] });

    await page
      .getByRole('button', { name: 'Confirmar pedido y pagar' })
      .click();
    const params = await nextVisit(page, visits, 1);
    // Vuelve antes del aviso del banco: «confirmando» no cuenta como compra.
    await page.goto(params.DS_MERCHANT_URLOK!);
    await expect(
      page.getByRole('heading', { name: 'Confirmando el pago…' }),
    ).toBeVisible();
    expect(
      (await googleEvents(page)).filter((call) => call[1] === 'purchase'),
    ).toEqual([]);

    const body = notificationBody({
      order: params.DS_MERCHANT_ORDER!,
      amount: '4990',
    });
    expect((await notify(page.request, body)).status()).toBe(200);
    await expect(
      page.getByRole('heading', { name: 'Pago confirmado' }),
    ).toBeVisible({ timeout: 15_000 });
    const number = Number(
      (await page.getByText(/^Pedido Nº \d+$/).textContent())!.replace(
        /\D/g,
        '',
      ),
    );
    await expect
      .poll(async () =>
        (await googleEvents(page)).filter(
          (call) => call[1] === 'purchase' || call[1] === 'conversion',
        ),
      )
      .toEqual([
        [
          'event',
          'purchase',
          {
            transaction_id: String(number),
            value: 49.9,
            currency: 'EUR',
            shipping: 0,
          },
        ],
        [
          'event',
          'conversion',
          {
            send_to: 'AW-100000001/e2eCompra',
            value: 49.9,
            currency: 'EUR',
            transaction_id: String(number),
          },
        ],
      ]);
    const queues = await page.evaluate(readQueues);
    expect(queues.fbq).toContainEqual([
      'track',
      'Purchase',
      { value: 49.9, currency: 'EUR', content_type: 'product' },
      { eventID: `pedido-${number}` },
    ]);
    expect(queues.ttq).toContainEqual([
      'track',
      'Purchase',
      { value: 49.9, currency: 'EUR', content_type: 'product' },
      { event_id: `pedido-${number}` },
    ]);
    // Nada de quien compra: ni el email, ni el nombre.
    expect(JSON.stringify(queues)).not.toMatch(/@test\.invalid|Cliente de/);

    // Volver a la página no cuenta otra venta.
    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'Pago confirmado' }),
    ).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(
      (await googleEvents(page)).filter((call) => call[1] === 'purchase'),
    ).toEqual([]);
  });
});

test.describe('con todo rechazado', () => {
  test.use({ storageState: consentState(ALL_DENIED) });

  test('comprar no llama a ningún proveedor', async ({ page, context }) => {
    const hosts = await stubTrackers(context);
    const product = await sellableProduct(3);
    created.push(product);
    await buy(page, product);
    expect(hosts).toEqual([]);
    expect(await page.evaluate(readQueues)).toEqual({
      gtag: [],
      fbq: [],
      ttq: [],
    });
  });
});
