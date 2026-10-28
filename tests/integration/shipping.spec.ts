import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { createHmac, randomUUID } from 'node:crypto';
import { fakeBank, nextVisit, notificationBody, notify } from './bank';
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
 * Envíos multitransportista (DECISIONS §171–176) contra Supabase local y la API
 * de Sendcloud simulada (tests/integration/fake-sendcloud.ts): el titular
 * sincroniza las tarifas y activa servicios, la tienda pesa el formato, el
 * cliente elige transportista con el precio de su peso y paga, la tienda ve
 * las tarifas reales, crea la etiqueta, pide la recogida o lo deja en un punto,
 * y el seguimiento firmado avanza el pedido.
 */

const FAKE = 'http://localhost:3997';
test.describe.configure({ mode: 'serial' });

let product: TestProduct;
let storeAdmin: string;

type Call = {
  method: string;
  path: string;
  body: Record<string, unknown> | null;
};
async function calls(page: Page): Promise<Call[]> {
  return (await page.request.get(`${FAKE}/__calls`)).json();
}

function signed(body: unknown) {
  const raw = JSON.stringify(body);
  const signature = createHmac('sha256', process.env.SENDCLOUD_SECRET_KEY!)
    .update(raw)
    .digest('hex');
  return { raw, signature };
}

async function orderOf(email: string) {
  const { data, error } = await admin
    .from('order_contacts')
    .select(
      'orders!inner(id, number, status, shipping_cents, total_cents, shipping_service_label, shipping_weight_g, tracking_reference)',
    )
    .eq('email', email)
    .single();
  if (error) throw error;
  return (
    data as unknown as {
      orders: {
        id: string;
        number: number;
        status: string;
        shipping_cents: number;
        total_cents: number;
        shipping_service_label: string | null;
        shipping_weight_g: number | null;
        tracking_reference: string | null;
      };
    }
  ).orders;
}

/** Compra con envío al 28001 eligiendo `carrier` y la paga en el banco simulado. */
async function buyWith(page: Page, carrier: RegExp, price: string) {
  const visits = await fakeBank(page);
  await page.goto(`/es/perfume/${product.slug}`);
  await page.getByRole('button', { name: 'Añadir a la cesta' }).click();
  await expect(page.getByText('Añadido a tu cesta.')).toBeVisible();
  await page.goto('/es/finalizar-compra');
  const email = `envios-${randomUUID().slice(0, 8)}@test.invalid`;
  await page.getByLabel('Nombre y apellidos').fill('Cliente de envíos');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Teléfono').fill('+34 600 000 000');
  await page.getByText('Envío a domicilio', { exact: true }).click();
  await expect(
    page.getByText(
      'Escribe el código postal para ver los transportistas y sus precios.',
    ),
  ).toBeVisible();
  await page.getByLabel('Calle y número').fill('Calle de Alcalá 1');
  await page.getByLabel('Población').fill('Madrid');
  await page.getByLabel('Código postal').fill('28001');
  // 450 g del perfume + 100 g de embalaje: Correos 4,84 € y SEUR 7,26 €.
  await expect(
    page.getByRole('radio', { name: /Correos · Paq Estándar · 4,84 €/ }),
  ).toBeVisible();
  await expect(
    page.getByRole('radio', { name: /SEUR 24 · 7,26 €/ }),
  ).toBeVisible();
  await page.getByRole('radio', { name: carrier }).check();
  await expect(page.getByText(price, { exact: true })).toBeVisible();
  // La casilla, no el texto: en el centro del texto está el enlace a las condiciones.
  await page.getByRole('checkbox', { name: /He leído y acepto/ }).check();
  await page.getByRole('button', { name: 'Confirmar pedido y pagar' }).click();
  const params = await nextVisit(page, visits, 1);
  const body = notificationBody({
    order: params.DS_MERCHANT_ORDER!,
    amount: params.DS_MERCHANT_AMOUNT!,
  });
  expect((await notify(page.request, body)).status()).toBe(200);
  await expect.poll(async () => (await orderOf(email)).status).toBe('paid');
  return orderOf(email);
}

