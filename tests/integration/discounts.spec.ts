import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { collectLayoutIssues } from '../support/layout-audit';
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
 * Códigos de descuento (DECISIONS §149–152) contra Supabase local y el banco
 * simulado: el equipo crea y cambia un código en el panel; el cliente lo
 * aplica en «Finalizar compra» (Intro no envía el pedido), el banco cobra el
 * total con descuento y la página del pedido lo enseña; y los rechazos:
 * código que no existe, compra mínima y un uso por email.
 */

const created: TestProduct[] = [];
test.afterEach(() => {
  for (const product of created.splice(0)) archiveProduct(product);
});

async function makeProduct(units: number) {
  const product = await sellableProduct(units);
  created.push(product);
  return product;
}

/** Código de campaña creado directamente en la base local. */
function makeCode(
  options: {
    percent?: number;
    minItemsCents?: number;
    oncePerEmail?: boolean;
  } = {},
) {
  const code = `E2E-${randomUUID().slice(0, 6).toUpperCase()}`;
  psql(
    `insert into public.discount_codes
       (code, kind, percent_bp, min_items_cents, once_per_email)
     values (:'code', 'percent', :'bp'::integer,
             nullif(:'min', '')::integer, :'once'::boolean);`,
    {
      code,
      bp: String((options.percent ?? 10) * 100),
      min: options.minItemsCents ? String(options.minItemsCents) : '',
      once: String(options.oncePerEmail ?? true),
    },
  );
  return code;
}

/** Del perfume a «Finalizar compra» con recogida y las condiciones aceptadas. */
async function toCheckout(page: Page, product: TestProduct, email: string) {
  await page.goto(`/es/perfume/${product.slug}`);
  await page.getByRole('button', { name: 'Añadir a la cesta' }).click();
  await expect(page.getByText('Añadido a tu cesta.')).toBeVisible();
  await page.goto('/es/finalizar-compra');
  await page.getByLabel('Nombre y apellidos').fill('Cliente de descuentos');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByText('He leído y acepto las').click();
}

async function orderOf(email: string) {
  const { data, error } = await admin
    .from('order_contacts')
    .select(
      'orders!inner(id, number, status, discount_code, discount_cents, total_cents)',
    )
    .eq('email', email);
  if (error) throw error;
  return data.map(
    (row) =>
      row.orders as unknown as {
        id: string;
        number: number;
        status: string;
        discount_code: string | null;
        discount_cents: number;
        total_cents: number;
      },
  );
}

