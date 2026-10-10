import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { login, user } from './support';

/*
 * Control del negocio y del proyecto (/admin/control) y precio cobrado en el
 * mostrador, contra Supabase local.
 */

function psql(sql: string) {
  execFileSync(
    'docker',
    [
      'exec',
      '-i',
      'supabase_db_adhara-admin-delivery',
      'psql',
      '-X',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
    ],
    { input: sql, stdio: ['pipe', 'ignore', 'inherit'] },
  );
}

/** Perfume con PVP de 50 €, coste de 20 € y 5 unidades en la tienda. */
function stockedProduct(email: string) {
  const id = randomUUID().slice(0, 8);
  const name = `Perfume control ${id}`;
  psql(`begin;
    with b as (
      insert into public.brands (slug, name)
      values ('marca-control-${id}', 'Marca control ${id}') returning id
    ), p as (
      insert into public.products (brand_id, slug, name)
      select b.id, 'perfume-control-${id}', '${name}' from b returning id
    )
    insert into public.product_variants (product_id, size_ml, retail_price_cents)
    select p.id, 100, 5000 from p;
    select set_config('request.jwt.claims', json_build_object(
      'sub', (select id from auth.users where email = '${email}'),
      'aal', 'aal2', 'role', 'authenticated')::text, true);
    select public.admin_record_variant_cost(v.id, 2000),
           public.admin_record_inventory_movement(v.id,
             (select id from public.stock_locations where code = 'castelldefels'),
             'PURCHASE_RECEIPT', 5)
    from public.product_variants v
    join public.products p on p.id = v.product_id
    where p.name = '${name}';
    commit;`);
  return name;
}

test('control: venta con descuento, costes, tareas y entregas', async ({
  page,
}) => {
  const email = await user('system_admin');
  await login(page, email);
  const name = stockedProduct(email);
  const id = name.split(' ').at(-1)!;

  // Mostrador: el precio por defecto es el PVP y se puede rebajar.
  await page.goto('/admin/mostrador');
  await page.getByLabel('Añadir perfume').fill(name);
  await page.getByRole('button', { name: new RegExp(name) }).click();
  const ticket = page.getByRole('region', { name: 'Ticket' });
  await expect(ticket).toContainText('50 €');
  await ticket.getByLabel('Precio/ud.').fill('60');
  await expect(ticket.getByRole('alert')).toContainText(
    'no puede superar el PVP',
  );
  await ticket.getByLabel('Precio/ud.').fill('45');
  await ticket.getByRole('button', { name: 'Descontar 1 unidad' }).click();
  await expect(ticket.getByRole('status')).toContainText('Venta registrada');
  await expect(
    page.getByRole('listitem').filter({ hasText: name }).first(),
  ).toBeVisible();

  // Ventas y beneficio: la venta cuenta con el precio cobrado.
  await page.goto('/admin/control/negocio');
  await expect(
    page.getByRole('heading', { name: 'Ventas y beneficio' }),
  ).toBeVisible();
  await expect(
    page.getByRole('listitem').filter({ hasText: name }),
  ).toContainText('1 uds · 45,00 € con IVA');

  // Costes
  await page.goto('/admin/control/costes/nuevo');
  await page.getByLabel('Concepto').fill(`Alquiler ${id}`);
  await page.getByLabel('Categoría').selectOption('rent');
  await page.getByLabel('Importe sin IVA (€)').fill('800');
  await page.getByRole('button', { name: 'Añadir coste' }).click();
  await expect(page).toHaveURL(/\/admin\/control\/costes$/);
  const costRow = page.getByRole('row').filter({ hasText: `Alquiler ${id}` });
  await expect(costRow).toContainText('800,00 €');
  await expect(costRow).toContainText('Vigente');

  // Tareas: una vencida del cliente, que se marca como hecha.
  await page.goto('/admin/control/tareas/nueva');
  await page.getByLabel('Tarea', { exact: true }).fill(`Datos del TPV ${id}`);
  await page.getByLabel('Responsable').selectOption('client');
  await page.getByLabel('Fecha límite').fill('2026-01-15');
  await page.getByRole('button', { name: 'Crear tarea' }).click();
  await expect(page).toHaveURL(/\/admin\/control\/tareas$/);
  const taskItem = page
    .getByRole('listitem')
    .filter({ hasText: `Datos del TPV ${id}` });
  await expect(taskItem).toContainText('Vencida');
  await expect(taskItem).toContainText('Cliente');
  await taskItem.getByRole('button', { name: /^Hecha/ }).click();
  await expect(taskItem).toHaveCount(0);
  await page.goto('/admin/control/tareas?ver=hechas');
  await expect(
    page.getByRole('listitem').filter({ hasText: `Datos del TPV ${id}` }),
  ).toBeVisible();

  // Entregas
  await page.goto('/admin/control/entregas/nueva');
  await page.getByLabel('Entrega', { exact: true }).fill(`Checkout ${id}`);
  await page.getByLabel('Estado').selectOption('delivered');
  await page.getByLabel('Importe sin IVA (€)').fill('1200');
  await page.getByLabel('Facturación').selectOption('pending');
  await page.getByRole('button', { name: 'Crear entrega' }).click();
  await expect(page).toHaveURL(/\/admin\/control\/entregas$/);
  const deliveryRow = page
    .getByRole('row')
    .filter({ hasText: `Checkout ${id}` });
  await expect(deliveryRow).toContainText('1200,00 €');
  await expect(deliveryRow).toContainText('Por facturar');

  // Resumen y borrado con confirmación.
  await page.goto('/admin/control');
  await expect(page.getByRole('heading', { name: 'Resumen' })).toBeVisible();
  await page.goto('/admin/control/costes');
  await costRow.getByRole('link', { name: `Alquiler ${id}` }).click();
  await page.getByRole('button', { name: 'Borrar' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Borrar' })
    .click();
  await expect(page).toHaveURL(/\/admin\/control\/costes$/);
  await expect(
    page.getByRole('row').filter({ hasText: `Alquiler ${id}` }),
  ).toHaveCount(0);
});

test('control: el administrador de la tienda no lo ve', async ({ page }) => {
  await login(page, await user('store_admin'));
  await expect(
    page.getByRole('link', { name: 'Control del negocio' }),
  ).toHaveCount(0);
  for (const path of ['/admin/control', '/admin/control/costes']) {
    await page.goto(path);
    await expect(
      page.getByRole('heading', { name: '404', exact: true }),
    ).toBeVisible();
  }
});
