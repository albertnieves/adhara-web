import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { admin, password, totp, user, login } from './support';

test('administrador: MFA, guardar, vista previa, publicar y dirección', async ({
  page,
  browser,
}) => {
  await login(page, await user('system_admin'));
  await page.getByRole('link', { name: 'Editar portada', exact: true }).click();
  const original = await page
    .getByLabel('Título de portada', { exact: true })
    .inputValue();
  const title = `Portada local ${randomUUID()}`;
  await page.getByLabel('Título de portada', { exact: true }).fill(title);
  await expect(
    page.getByRole('button', { name: 'Publicar revisión guardada' }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(
    page.getByRole('button', { name: 'Publicar revisión guardada' }),
  ).toBeEnabled();
  const visitor = await browser.newContext();
  const publicPage = await visitor.newPage();
  await publicPage.goto('/es');
  expect(await publicPage.content()).not.toContain(title);
  await expect(publicPage.getByRole('heading', { level: 1 })).not.toHaveText(
    title,
  );
  await page.getByRole('button', { name: 'Vista previa del borrador' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
  await page.goto('/admin/contenido');
  await page
    .getByRole('button', { name: 'Publicar revisión guardada' })
    .click();
  await expect(
    page.getByRole('button', { name: 'Publicar revisión guardada' }),
  ).toBeDisabled();
  await publicPage.reload();
  await expect(publicPage.getByRole('heading', { level: 1 })).toHaveText(title);
  await publicPage.goto('/ca');
  await expect(publicPage.getByRole('heading', { level: 1 })).not.toHaveText(
    title,
  );
  await page.getByLabel('Título de portada', { exact: true }).fill(original);
  await page.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(
    page.getByRole('button', { name: 'Publicar revisión guardada' }),
  ).toBeEnabled();
  await page
    .getByRole('button', { name: 'Publicar revisión guardada' })
    .click();
  await expect(
    page.getByRole('button', { name: 'Publicar revisión guardada' }),
  ).toBeDisabled();
  await page.goto('/admin/configuracion');
  await expect(page.getByLabel('Dirección', { exact: true })).toHaveValue(
    'Carrer de Pompeu Fabra 1',
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole('heading', { name: 'Datos de la tienda' }),
  ).toBeVisible();
  await page.screenshot({
    path: 'test-results/editor-tablet.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await visitor.close();
});

test('administrador de tienda edita portada pero no configuración ni equipo', async ({
  page,
}) => {
  await login(page, await user('store_admin'));
  await page.goto('/admin/contenido');
  await expect(
    page.getByLabel('Título de portada', { exact: true }),
  ).toBeVisible();
  for (const route of ['/admin/configuracion', '/admin/equipo']) {
    await page.goto(route);
    await expect(
      page.getByRole('heading', { name: '404', exact: true }),
    ).toBeVisible();
    await expect(page.locator('input[name=address]')).toHaveCount(0);
  }
});

test('viewer no accede al editor y recuperación no enumera usuarios', async ({
  page,
}) => {
  await login(page, await user('viewer'));
  await page.goto('/admin/contenido');
  await expect(
    page.getByRole('heading', { name: '404', exact: true }),
  ).toBeVisible();
  await expect(page.locator('input[name=heroTitle]')).toHaveCount(0);
  await page.goto('/admin/recuperar');
  await page
    .getByLabel('Email', { exact: true })
    .fill(`missing-${randomUUID()}@test.invalid`);
  await page.getByRole('button', { name: /enviar/i }).click();
  await expect(page).toHaveURL(/enviado=1/);
  await page.goto('/auth/confirm?type=recovery&token_hash=invalid-token-local');
  await expect(page).toHaveURL(/error=enlace/);
});

test('una sesión sin ficha de personal recibe 404 en el panel', async ({
  page,
}) => {
  const email = `sin-personal-${randomUUID()}@test.invalid`;
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  await page.goto('/admin/acceso');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  for (const path of ['/admin', '/admin/mfa', '/admin/catalogo']) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
  }
  await expect(page.getByRole('navigation')).toHaveCount(0);
});

async function mailLink(email: string) {
  let id: string | undefined;
  await expect
    .poll(async () => {
      const result = await fetch('http://127.0.0.1:54324/api/v1/messages').then(
        (r) => r.json(),
      );
      id = result.messages.find((m: { To: { Address: string }[] }) =>
        m.To.some((to) => to.Address === email),
      )?.ID;
      return Boolean(id);
    })
    .toBe(true);
  const message = await fetch(
    `http://127.0.0.1:54324/api/v1/message/${id}`,
  ).then((r) => r.json());
  const link = String(message.HTML)
    .match(/http:\/\/localhost:3000\/auth\/confirm[^"\s<>]+/)?.[0]
    ?.replaceAll('&amp;', '&');
  if (!link)
    throw new Error(
      'El correo local no contiene el enlace de confirmación esperado',
    );
  return link;
}

test('invitación local asigna rol, acepta una sola vez y permite fijar contraseña', async ({
  page,
  browser,
}) => {
  await login(page, await user('system_admin'));
  await page.goto('/admin/equipo');
  const email = `invited-${randomUUID()}@test.invalid`;
  const form = page
    .locator('form')
    .filter({ has: page.getByRole('button', { name: 'Enviar invitación' }) });
  await form.getByLabel('Email de la cuenta').fill(email);
  await form.getByLabel('Nombre visible').fill('Invitado local');
  await form
    .getByRole('combobox', { name: 'Rol', exact: true })
    .selectOption('viewer');
  await form.getByRole('button', { name: 'Enviar invitación' }).click();
  await expect(
    page.getByText('Invitación enviada.', { exact: false }),
  ).toBeVisible();
  const link = await mailLink(email);
  const context = await browser.newContext();
  const guest = await context.newPage();
  await guest.goto(link);
  await expect(
    guest.getByRole('heading', { name: 'Elige tu contraseña' }),
  ).toBeVisible();
  await guest.getByLabel('Nueva contraseña', { exact: false }).fill(password);
  await guest.getByLabel('Repite la contraseña').fill(password);
  await guest.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(guest).toHaveURL(/\/admin\/mfa/);
  await guest.goto(link);
  await expect(guest).toHaveURL(/error=enlace/);
  const users = await admin.auth.admin.listUsers();
  const invited = users.data.users.find((u) => u.email === email);
  const member = await admin
    .from('staff_members')
    .select('role')
    .eq('user_id', invited!.id)
    .single();
  expect(member.data?.role).toBe('viewer');
  await context.close();
});

test('recuperación local exige el segundo factor existente y rechaza enlace reutilizado', async ({
  page,
  browser,
}) => {
  const email = await user('system_admin');
  const secret = await login(page, email);
  const firstStep = Math.floor(Date.now() / 30000);
  const context = await browser.newContext();
  const recovered = await context.newPage();
  await recovered.goto('/admin/recuperar');
  await recovered.getByLabel('Email', { exact: true }).fill(email);
  await recovered.getByRole('button', { name: 'Enviar enlace' }).click();
  await expect(recovered).toHaveURL(/enviado=1/);
  const link = await mailLink(email);
  await recovered.goto(link);
  await expect(recovered).toHaveURL(/\/admin\/mfa\?next=contrasena/);
  if (Math.floor(Date.now() / 30000) === firstStep)
    await new Promise((resolve) =>
      setTimeout(resolve, 30000 - (Date.now() % 30000) + 1000),
    );
  const wrongCode = ((Number(totp(secret)) + 1) % 1000000)
    .toString()
    .padStart(6, '0');
  await recovered
    .getByLabel('Código de tu app de autenticación')
    .fill(wrongCode);
  await recovered
    .getByRole('button', { name: 'Verificar', exact: true })
    .click();
  await expect(recovered).toHaveURL(/error=codigo&next=contrasena/);
  await recovered
    .getByLabel('Código de tu app de autenticación')
    .fill(totp(secret));
  await recovered
    .getByRole('button', { name: 'Verificar', exact: true })
    .click();
  await expect(
    recovered.getByRole('heading', { name: 'Elige tu contraseña' }),
  ).toBeVisible();
  const nextPassword = `Changed-${randomUUID()}`;
  await recovered
    .getByLabel('Nueva contraseña', { exact: false })
    .fill(nextPassword);
  await recovered.getByLabel('Repite la contraseña').fill(nextPassword);
  await recovered.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(recovered).toHaveURL(/\/admin$/);
  await recovered.goto(link);
  await expect(recovered).toHaveURL(/error=enlace/);
  await context.close();
});

/**
 * Perfume en borrador con un formato sin PVP. Se crea con psql en el
 * contenedor local (como la prueba de concurrencia): la clave de servicio no
 * tiene acceso al esquema private que usan los disparadores del catálogo.
 */
function draftProduct(label: string) {
  const id = randomUUID().slice(0, 8);
  const name = `${label} ${id}`;
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
    {
      input: `with b as (
          insert into public.brands (slug, name)
          values ('marca-${id}', 'Marca ${id}') returning id
        ), p as (
          insert into public.products (brand_id, slug, name)
          select b.id, 'perfume-${id}', '${name}' from b returning id
        )
        insert into public.product_variants (product_id, size_ml)
        select p.id, 100 from p;`,
      stdio: ['pipe', 'ignore', 'inherit'],
    },
  );
  return name;
}

test('panel: la barra lateral no invade el contenido y el menú móvil navega', async ({
  page,
}) => {
  await login(page, await user('store_admin'));
  await page.setViewportSize({ width: 1280, height: 640 });
  await page.goto('/admin/inventario');
  const aside = await page.locator('aside').boundingBox();
  const nav = await page
    .locator('aside nav[aria-label="Secciones del panel"]')
    .boundingBox();
  expect(nav!.x + nav!.width).toBeLessThanOrEqual(aside!.x + aside!.width);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Menú' }).click();
  const menu = page.getByRole('dialog', { name: 'Menú' });
  await expect(menu).toBeVisible();
  await menu.getByRole('link', { name: 'Movimientos', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/movimientos$/);
  await expect(menu).toBeHidden();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test('inventario: el movimiento se registra en un panel lateral y deja aviso', async ({
  page,
}) => {
  const name = draftProduct('Perfume panel');
  await login(page, await user('store_admin'));
  await page.goto(`/admin/inventario?q=${encodeURIComponent(name)}`);
  const row = page.getByRole('row').filter({ hasText: name });
  await row.getByRole('button', { name: 'Movimiento' }).click();
  const sheet = page.getByRole('dialog', { name: 'Registrar movimiento' });
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText(name);
  await sheet.getByLabel('Unidades').fill('3');
  await sheet.getByRole('button', { name: 'Registrar', exact: true }).click();
  await expect(sheet).toBeHidden();
  await expect(
    page.getByRole('status').filter({ hasText: name }),
  ).toBeVisible();
  await expect(row.getByRole('cell').nth(2)).toHaveText('3');
  await page.setViewportSize({ width: 390, height: 844 });
  await row.getByRole('button', { name: 'Recuento' }).click();
  await expect(page.getByRole('dialog', { name: 'Recuento' })).toBeInViewport();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Recuento' })).toBeHidden();
});

test('asistente: informe del día según el rol y chat desactivado sin clave', async ({
  page,
  browser,
}) => {
  draftProduct('Perfume sin precio');
  await login(page, await user('viewer'));
  await page.goto('/admin/asistente');
  await expect(
    page.getByRole('heading', { name: 'Informe del día', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('El asistente aún no está activado.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /^Guardar/ })).toHaveCount(0);
  await expect(page.locator('main a[href^="/admin/catalogo"]')).toHaveCount(0);

  const context = await browser.newContext();
  const shop = await context.newPage();
  await login(shop, await user('store_admin'));
  await shop.goto('/admin/asistente');
  await expect(
    shop.getByRole('link', { name: /Perfumes sin PVP completo/ }),
  ).toBeVisible();
  await shop.getByRole('button', { name: 'Guardar informe' }).click();
  await expect(
    shop.getByText('el informe se guarda sin resumen del asistente'),
  ).toBeVisible();
  await expect(shop.getByText(/^Guardado el/)).toBeVisible();
  await shop.goto('/admin');
  await expect(
    shop.getByRole('link', { name: 'Abrir el asistente' }),
  ).toBeVisible();
  await context.close();
});
