import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { login, makeControlOwner, psql, user } from './support';

/*
 * Consola del titular (/admin/control) y precio cobrado en el mostrador,
 * contra Supabase local. La consola es solo para escritorio: las pruebas van
 * a 1440 px (el aviso de pantallas pequeñas lo audita layout-audit.spec.ts).
 */

test.use({ viewport: { width: 1440, height: 900 } });

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
  // El administrador del sistema de la prueba es, además, el titular.
  makeControlOwner(email);
  await login(page, email);
  await expect(
    page.getByRole('link', { name: 'Control del negocio' }),
  ).toBeVisible();
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

  // Resumen en la consola: menú propio con la sección activa marcada.
  await page.goto('/admin/control');
  await expect(page.getByRole('heading', { name: 'Resumen' })).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Secciones de la consola' });
  await expect(nav.getByRole('link', { name: 'Resumen' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByRole('button', { name: 'Menú' })).toHaveCount(0);
  await expect(
    page.getByText('La consola se usa en ordenador', { exact: false }),
  ).toBeHidden();

  // Borrado con confirmación.
  await page.goto('/admin/control/costes');
  await expect(
    nav.getByRole('link', { name: 'Costes', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
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

test('consola: productos, atención, copias, estado, calidad y asistente', async ({
  page,
}) => {
  const email = await user('system_admin');
  makeControlOwner(email);
  await login(page, email);
  const name = stockedProduct(email);
  // Visitas anónimas de hoy (las de la tienda solo cuentan perfumes publicados).
  psql(
    `insert into internal.product_attention_daily (product_id, day, kind, hits)
     select id, (now() at time zone 'Europe/Madrid')::date, 'view', 25
     from public.products where name = :'name';`,
    { name },
  );
  const nav = page.getByRole('navigation', { name: 'Secciones de la consola' });

  // Productos: el perfume aparece con sus existencias y abre su ficha.
  await page.goto(`/admin/control/productos?q=${encodeURIComponent(name)}`);
  await expect(
    page.getByRole('heading', { name: 'Productos', exact: true }),
  ).toBeVisible();
  const productRow = page.getByRole('row').filter({ hasText: name });
  await expect(productRow).toHaveCount(1);
  await productRow.getByRole('link', { name: new RegExp(name) }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Productos' })).toHaveAttribute(
    'aria-current',
    'page',
  );

  // Atención: el perfume con sus 25 visitas de hoy.
  await page.goto('/admin/control/atencion?periodo=7');
  await expect(
    page.getByRole('heading', { name: 'Atención', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: name })).toContainText(
    '25',
  );
  await expect(
    page.getByRole('heading', { name: 'Carritos abandonados', exact: true }),
  ).toBeVisible();

  // Copias: descarga al momento (gzip) y queda en el registro.
  await page.goto('/admin/control/copias');
  await expect(
    page.getByRole('heading', { name: 'Copias de seguridad', exact: true }),
  ).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar copia ahora' }).click();
  expect((await download).suggestedFilename()).toMatch(
    /^latelier-copia-\d{4}-\d{2}-\d{2}-\d{4}\.json\.gz$/,
  );
  await page.reload();
  await expect(
    page.getByRole('row').filter({ hasText: 'Descarga' }).first(),
  ).toContainText('Correcta');

  // Estado: migraciones al día en la base local.
  await page.goto('/admin/control/sistema');
  await expect(
    page.getByRole('heading', { name: 'Estado del sistema', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Al día', { exact: true })).toBeVisible();

  await page.goto('/admin/control/calidad');
  await expect(
    page.getByRole('heading', { name: 'Calidad de datos', exact: true }),
  ).toBeVisible();

  await page.goto('/admin/control/asistente?periodo=7');
  await expect(
    page.getByRole('heading', {
      name: 'Uso y coste del asistente',
      exact: true,
    }),
  ).toBeVisible();
});

/** Sin el acceso en el menú del panel ni la consola: 404 en sus rutas. */
async function expectNoControl(page: Page) {
  // A 1440 px la barra lateral del panel está a la vista (con su pie): que
  // falte el acceso significa algo.
  await expect(
    page.getByRole('link', { name: 'Sistema de diseño' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Control del negocio' }),
  ).toHaveCount(0);
  for (const path of [
    '/admin/control',
    '/admin/control/costes',
    '/admin/control/negocio',
  ]) {
    await page.goto(path);
    await expect(
      page.getByRole('heading', { name: '404', exact: true }),
    ).toBeVisible();
    await expect(page.locator('[data-shell="console"]')).toHaveCount(0);
  }
}

test('control: el administrador de la tienda no lo ve', async ({ page }) => {
  await login(page, await user('store_admin'));
  await expectNoControl(page);
});

test('control: otro administrador del sistema no titular recibe 404', async ({
  page,
}) => {
  // Tiene business.control y MFA, pero no está en la lista de titulares.
  await login(page, await user('system_admin'));
  await expectNoControl(page);
});
