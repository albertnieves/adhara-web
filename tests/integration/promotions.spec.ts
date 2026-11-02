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
 * Promociones automáticas (DECISIONS §186) contra Supabase local y el banco
 * simulado: la cesta dice cuánto falta y cuándo ya se tiene; «Finalizar
 * compra» la aplica sola, no la suma a un código (va la que más descuenta) y,
 * si termina antes de pagar, avisa y no cobra más de lo enseñado; el equipo
 * la crea y la apaga en el panel. Cada promoción es solo de la casa del
 * perfume de prueba, así no toca al resto de pruebas.
 */

const created: TestProduct[] = [];
test.afterEach(() => {
  for (const product of created.splice(0)) archiveProduct(product);
  psql(`update public.promotions set active = false where name like 'E2E %';`);
});

async function makeProduct(units: number) {
  const product = await sellableProduct(units);
  created.push(product);
  return product;
}

/** Casa del perfume de prueba (sellableProduct crea una para cada uno). */
async function brandOf(product: TestProduct) {
  const { data, error } = await admin
    .from('products')
    .select('brand:brands!inner(id, name)')
    .eq('slug', product.slug)
    .single();
  if (error) throw error;
  return data.brand as unknown as { id: string; name: string };
}

/** Promoción en porcentaje desde un importe, solo de la casa del perfume. */
async function makePromotion(
  product: TestProduct,
  percent: number,
  minItemsCents: number,
) {
  const brand = await brandOf(product);
  const name = `E2E promo ${randomUUID().slice(0, 8)}`;
  psql(
    `insert into public.promotions (name, kind, percent_bp, min_items_cents, brand_id)
     values (:'name', 'percent', :'bp'::integer, :'min'::integer, :'brand'::uuid);`,
    {
      name,
      bp: String(percent * 100),
      min: String(minItemsCents),
      brand: brand.id,
    },
  );
  return { name, brand };
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

async function fillCheckout(page: Page, email: string) {
  await page.goto('/es/finalizar-compra');
  await page.getByLabel('Nombre y apellidos').fill('Cliente de promociones');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByText('He leído y acepto las').click();
}

async function orderOf(email: string) {
  const { data, error } = await admin
    .from('order_contacts')
    .select(
      'orders!inner(status, discount_code, promotion_name, discount_cents, total_cents)',
    )
    .eq('email', email);
  if (error) throw error;
  return data.map((row) => row.orders);
}

test.describe('cliente', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('la cesta dice cuánto falta, el resumen la aplica y gana a un código menor', async ({
    page,
  }) => {
    const visits = await fakeBank(page);
    const product = await makeProduct(5);
    const { brand } = await makePromotion(product, 10, 8000);
    const code = makeCode(5);
    const email = `promo-${randomUUID().slice(0, 8)}@test.invalid`;

    // Un perfume (49,90 €): faltan 30,10 € para llegar a 80 €.
    await addToCart(page, product);
    await page.goto('/es/cesta');
    const aside = page.getByRole('complementary');
    await expect(
      aside.getByText(
        new RegExp(
          `10\\s%\\sde descuento en ${brand.name} al llevar 80\\s€ o más de esa casa\\.`,
        ),
      ),
    ).toBeVisible();
    await expect(
      aside.getByText(/Te faltan 30,10\s€ para conseguirla\./),
    ).toBeVisible();

    // Dos (99,80 €): ya la tiene.
    await addToCart(page, product);
    await page.goto('/es/cesta');
    await expect(
      page
        .getByRole('complementary')
        .getByText(
          /Ya la tienes: 9,98\s€ menos, que se descuentan al finalizar la compra\./,
        ),
    ).toBeVisible();

    await fillCheckout(page, email);
    const summary = page.getByRole('complementary');
    await expect(summary.getByText('Promoción aplicada')).toBeVisible();
    await expect(summary.getByText('Promoción', { exact: true })).toBeVisible();
    await expect(summary.getByText(/−9,98\s€/)).toBeVisible();
    await expect(summary.getByText(/89,82\s€/)).toBeVisible();

    // Un código del 5 % (4,99 €) no se suma ni gana a la promoción (9,98 €).
    const field = page.getByLabel('Código de descuento');
    await field.fill(code);
    await field.press('Enter');
    await expect(
      summary.getByText(`Código ${code}: no se aplica`),
    ).toBeVisible();
    await expect(
      summary.getByText(/La promoción descuenta lo mismo o más que tu código/),
    ).toBeVisible();
    await expect(summary.getByText(/89,82\s€/)).toBeVisible();

    // El resumen con la promoción y el código, sin desbordes ni fallos de axe.
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
    expect(bank.DS_MERCHANT_AMOUNT).toBe('8982');
    expect(await orderOf(email)).toEqual([
      {
        status: 'pending_payment',
        discount_code: null,
        promotion_name: expect.stringMatching(/^E2E promo /),
        discount_cents: 998,
        total_cents: 8982,
      },
    ]);
    // El código no se ha gastado.
    const { count } = await admin
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('discount_code', code);
    expect(count).toBe(0);
  });

  test('si la promoción termina antes de pagar, avisa y no cobra más de lo enseñado', async ({
    page,
  }) => {
    const visits = await fakeBank(page);
    const product = await makeProduct(3);
    const { name } = await makePromotion(product, 10, 4000);
    const email = `promo-fin-${randomUUID().slice(0, 8)}@test.invalid`;
    await addToCart(page, product);
    await fillCheckout(page, email);
    const summary = page.getByRole('complementary');
    await expect(summary.getByText(/44,91\s€/)).toBeVisible();

    psql(`update public.promotions set active = false where name = :'name';`, {
      name,
    });
    await page
      .getByRole('button', { name: 'Confirmar pedido y pagar' })
      .click();
    await expect(
      page.getByText(/El descuento ha cambiado mientras comprabas/),
    ).toBeVisible();
    expect(await orderOf(email)).toEqual([]);
    // La página vuelve a calcularlo: sin promoción, el precio completo.
    await expect(summary.getByText('Promoción aplicada')).toBeHidden();
    await expect(summary.getByText(/−4,99\s€/)).toBeHidden();
    await expect(summary.getByText(/49,90\s€/).last()).toBeVisible();

    await page
      .getByRole('button', { name: 'Confirmar pedido y pagar' })
      .click();
    expect((await nextVisit(page, visits, 1)).DS_MERCHANT_AMOUNT).toBe('4990');
  });
});

