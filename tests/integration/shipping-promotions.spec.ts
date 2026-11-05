import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { collectLayoutIssues } from '../support/layout-audit';
import { fakeBank, nextVisit } from './bank';
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
 * Envío gratis temporal (DECISIONS §189) contra Supabase local y el banco
 * simulado: la cesta lo anuncia y dice si ya se tiene; «Finalizar compra»
 * regala el envío desde el mínimo, también con un código (se suman) y, si la
 * promoción termina antes de pagar, avisa y no cobra un envío que no enseñó;
 * el equipo lo crea y lo apaga en el panel. Cada prueba apaga las suyas al
 * terminar (las pruebas van de una en una: playwright.local.config.ts).
 */

const created: TestProduct[] = [];
test.afterEach(() => {
  for (const product of created.splice(0)) archiveProduct(product);
  psql(
    `update public.shipping_promotions set active = false where name like 'E2E envío%';`,
  );
});

async function makeProduct(units: number) {
  const product = await sellableProduct(units);
  created.push(product);
  return product;
}

/**
 * Envío de prueba directo en la base, como en checkout.spec.ts: península con
 * un servicio manual de 4,09 € sin IVA (4,95 € al cliente), gratis desde
 * 100 €; Baleares apagada. El perfume pesa 400 g y el embalaje 100 g.
 */
function setShipping(product: TestProduct) {
  psql(
    `begin;
     update public.shipping_services set active = false;
     insert into public.shipping_settings (sender_name, address_line1, postal_code,
       city, phone, email, packaging_weight_g, shipping_vat_bps)
     values ('L''Atelier du Désert', 'Carrer de Pompeu Fabra 1', '08860',
       'Castelldefels', '600000000', 'tienda@test.invalid', 100, 2100)
     on conflict (id) do update set packaging_weight_g = 100, shipping_vat_bps = 2100;
     insert into public.shipping_services (provider, code, carrier_code, carrier_name,
       name, zones, active, transit_days, free_eligible)
     values ('manual', 'envio-gratis-spec', 'correos', 'Correos', 'Paq Estándar',
       '{peninsula}', true, 2, true)
     on conflict (provider, code) do update set active = true, zones = '{peninsula}',
       free_eligible = true;
     delete from internal.shipping_service_rates r using public.shipping_services s
       where s.id = r.service_id and s.code = 'envio-gratis-spec';
     insert into internal.shipping_service_rates (service_id, zone, min_weight_g,
       max_weight_g, cost_cents)
     select id, 'peninsula', 1, 30000, 409 from public.shipping_services
       where code = 'envio-gratis-spec';
     insert into public.shipping_rates (zone, price_cents, free_from_cents, active)
     values ('peninsula', null, 10000, true), ('baleares', null, null, false)
     on conflict (zone) do update set price_cents = null,
       free_from_cents = excluded.free_from_cents, active = excluded.active;
     update public.product_variants set shipping_weight_g = 400 where id = :'variant';
     commit;`,
    { variant: product.variantId },
  );
}

/** Envío gratis a la península desde un importe, durante un día. */
function makeShippingPromotion(minItemsCents: number) {
  const name = `E2E envío ${randomUUID().slice(0, 8)}`;
  psql(
    `insert into public.shipping_promotions (name, min_items_cents, zones, ends_at)
     values (:'name', :'min'::integer, '{peninsula}', now() + interval '1 day');`,
    { name, min: String(minItemsCents) },
  );
  return name;
}

function makeCode(percent: number) {
  const code = `E2E-${randomUUID().slice(0, 6).toUpperCase()}`;
  psql(
    `insert into public.discount_codes (code, kind, percent_bp, once_per_email)
     values (:'code', 'percent', :'bp'::integer, false);`,
    { code, bp: String(percent * 100) },
  );
  return code;
}

async function addToCart(page: Page, product: TestProduct) {
  await page.goto(`/es/perfume/${product.slug}`);
  await page.getByRole('button', { name: 'Añadir a la cesta' }).click();
  await expect(page.getByText('Añadido a tu cesta.')).toBeVisible();
}