test.beforeAll(async () => {
  product = await sellableProduct(10);
  storeAdmin = await user('store_admin');
  // Punto de partida conocido: remitente con 100 g de embalaje, las dos zonas
  // con envío y sin envío gratis, y ningún otro servicio activo.
  psql(`begin;
    update public.shipping_services set active = false;
    insert into public.shipping_settings (sender_name, address_line1, postal_code,
      city, phone, email, packaging_weight_g, shipping_vat_bps)
    values ('L''Atelier du Désert', 'Carrer de Pompeu Fabra 1', '08860',
      'Castelldefels', '600000000', 'tienda@test.invalid', 100, 2100)
    on conflict (id) do update set packaging_weight_g = 100, shipping_vat_bps = 2100,
      postal_code = '08860', city = 'Castelldefels';
    insert into public.shipping_rates (zone, price_cents, free_from_cents, active)
    values ('peninsula', null, null, true), ('baleares', null, null, true)
    on conflict (zone) do update set free_from_cents = null, active = true;
    commit;`);
});

test.afterAll(() => {
  archiveProduct(product);
  psql(
    `update public.shipping_services set active = false where provider = 'sendcloud';`,
  );
});

test('el titular sincroniza las tarifas de Sendcloud, activa servicios y pesa el formato', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page, await user('system_admin'));
  await page.goto('/admin/envios/transportistas');
  await expect(page.getByText('Sendcloud conectado')).toBeVisible();
  await page
    .getByRole('button', { name: 'Actualizar tarifas desde Sendcloud' })
    .click();
  await expect(
    page.getByText(/Tarifas actualizadas: 2 servicios con precio/),
  ).toBeVisible({
    timeout: 30000,
  });
  // La entrega en oficina pide un punto de recogida: no se vende.
  const table = page.getByRole('table', { name: 'Servicios de envío' });
  // Los de la plataforma (puede haber manuales con el mismo nombre).
  const synced = (name: string) =>
    table
      .getByRole('row')
      .filter({ hasText: 'Sendcloud' })
      .getByRole('link', { name, exact: true });
  await expect(synced('Correos · Paq Estándar')).toBeVisible();
  await expect(synced('SEUR 24')).toBeVisible();
  await expect(table.getByText('Correos en oficina')).toHaveCount(0);

  // El portal de Sendcloud, a mano, en otra pestaña.
  await expect(
    page.getByRole('link', { name: /Abrir el portal de Sendcloud/ }),
  ).toHaveAttribute('href', 'https://app.sendcloud.com/');

  // SEUR, desde su ficha, después de ver sus tramos.
  await synced('SEUR 24').click();
  const peninsula = page.getByRole('table', {
    name: 'Tramos de peso en Península',
  });
  await expect(peninsula.getByText('7,26 €')).toBeVisible();
  await page.getByLabel('Ofrecer este servicio en la tienda').check();
  await page.getByRole('button', { name: 'Guardar servicio' }).click();
  await expect(page.getByText('Servicio guardado y activo.')).toBeVisible();

  // Correos, con el botón de su fila: se enciende, se apaga y se vuelve a
  // encender sin entrar en la ficha.
  await page.goto('/admin/envios/transportistas');
  const correosRow = table
    .getByRole('row')
    .filter({ hasText: 'Sendcloud' })
    .filter({ hasText: 'Correos · Paq Estándar' });
  await correosRow
    .getByRole('button', { name: 'Encender Correos · Paq Estándar' })
    .click();
  await expect(
    page.getByText(/Correos · Paq Estándar: encendido/),
  ).toBeVisible();
  await expect(correosRow.getByText('Activo', { exact: true })).toBeVisible();
  await correosRow
    .getByRole('button', { name: 'Apagar Correos · Paq Estándar' })
    .click();
  await expect(page.getByText(/Correos · Paq Estándar: apagado/)).toBeVisible();
  await expect(correosRow.getByText('Apagado', { exact: true })).toBeVisible();
  await correosRow
    .getByRole('button', { name: 'Encender Correos · Paq Estándar' })
    .click();
  await expect(correosRow.getByText('Activo', { exact: true })).toBeVisible();
  const { data: services } = await admin
    .from('shipping_services')
    .select('code, active, zones')
    .eq('provider', 'sendcloud')
    .order('code');
  expect(services).toEqual([
    {
      code: 'correos:paq-estandar',
      active: true,
      zones: ['baleares', 'peninsula'],
    },
    { code: 'seur:24', active: true, zones: ['baleares', 'peninsula'] },
  ]);

  // Pesos de envío.
  await page.goto('/admin/envios/pesos');
  await page
    .getByLabel(new RegExp(`Peso de .*${product.name} 100 ml, en gramos`))
    .fill('450');
  await page.getByRole('button', { name: 'Guardar pesos' }).click();
  await expect(page.getByText('1 peso guardado.')).toBeVisible();
});

