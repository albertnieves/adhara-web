import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { TestProduct } from './support';
import { archiveProduct, login, psql, sellableProduct, user } from './support';

/*
 * Lotes de códigos únicos (DECISIONS §185): el equipo crea un código para
 * cada suscriptor del Club, descarga el CSV para Sender, un código del lote
 * vale en «Finalizar compra» como cualquier otro y apagar el lote lo deja
 * sin valor. El encargado no ve nada.
 */

const id = randomUUID().slice(0, 6).toUpperCase().replace(/-/g, '');
const prefix = `T${id}`;
const people = [`lote-a-${id}@test.invalid`, `lote-b-${id}@test.invalid`].map(
  (email) => email.toLowerCase(),
);

const created: TestProduct[] = [];
test.afterEach(() => {
  for (const product of created.splice(0)) archiveProduct(product);
});

test.beforeAll(() => {
  psql(
    `insert into public.newsletter_subscribers (email, locale, consent_version)
     values (:'a', 'es', 'prueba-lotes'), (:'b', 'ca', 'prueba-lotes');`,
    { a: people[0]!, b: people[1]! },
  );
});

test('el equipo crea un lote para el Club, lo descarga, se usa en la tienda y se apaga', async ({
  page,
}) => {
  await login(page, await user('store_admin'));
  await page.goto('/admin/descuentos');
  await page
    .getByRole('link', { name: 'Nuevo lote de códigos únicos' })
    .click();
  await page.getByLabel('Campaña').fill(`Prueba de lotes ${id}`);
  await page.getByLabel('Prefijo').fill(prefix.toLowerCase());
  await expect(
    page.getByLabel(/Uno para cada suscriptor activo del Club/),
  ).toBeChecked();
  await page.getByLabel('Porcentaje (%)').fill('15');
  await page.getByRole('button', { name: 'Crear el lote' }).click();
  await expect(page).toHaveURL(
    /\/admin\/descuentos\/lotes\/[0-9a-f-]{36}\?creado=1$/,
  );
  await expect(
    page.getByRole('heading', { level: 1, name: `Prueba de lotes ${id}` }),
  ).toBeVisible();
  await expect(page.getByText(/^Lote creado: \d+ códigos?\.$/)).toBeVisible();
  const batchUrl = page.url().replace(/\?.*$/, '');

  // CSV para Sender: email y código de cada suscriptor.
  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Descargar CSV' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(
    new RegExp(`^codigos-${prefix.toLowerCase()}-\\d{4}-\\d{2}-\\d{2}\\.csv$`),
  );
  const rows = (await readFile((await file.path())!, 'utf8'))
    .replace(/^﻿/, '')
    .trim()
    .split(/\r\n/)
    .map((line) => line.split(';'));
  expect(rows[0]).toEqual(['email', 'codigo', 'usado', 'activo']);
  const codes = new Map(rows.slice(1).map(([email, code]) => [email, code]));
  for (const email of people)
    expect(codes.get(email)).toMatch(
      new RegExp(`^${prefix}-[A-HJ-NP-Z2-9]{8}$`),
    );
  const mine = codes.get(people[0]!)!;

  // En la tienda, el código del lote se aplica como cualquier otro.
  const product = await sellableProduct(2);
  created.push(product);
  const shop = await page.context().newPage();
  await shop.goto(`/es/perfume/${product.slug}`);
  await shop.getByRole('button', { name: 'Añadir a la cesta' }).click();
  await expect(shop.getByText('Añadido a tu cesta.')).toBeVisible();
  await shop.goto('/es/finalizar-compra');
  const field = shop.getByLabel('Código de descuento');
  await field.fill(mine.toLowerCase());
  await field.press('Enter');
  await expect(shop.getByText(`Código ${mine} aplicado`)).toBeVisible();
  await expect(
    shop.getByRole('complementary').getByText(`Descuento (${mine})`),
  ).toBeVisible();

  // La lista agrupa el lote y no enseña sus códigos uno a uno.
  await page.goto('/admin/descuentos');
  await expect(
    page.getByRole('link', { name: `Prueba de lotes ${id}` }),
  ).toBeVisible();
  await expect(page.getByText(mine)).toHaveCount(0);

  // Apagado, ningún código del lote vale.
  await page.goto(batchUrl);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Apagar el lote' }).click();
  await expect(
    page.getByText(/^Lote apagado: \d+ códigos? deja/),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByText('Apagado', { exact: true })).toBeVisible();
  const other = codes.get(people[1]!)!;
  await shop.getByRole('button', { name: 'Quitar', exact: true }).click();
  await field.fill(other);
  await shop.getByRole('button', { name: 'Aplicar' }).click();
  await expect(
    shop.getByText('Este código no existe o ya no está activo.'),
  ).toBeVisible();
  await expect(shop.getByText(`Código ${other} aplicado`)).toHaveCount(0);
  await expect(
    shop.getByRole('complementary').getByText(`Descuento (${other})`),
  ).toHaveCount(0);

  await page.getByRole('button', { name: 'Encender el lote' }).click();
  await expect(
    page.getByText(/^Lote encendido: \d+ códigos? vuelve/),
  ).toBeVisible();
});

test('el encargado no ve lotes ni los descarga', async ({ page }) => {
  await login(page, await user('viewer'));
  await page.goto('/admin/descuentos/lotes/nuevo');
  await expect(
    page.getByRole('heading', { name: '404', exact: true }),
  ).toBeVisible();
  const csv = await page.request.get(
    `/admin/descuentos/lotes/${randomUUID()}/exportar`,
  );
  expect(csv.status()).toBe(404);
});