test.describe('cliente', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('aplica un código con Intro, paga el total con descuento y lo ve en su pedido', async ({
    page,
  }) => {
    const visits = await fakeBank(page);
    const product = await makeProduct(3);
    const code = makeCode({ percent: 10 });
    const email = `descuento-${randomUUID().slice(0, 8)}@test.invalid`;
    await toCheckout(page, product, email);

    const field = page.getByLabel('Código de descuento');
    await field.fill(code.toLowerCase());
    await field.press('Enter');
    await expect(page.getByText(`Código ${code} aplicado`)).toBeVisible();
    // Intro aplica el código, no envía el pedido.
    expect(await orderOf(email)).toEqual([]);
    const summary = page.getByRole('complementary');
    await expect(summary.getByText(`Descuento (${code})`)).toBeVisible();
    await expect(summary.getByText(/−4,99\s€/)).toBeVisible();
    await expect(summary.getByText(/44,91\s€/)).toBeVisible();

    // El resumen con el código aplicado, sin desbordes ni fallos de axe.
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
    // El banco recibe el importe que calculó la base.
    expect(bank.DS_MERCHANT_AMOUNT).toBe('4491');
    const [placed] = await orderOf(email);
    expect(placed).toMatchObject({
      status: 'pending_payment',
      discount_code: code,
      discount_cents: 499,
      total_cents: 4491,
    });

    const body = notificationBody({
      order: bank.DS_MERCHANT_ORDER!,
      amount: '4491',
    });
    expect((await notify(page.request, body)).status()).toBe(200);
    await page.goto(bank.DS_MERCHANT_URLOK!);
    await expect(
      page.getByRole('heading', { name: 'Pago confirmado' }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(`Descuento (${code})`)).toBeVisible();
    expect((await orderOf(email))[0]!.status).toBe('paid');
  });

  test('rechazos: código que no existe, compra mínima y un uso por email', async ({
    page,
  }) => {
    const visits = await fakeBank(page);
    const product = await makeProduct(5);
    const minimum = makeCode({ minItemsCents: 10000 });
    const once = makeCode({ oncePerEmail: true });
    const email = `una-vez-${randomUUID().slice(0, 8)}@test.invalid`;
    await toCheckout(page, product, email);
    const field = page.getByLabel('Código de descuento');
    const apply = page.getByRole('button', { name: 'Aplicar' });

    await field.fill('NO-EXISTE');
    await apply.click();
    await expect(
      page.getByText('Este código no existe o ya no está activo.'),
    ).toBeVisible();
    await expect(field).toHaveAttribute('aria-invalid', 'true');

    await field.fill(minimum);
    await apply.click();
    await expect(
      page.getByText(
        /Este código es para compras de 100\s€ o más en artículos\./,
      ),
    ).toBeVisible();

    // Primer pedido con el código: queda pendiente de pago (cuenta como uso).
    await field.fill(once);
    await apply.click();
    await expect(page.getByText(`Código ${once} aplicado`)).toBeVisible();
    await page
      .getByRole('button', { name: 'Confirmar pedido y pagar' })
      .click();
    expect((await nextVisit(page, visits, 1)).DS_MERCHANT_AMOUNT).toBe('4491');

    // Segundo pedido, mismo email: «Aplicar» no conoce el email; el pedido sí.
    await toCheckout(page, product, email);
    await page.getByLabel('Código de descuento').fill(once);
    await page.getByRole('button', { name: 'Aplicar' }).click();
    await expect(page.getByText(`Código ${once} aplicado`)).toBeVisible();
    await page
      .getByRole('button', { name: 'Confirmar pedido y pagar' })
      .click();
    await expect(
      page.getByText('Ya has usado este código con este email.'),
    ).toBeVisible();
    await expect(
      page.getByText(
        'El código de descuento ya no vale para este pedido. Revísalo en el resumen.',
      ),
    ).toBeVisible();
    // El código sale del resumen (queda escrito en el campo) y no hay pedido.
    await expect(page.getByLabel('Código de descuento')).toHaveValue(once);
    expect(await orderOf(email)).toHaveLength(1);
  });
});

test('el equipo crea un código y cambia sus condiciones en el panel', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await login(page, await user('store_admin'));
  await page.goto('/admin/descuentos');
  await page.getByRole('link', { name: 'Nuevo código' }).click();
  await expect(page).toHaveURL(/\/admin\/descuentos\/nuevo$/);

  const code = `PANEL-${randomUUID().slice(0, 6).toUpperCase()}`;
  await page.getByLabel('Código', { exact: true }).fill(code.toLowerCase());
  await page
    .getByLabel('Nota interna (opcional)')
    .fill('Campaña de prueba de Sender');
  await page.getByText('Importe fijo (€, con IVA)').click();
  await page.getByLabel('Importe (€)').fill('5');
  await page.getByLabel('Compra mínima (€, opcional)').fill('40');
  await page.getByRole('button', { name: 'Crear código' }).click();

  await expect(page).toHaveURL(/\/admin\/descuentos\/[0-9a-f-]+\?creado=1$/);
  await expect(page.getByRole('heading', { name: code })).toBeVisible();
  await expect(page.getByText('Código creado.')).toBeVisible();
  await expect(page.getByLabel('Código', { exact: true })).toHaveAttribute(
    'readonly',
    '',
  );

  await page.getByLabel('Usos máximos (opcional)').fill('50');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByText(`${code}: cambios guardados.`)).toBeVisible();

  const { data } = await admin
    .from('discount_codes')
    .select('kind, amount_cents, min_items_cents, max_uses, once_per_email')
    .eq('code', code)
    .single();
  expect(data).toEqual({
    kind: 'amount',
    amount_cents: 500,
    min_items_cents: 4000,
    max_uses: 50,
    once_per_email: true,
  });

  await page.goto('/admin/descuentos');
  const row = page.getByRole('row', { name: new RegExp(code) });
  await expect(row).toContainText('5 €');
  await expect(row).toContainText('mín. 40 €');
  await expect(row).toContainText('0 / 50');
  await expect(row).toContainText('Activo');
});