test('el cliente elige SEUR, la tienda crea la etiqueta, pide la recogida y el seguimiento cierra el pedido', async ({
  page,
}) => {
  const order = await buyWith(page, /SEUR 24 · 7,26 €/, '7,26 €');
  expect(order).toMatchObject({
    shipping_cents: 726,
    total_cents: 4990 + 726,
    shipping_service_label: 'SEUR 24',
    shipping_weight_g: 550,
  });

  await page.context().clearCookies();
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page, storeAdmin);
  await page.goto(`/admin/pedidos/${order.id}`);
  await expect(page.getByRole('heading', { name: 'Envío' })).toBeVisible();
  await page.getByRole('button', { name: 'Ver tarifas reales' }).click();
  const quotes = page.getByRole('table', {
    name: 'Tarifas reales de la plataforma para este paquete',
  });
  await expect(quotes.getByText('Elegido por el cliente')).toBeVisible();
  const seur = quotes.getByRole('row').filter({ hasText: 'SEUR · SEUR 24' });
  await expect(seur.getByText('6 €', { exact: true })).toBeVisible();
  await seur.getByRole('button', { name: 'Crear etiqueta' }).click();
  await expect(
    page.getByText(/Etiqueta creada con SEUR \(seguimiento TRK\d+\)/),
  ).toBeVisible();

  const { data: shipment } = await admin
    .from('shipments')
    .select(
      'id, provider, carrier_code, status, tracking_number, provider_parcel_id, weight_g',
    )
    .eq('order_id', order.id)
    .single();
  expect(shipment).toMatchObject({
    provider: 'sendcloud',
    carrier_code: 'seur',
    status: 'label_created',
    weight_g: 550,
  });
  expect((await orderOf(await emailOf(order.id))).status).toBe('processing');
  const announced = (await calls(page))
    .filter((c) => c.path === '/shipments/announce')
    .at(-1)!;
  expect(announced.body).toMatchObject({
    order_number: String(order.number),
    to_address: { postal_code: '28001', city: 'Madrid', country_code: 'ES' },
    from_address: { postal_code: '08860', company_name: "L'Atelier du Désert" },
    ship_with: {
      properties: { shipping_option_code: 'seur:24', contract_id: 22 },
    },
  });

  // La etiqueta en PDF, al momento desde la plataforma.
  const pdf = await page.request.get(
    `/admin/pedidos/${order.id}/etiqueta?envio=${shipment!.id}&papel=A6`,
  );
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()['content-type']).toBe('application/pdf');
  expect((await pdf.body()).toString('latin1')).toContain('%PDF-1.4');

  // Envíos → Seguimiento: en «Por hacer», en la tarjeta de SEUR, con la
  // recogida al lado y el enlace a la ficha.
  await page.goto(`/admin/envios?q=${order.number}`);
  await expect(
    page.getByRole('link', { name: /Por hacer/, exact: false }),
  ).toHaveAttribute('aria-current', 'page');
  const seurGroup = page.getByRole('region', { name: 'SEUR', exact: true });
  await expect(
    seurGroup.getByRole('link', { name: `Nº ${order.number}` }),
  ).toHaveAttribute('href', `/admin/pedidos/${order.id}#envio`);
  await expect(
    seurGroup.getByText('Pide la recogida o llévalo a un punto de entrega.'),
  ).toBeVisible();
  await expect(
    seurGroup.getByText('Pedir la recogida de 1 paquete'),
  ).toBeVisible();

  // Recogida en la tienda por la plataforma, desde la ficha.
  await page.goto(`/admin/pedidos/${order.id}`);
  await expect(page.getByText('Pedirla por la plataforma')).toBeVisible();
  await page.getByText('La he pedido por teléfono o en su web').click();
  await page.getByText('Pedirla por la plataforma').click();
  await page.getByRole('button', { name: 'Solicitar recogida' }).click();
  await expect(
    page.getByText(/Recogida pedida a SEUR para el .* \(1 paquete\)/),
  ).toBeVisible();
  const pickup = (await calls(page))
    .filter((c) => c.path === '/pickups')
    .at(-1)!;
  expect(pickup.body).toMatchObject({
    carrier_code: 'seur',
    quantity: 1,
    address: { postal_code: '08860' },
  });
  // Pedida: pasa a «Esperando al transportista» con su día.
  await page.goto(`/admin/envios?vista=esperando&q=${order.number}`);
  await expect(
    page
      .getByRole('table', { name: 'Esperando al transportista' })
      .getByText(/^Recogida el .*, de \d{2}:\d{2} a \d{2}:\d{2}\.$/),
  ).toBeVisible();

  // Aviso sin firma: rechazado.
  const event = (
    status: { id: number; message: string },
    timestamp: number,
  ) => ({
    action: 'parcel_status_changed',
    timestamp,
    parcel: {
      id: Number(shipment!.provider_parcel_id),
      tracking_number: shipment!.tracking_number,
      status,
    },
  });
  const forged = await page.request.post('/api/envios/sendcloud', {
    data: event({ id: 11, message: 'Delivered' }, Date.now()),
    headers: { 'Sendcloud-Signature': '0'.repeat(64) },
  });
  expect(forged.status()).toBe(401);

  // El transportista lo recoge: «Enviado» solo, con el correo de seguimiento.
  const picked = signed(
    event({ id: 22, message: 'Shipment picked up by driver' }, Date.now()),
  );
  const first = await page.request.post('/api/envios/sendcloud', {
    data: picked.raw,
    headers: {
      'Sendcloud-Signature': picked.signature,
      'Content-Type': 'application/json',
    },
  });
  expect(first.status()).toBe(200);
  await expect
    .poll(async () => (await orderOf(await emailOf(order.id))).status)
    .toBe('shipped');
  expect((await orderOf(await emailOf(order.id))).tracking_reference).toBe(
    shipment!.tracking_number,
  );
  const { data: emails } = await admin
    .from('order_emails')
    .select('kind')
    .eq('order_id', order.id);
  expect(emails?.map((e) => e.kind)).toContain('shipped');

  // Entregado: el pedido se completa.
  const delivered = signed(
    event({ id: 11, message: 'Delivered' }, Date.now() + 60000),
  );
  expect(
    (
      await page.request.post('/api/envios/sendcloud', {
        data: delivered.raw,
        headers: {
          'Sendcloud-Signature': delivered.signature,
          'Content-Type': 'application/json',
        },
      })
    ).status(),
  ).toBe(200);
  await expect
    .poll(async () => (await orderOf(await emailOf(order.id))).status)
    .toBe('completed');
  await page.reload();
  await expect(page.getByText('Entregado').first()).toBeVisible();
});