/** «Finalizar compra» con envío a Castelldefels. */
async function fillShipping(page: Page, email: string) {
  await page.goto('/es/finalizar-compra');
  await page.getByLabel('Nombre y apellidos').fill('Cliente del envío gratis');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByText('Envío a domicilio', { exact: true }).click();
  await page.getByLabel('Teléfono').fill('+34 600 000 000');
  await page.getByLabel('Calle y número').fill('Carrer de Prova 1');
  await page.getByLabel('Código postal').fill('08860');
  await page.getByLabel('Población').fill('Castelldefels');
  await page.getByText('He leído y acepto las').click();
}

async function orderOf(email: string) {
  const { data, error } = await admin
    .from('order_contacts')
    .select(
      'orders!inner(discount_cents, shipping_cents, total_cents, shipping_promotion_name, shipping_promotion_cents)',
    )
    .eq('email', email);
  if (error) throw error;
  return data.map((row) => row.orders);
}

test.describe('cliente', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('la cesta lo anuncia y el resumen regala el envío, también con un código', async ({
    page,
  }) => {
    const visits = await fakeBank(page);
    const product = await makeProduct(5);
    setShipping(product);
    makeShippingPromotion(4000);
    const code = makeCode(10);
    const email = `envio-gratis-${randomUUID().slice(0, 8)}@test.invalid`;

    // 49,90 € pasan de 40 €: ya lo tiene.
    await addToCart(page, product);
    await page.goto('/es/cesta');
    const aside = page.getByRole('complementary');
    await expect(
      aside.getByText('Envío gratis', { exact: true }),
    ).toBeVisible();
    await expect(
      aside.getByText(
        /Envío gratis en pedidos desde 40\s€\. Hasta el .+\. Ya lo tienes: el envío te sale gratis\./,
      ),
    ).toBeVisible();

    await fillShipping(page, email);
    await expect(
      page.getByRole('radio', { name: /Correos · Paq Estándar · Gratis/ }),
    ).toBeChecked();
    await expect(page.getByText(/Gratis con este pedido/)).toBeVisible();
    const summary = page.getByRole('complementary');
    await expect(
      summary.getByText(
        /Envío gratis a partir de 40\s€ en artículos hasta el .+\./,
      ),
    ).toBeVisible();
    await expect(summary.getByText(/49,90\s€/).last()).toBeVisible();

    // Un código del 10 % se suma: 44,91 € siguen pasando de 40 €.
    const field = page.getByLabel('Código de descuento');
    await field.fill(code);
    await field.press('Enter');
    await expect(summary.getByText(`Código ${code} aplicado`)).toBeVisible();
    await expect(summary.getByText(/44,91\s€/)).toBeVisible();
    await expect(
      page.getByRole('radio', { name: /Correos · Paq Estándar · Gratis/ }),
    ).toBeChecked();

    // El resumen con el envío regalado, sin desbordes ni fallos de axe.
    const { blocking } = await page.evaluate(collectLayoutIssues, 24);
    expect(blocking, blocking.join('\n')).toEqual([]);
    const axe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(axe.violations.map((v) => v.id)).toEqual([]);

    await page
      .getByRole('button', { name: 'Confirmar pedido y pagar' })
      .click();
    const bank = await nextVisit(page, visits, 1);
    expect(bank.DS_MERCHANT_AMOUNT).toBe('4491');
    expect(await orderOf(email)).toEqual([
      {
        discount_cents: 499,
        shipping_cents: 0,
        total_cents: 4491,
        shipping_promotion_name: expect.stringMatching(/^E2E envío /),
        shipping_promotion_cents: 495,
      },
    ]);
  });

  test('si termina antes de pagar, avisa y no cobra un envío que no enseñó', async ({
    page,
  }) => {
    const visits = await fakeBank(page);
    const product = await makeProduct(3);
    setShipping(product);
    const name = makeShippingPromotion(4000);
    const email = `envio-fin-${randomUUID().slice(0, 8)}@test.invalid`;
    await addToCart(page, product);
    await fillShipping(page, email);
    await expect(
      page.getByRole('radio', { name: /Correos · Paq Estándar · Gratis/ }),
    ).toBeChecked();

    psql(
      `update public.shipping_promotions set active = false where name = :'name';`,
      { name },
    );
    await page
      .getByRole('button', { name: 'Confirmar pedido y pagar' })
      .click();
    await expect(
      page.getByText(/El precio del envío ha cambiado mientras comprabas/),
    ).toBeVisible();
    expect(await orderOf(email)).toEqual([]);
    // La página vuelve a calcularlo: el envío se cobra.
    await expect(
      page.getByRole('radio', { name: /Correos · Paq Estándar · 4,95\s€/ }),
    ).toBeChecked();
    await expect(
      page.getByRole('complementary').getByText(/54,85\s€/),
    ).toBeVisible();

    await page
      .getByRole('button', { name: 'Confirmar pedido y pagar' })
      .click();
    expect((await nextVisit(page, visits, 1)).DS_MERCHANT_AMOUNT).toBe('5485');
    expect(await orderOf(email)).toEqual([
      {
        discount_cents: 0,
        shipping_cents: 495,
        total_cents: 5485,
        shipping_promotion_name: null,
        shipping_promotion_cents: null,
      },
    ]);
  });
});

