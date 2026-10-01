import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { createHmac, randomUUID } from 'node:crypto';

if (
  process.env.ADHARA_LOCAL_TEST !== '1' ||
  !/^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  )
)
  throw new Error('Pruebas únicamente locales');
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { persistSession: false } },
);
const password = `Test-${randomUUID()}`;
function totp(secret: string) {
  const bits = [...secret.replace(/=+$/, '')]
    .map((c) =>
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
        .indexOf(c)
        .toString(2)
        .padStart(5, '0'),
    )
    .join('');
  const key = Buffer.from(
    (bits.match(/.{8}/g) ?? []).map((b) => parseInt(b, 2)),
  );
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const hash = createHmac('sha1', key).update(counter).digest();
  const offset = hash[19]! & 15;
  return ((hash.readUInt32BE(offset) & 0x7fffffff) % 1000000)
    .toString()
    .padStart(6, '0');
}
async function user(role: string) {
  const email = `${role}-${randomUUID()}@test.invalid`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error('No se pudo preparar usuario local');
  const staff = await admin
    .from('staff_members')
    .insert({ user_id: data.user.id, role, display_name: 'Prueba local' });
  if (staff.error) throw staff.error;
  return email;
}
async function login(page: Page, email: string) {
  await page.goto('/admin/acceso');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/mfa/);
  await page
    .getByRole('button', { name: 'Configurar la app de autenticación' })
    .click();
  const secret = await page.locator('code').innerText();
  // No guardar trazas/QR/secretos MFA de las sesiones, ni siquiera locales.
  await page.getByLabel('Código', { exact: true }).fill(totp(secret));
  await page.getByRole('button', { name: 'Verificar y activar' }).click();
  await expect(page).toHaveURL(/\/admin$/);
  return secret;
}

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
