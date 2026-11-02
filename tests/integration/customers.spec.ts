import { expect, test } from '@playwright/test';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { admin, login, psql, user } from './support';

/*
 * Ficha de cliente (A7, DECISIONS §184): el administrador de la tienda busca
 * a un cliente, ve sus pedidos, mensajes y el Club, y descarga sus datos (que
 * queda en la auditoría sin el email); el encargado no ve nada de clientes.
 * La URL nunca lleva el email.
 */

const id = randomUUID().slice(0, 8);
const email = `cliente-ficha-${id}@test.invalid`;
const name = `Clienta Ficha ${id}`;
const key = createHash('sha256').update(email).digest('hex');

test.beforeAll(() => {
  psql(
    `begin;
     with o as (
       insert into public.orders (request_id, locale, status, fulfillment, location_id,
         items_cents, total_cents, reservation, reserved_until, created_at)
       select gen_random_uuid(), 'ca', 'cancelled', 'click_collect', l.id, 4990, 4990,
         'released', now(), now() - interval '2 days'
       from public.stock_locations l where l.code = 'castelldefels'
       returning id
     )
     insert into public.order_contacts (order_id, full_name, email, phone)
     select o.id, :'name', upper(:'email'), '600 000 777' from o;
     with c as (
       insert into public.conversations (channel, status, subject, locale)
       values ('web_form', 'open', 'Consulta de la ficha ' || :'id', 'ca')
       returning id
     ), cc as (
       insert into public.conversation_contacts (conversation_id, full_name, email)
       select c.id, :'name', :'email' from c
     )
     insert into public.conversation_messages (conversation_id, kind, source, body)
     select c.id, 'customer', 'web_form', 'Missatge de la fitxa ' || :'id' from c;
     insert into public.newsletter_subscribers (email, locale, consent_version)
     values (:'email', 'ca', 'prueba-ficha');
     commit;`,
    { id, name, email },
  );
});

test('administrador de la tienda: busca, abre la ficha y descarga sus datos', async ({
  page,
}) => {
  await login(page, await user('store_admin'));
  // A 768 px el menú del panel es un panel lateral.
  await page.getByRole('button', { name: 'Menú' }).click();
  await page
    .getByRole('dialog', { name: 'Menú' })
    .getByRole('link', { name: 'Clientes', exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin\/clientes$/);
  await page.getByLabel('Buscar por nombre o email').fill(email);
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  // La búsqueda no va en la URL.
  await expect(
    page.getByText(`1 cliente encaja con «${email}».`),
  ).toBeVisible();
  expect(page.url()).not.toContain('@');
  const row = page.getByRole('row').filter({ hasText: email });
  await expect(row).toContainText('1 · 0 pagados');
  await expect(row).toContainText('1 abierta');
  await expect(row).toContainText('Suscrito');

  await row.getByRole('link', { name }).click();
  await expect(page).toHaveURL(`/admin/clientes/${key}`);
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  await expect(page.getByText('600 000 777')).toBeVisible();
  await expect(page.getByText(/con el texto «prueba-ficha»/)).toBeVisible();
  const conversation = page.getByRole('link', { name: /^Nº \d+$/ }).last();
  await expect(
    page.getByText(`Consulta de la ficha ${id}`, { exact: true }),
  ).toBeVisible();

  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Descargar sus datos' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(
    new RegExp(`^cliente-${key.slice(0, 12)}-\\d{4}-\\d{2}-\\d{2}\\.json$`),
  );
  const data = JSON.parse(await readFile((await file.path())!, 'utf8'));
  expect(data.email).toBe(email);
  expect(data.orders).toHaveLength(1);
  expect(data.orders[0].contact.full_name).toBe(name);
  expect(data.conversations[0].messages[0].body).toBe(
    `Missatge de la fitxa ${id}`,
  );
  expect(data.newsletter.consent_version).toBe('prueba-ficha');
  const audit = await admin
    .from('audit_log')
    .select('entity_id, after')
    .eq('action', 'customers.export')
    .eq('entity_id', key);
  expect(audit.error).toBeNull();
  expect(audit.data).toHaveLength(1);
  expect(JSON.stringify(audit.data)).not.toContain('@');

  // Desde la consulta se vuelve a la ficha.
  await conversation.click();
  await expect(page).toHaveURL(/\/admin\/mensajes\//);
  await page.getByRole('link', { name: 'Ficha del cliente' }).click();
  await expect(page).toHaveURL(`/admin/clientes/${key}`);
});

test('encargado: sin clientes ni descarga', async ({ page }) => {
  const exports = async () =>
    (
      await admin
        .from('audit_log')
        .select('id', { count: 'exact', head: true })
        .eq('action', 'customers.export')
        .eq('entity_id', key)
    ).count;
  const before = await exports();
  await login(page, await user('viewer'));
  await page.getByRole('button', { name: 'Menú' }).click();
  const menu = page.getByRole('dialog', { name: 'Menú' });
  await expect(menu.getByRole('link', { name: 'Mensajes' })).toBeVisible();
  await expect(
    menu.getByRole('link', { name: 'Clientes', exact: true }),
  ).toHaveCount(0);
  // Las páginas del panel pintan el 404 (con el estado ya enviado).
  for (const path of ['/admin/clientes', `/admin/clientes/${key}`]) {
    await page.goto(path);
    await expect(
      page.getByRole('heading', { name: '404', exact: true }),
    ).toBeVisible();
    await expect(page.getByText(email)).toHaveCount(0);
  }
  const download = await page.request.get(`/admin/clientes/${key}/exportar`);
  expect(download.status()).toBe(404);
  expect(await exports()).toBe(before);
});