/** Dentro de unos días, como lo escribe un <input type="datetime-local"> en Madrid. */
function madridLocal(daysFromNow: number) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Madrid',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(Date.now() + daysFromNow * 86_400_000))
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

test('el equipo crea un envío gratis para la península y lo apaga en el panel', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await login(page, await user('store_admin'));
  await page.goto('/admin/descuentos');
  await page.getByRole('link', { name: 'Nuevo envío gratis' }).click();
  await expect(page).toHaveURL(/\/admin\/descuentos\/envio-gratis\/nuevo$/);

  const name = `E2E envío panel ${randomUUID().slice(0, 6)}`;
  await page.getByLabel('Nombre').fill(name);
  // Vacío: todos los pedidos, en las dos zonas.
  await expect(
    page.getByText('Envío gratis en todos los pedidos.', { exact: true }),
  ).toBeVisible();
  await page.getByLabel('Desde (€ en artículos, opcional)').fill('30');
  await page.getByRole('checkbox', { name: 'Baleares' }).uncheck();
  await expect(
    page.getByText(/^Envío gratis a la península en pedidos desde 30\s€\.$/),
  ).toBeVisible();
  // Sin fin no se crea.
  await page.getByRole('button', { name: 'Crear envío gratis' }).click();
  await expect(page).toHaveURL(/\/admin\/descuentos\/envio-gratis\/nuevo$/);
  await page.getByLabel('Termina').fill(madridLocal(3));
  await page.getByRole('button', { name: 'Crear envío gratis' }).click();

  await expect(page).toHaveURL(
    /\/admin\/descuentos\/envio-gratis\/[0-9a-f-]+\?creada=1$/,
  );
  await expect(page.getByRole('heading', { name })).toBeVisible();
  await expect(page.getByText('Envío gratis creado.')).toBeVisible();
  await expect(
    page.getByText(/Envío gratis desde 30\s€ · solo la península/),
  ).toBeVisible();

  await page.getByRole('checkbox', { name: 'Activa' }).uncheck();
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByText(`${name}: cambios guardados.`)).toBeVisible();

  const { data } = await admin
    .from('shipping_promotions')
    .select('min_items_cents, zones, active')
    .eq('name', name)
    .single();
  expect(data).toEqual({
    min_items_cents: 3000,
    zones: ['peninsula'],
    active: false,
  });

  await page.goto('/admin/descuentos');
  const row = page.getByRole('row', { name: new RegExp(name) });
  await expect(row).toContainText(/Desde 30\s€/);
  await expect(row).toContainText('solo la península');
  await expect(row).toContainText('Apagada');
});