async function emailOf(orderId: string) {
  const { data } = await admin
    .from('order_contacts')
    .select('email')
    .eq('order_id', orderId)
    .single();
  return data!.email as string;
}

test('con Correos lo deja en un punto de entrega y el pedido sale', async ({
  page,
}) => {
  const order = await buyWith(
    page,
    /Correos · Paq Estándar · 4,84 €/,
    '4,84 €',
  );
  await page.context().clearCookies();
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page, await user('store_admin'));
  await page.goto(`/admin/pedidos/${order.id}`);
  await page.getByRole('button', { name: 'Ver tarifas reales' }).click();
  await page
    .getByRole('table', {
      name: 'Tarifas reales de la plataforma para este paquete',
    })
    .getByRole('row')
    .filter({ hasText: 'Correos · Paq Estándar' })
    .getByRole('button', { name: 'Crear etiqueta' })
    .click();
  await expect(page.getByText(/Etiqueta creada con Correos/)).toBeVisible();
  await page.reload();
  await page
    .getByRole('button', { name: 'Buscar puntos cerca de la tienda' })
    .click();
  await page.getByText(/Oficina de Correos de Castelldefels/).click();
  await page.getByRole('button', { name: 'Lo he dejado en el punto' }).click();
  await expect(
    page.getByText(`Pedido nº ${order.number}: enviado.`, { exact: false }),
  ).toBeVisible();
  const { data: shipment } = await admin
    .from('shipments')
    .select('handover, dropoff_point')
    .eq('order_id', order.id)
    .single();
  expect(shipment).toEqual({
    handover: 'dropoff',
    dropoff_point: {
      name: 'Oficina de Correos de Castelldefels',
      address: 'Avinguda de la Constitució 10, 08860 Castelldefels',
      id: 'CO-08860',
    },
  });
  expect((await orderOf(await emailOf(order.id))).status).toBe('shipped');
  // Dejado en el punto y sin escanear: en «Esperando al transportista».
  await page.goto(`/admin/envios?vista=esperando&q=${order.number}`);
  await expect(
    page.getByText(
      'Dejado en Oficina de Correos de Castelldefels; falta el primer escaneo.',
    ),
  ).toBeVisible();
});