test('el equipo crea una promoción de una casa y la apaga en el panel', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const product = await makeProduct(1);
  const brand = await brandOf(product);
  await login(page, await user('store_admin'));
  await page.goto('/admin/descuentos');
  await expect(
    page.getByRole('heading', { name: 'Descuentos y promociones' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Nueva promoción' }).click();
  await expect(page).toHaveURL(/\/admin\/descuentos\/promociones\/nueva$/);

  const name = `E2E promo panel ${randomUUID().slice(0, 6)}`;
  await page.getByLabel('Nombre').fill(name);
  await page.getByLabel('Porcentaje (%)').fill('15');
  await page.getByLabel('Desde (€ en artículos)').fill('60');
  await page.getByLabel('Casa').selectOption({ label: brand.name });
  await expect(
    page.getByText(
      new RegExp(
        `15\\s%\\sde descuento en ${brand.name} al llevar 60\\s€ o más de esa casa\\.`,
      ),
    ),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Crear promoción' }).click();

  await expect(page).toHaveURL(
    /\/admin\/descuentos\/promociones\/[0-9a-f-]+\?creada=1$/,
  );
  await expect(page.getByRole('heading', { name })).toBeVisible();
  await expect(page.getByText('Promoción creada.')).toBeVisible();
  await expect(
    page.locator('main').getByText('Activa', { exact: true }).first(),
  ).toBeVisible();

  await page.getByRole('checkbox', { name: 'Activa' }).uncheck();
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByText(`${name}: cambios guardados.`)).toBeVisible();

  const { data } = await admin
    .from('promotions')
    .select('kind, percent_bp, min_items_cents, brand_id, active')
    .eq('name', name)
    .single();
  expect(data).toEqual({
    kind: 'percent',
    percent_bp: 1500,
    min_items_cents: 6000,
    brand_id: brand.id,
    active: false,
  });

  await page.goto('/admin/descuentos');
  const row = page.getByRole('row', { name: new RegExp(name) });
  await expect(row).toContainText(/−15\s%\sdesde 60\s€/);
  await expect(row).toContainText(brand.name);
  await expect(row).toContainText('Apagada');
});
