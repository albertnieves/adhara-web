import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import {
  AUDIT_WIDTHS,
  auditRoute,
  axeBaseline,
  formatFindings,
} from '../support/layout-audit';
import { fakeBank, nextVisit } from './bank';
import type { TestProduct } from './support';
import {
  admin,
  archiveProduct,
  password,
  psql,
  sellableProduct,
  user,
} from './support';

/*
 * Cuenta de cliente (PLAN_CUENTA_CLIENTE) contra Supabase local, con
 * CUSTOMER_ACCOUNTS=1 y WEB_CHECKOUT=1 (e2e.yml): alta con confirmación del
 * email, acceso, recuperación, Google hasta la puerta de Supabase, pedidos de
 * la cuenta, datos que rellenan el checkout, el personal en la tienda y
 * borrar la cuenta. Los correos se leen del Mailpit de Supabase local.
 */

const created: TestProduct[] = [];
test.afterEach(() => {
  for (const product of created.splice(0)) archiveProduct(product);
});

const customerEmail = () => `cliente-${randomUUID().slice(0, 8)}@test.invalid`;

/** Cliente con el email ya verificado (como tras confirmar el alta). */
async function confirmedCustomer(fullName = 'Cliente de prueba') {
  const email = customerEmail();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user) throw error ?? new Error('Sin usuario');
  return { email, id: data.user.id };
}

/** Enlace a /auth/confirm del último correo de Auth de ese tipo para `email`. */
async function authLink(email: string, type: 'email' | 'recovery') {
  let link: string | undefined;
  await expect
    .poll(
      async () => {
        const list = await fetch('http://127.0.0.1:54324/api/v1/messages').then(
          (r) => r.json(),
        );
        const ids: string[] = list.messages
          .filter((m: { To: { Address: string }[] }) =>
            m.To.some((to) => to.Address === email),
          )
          .map((m: { ID: string }) => m.ID);
        for (const id of ids) {
          const message = await fetch(
            `http://127.0.0.1:54324/api/v1/message/${id}`,
          ).then((r) => r.json());
          const found = String(message.HTML)
            .match(/http:\/\/localhost:3000\/auth\/confirm[^"\s<>]+/)?.[0]
            ?.replaceAll('&amp;', '&');
          if (found?.includes(`type=${type}`)) {
            link = found;
            return true;
          }
        }
        return false;
      },
      { timeout: 20_000 },
    )
    .toBe(true);
  return link!;
}

async function signIn(page: Page, email: string, secret = password) {
  await page.goto('/es/cuenta/acceso');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(secret);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
}

/** Pedido de recogida pendiente de pago hecho por el servidor (como el checkout). */
async function serverOrder(
  product: TestProduct,
  email: string,
  customerId?: string,
) {
  const { data, error } = await admin.rpc('web_order_create', {
    p_request_id: randomUUID(),
    p_locale: 'es',
    p_fulfillment: 'click_collect',
    p_location_id: null as unknown as string,
    p_items: [{ variant_id: product.variantId, quantity: 1 }],
    p_contact: { full_name: 'Cliente de prueba', email },
    p_provider: 'redsys',
    ...(customerId && { p_customer_id: customerId }),
  });
  if (error) throw error;
  return (data as { number: number }).number;
}

async function makeProduct(units = 5) {
  const product = await sellableProduct(units);
  created.push(product);
  return product;
}

test('alta con email: confirmar, entrar, salir y volver a entrar', async ({
  page,
}) => {
  const email = customerEmail();
  await page.goto('/es');
  await page.getByRole('link', { name: 'Cuenta', exact: true }).click();
  await expect(page).toHaveURL(/\/es\/cuenta\/acceso\?next=%2Fes%2Fcuenta$/);
  await page.getByRole('link', { name: 'Crear una cuenta' }).click();
  await expect(page).toHaveURL(/\/es\/cuenta\/registro/);

  await page.getByRole('button', { name: 'Crear la cuenta' }).click();
  await expect(page.getByText('Escribe tu nombre.')).toBeVisible();
  await page.getByLabel('Nombre y apellidos').fill('Ana Prueba');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill('corta');
  await page.getByRole('button', { name: 'Crear la cuenta' }).click();
  await expect(
    page.getByText('La contraseña debe tener al menos 12 caracteres.'),
  ).toBeVisible();
  // Lo escrito sigue ahí tras el error (React no vacía el formulario).
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Crear la cuenta' }).click();
  await expect(
    page.getByRole('heading', { name: 'Revisa tu correo' }),
  ).toBeVisible();

  // Sin confirmar el email no se entra.
  await signIn(page, email);
  await expect(
    page.getByText('Antes de entrar, confirma tu email'),
  ).toBeVisible();

  const link = await authLink(email, 'email');
  await page.goto(link);
  await expect(page).toHaveURL(/\/es\/cuenta\?bienvenida=1$/);
  await expect(page.getByText('Tu cuenta está lista.')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Mis pedidos', level: 1 }),
  ).toBeVisible();
  await expect(page.getByText('Hola, Ana Prueba')).toBeVisible();
  await expect(page.getByText('Aún no tienes pedidos')).toBeVisible();

  // Una cuenta de cliente no entra en el panel.
  const panel = await page.goto('/admin');
  expect(panel?.status()).toBe(404);

  await page.goto('/es/cuenta');
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/es$/);
  // El enlace del correo no sirve dos veces.
  await page.goto(link);
  await expect(page).toHaveURL(/\/es\/cuenta\/acceso\?error=enlace$/);
  await expect(
    page.getByText('El enlace ha caducado o ya se usó.', { exact: false }),
  ).toBeVisible();
  await page.goto('/es/cuenta/datos');
  await expect(page).toHaveURL(
    /\/es\/cuenta\/acceso\?next=%2Fes%2Fcuenta%2Fdatos$/,
  );

  await signIn(page, email, `${password}-mal`);
  await expect(page.getByText('Email o contraseña incorrectos.')).toBeVisible();
  await signIn(page, email);
  await expect(page).toHaveURL(/\/es\/cuenta$/);
  // Con sesión, «Entrar» lleva a la cuenta.
  await page.goto('/ca/compte/acces');
  await expect(page).toHaveURL(/\/ca\/compte$/);
  await expect(
    page.getByRole('heading', { name: 'Les meves comandes', level: 1 }),
  ).toBeVisible();
});

test('pedidos de la cuenta: los de invitado con su email y los hechos con la sesión', async ({
  page,
}) => {
  const visits = await fakeBank(page);
  const product = await makeProduct();
  const customer = await confirmedCustomer('Bea Pedidos');
  const other = await confirmedCustomer('Otra cuenta');
  const guest = await serverOrder(product, customer.email);
  const foreign = await serverOrder(product, other.email, other.id);

  await signIn(page, customer.email);
  await expect(page).toHaveURL(/\/es\/cuenta$/);
  const row = page.getByRole('link', { name: `Ver el pedido Nº ${guest}` });
  await expect(row).toBeVisible();
  await expect(row.getByText('Pendiente de pago')).toBeVisible();
  await expect(
    page.getByRole('link', { name: `Ver el pedido Nº ${foreign}` }),
  ).toHaveCount(0);
  await row.click();
  await expect(page).toHaveURL(new RegExp(`/es/cuenta/pedidos/${guest}$`));
  await expect(
    page.getByRole('heading', { name: `Pedido Nº ${guest}` }),
  ).toBeVisible();
  await expect(page.getByText(product.name).first()).toBeVisible();
  await expect(page.getByText(customer.email)).toBeVisible();
  // El de otra cuenta no existe para esta.
  const response = await page.goto(`/es/cuenta/pedidos/${foreign}`);
  expect(response?.status()).toBe(404);

  // Mis datos: teléfono y dirección para el checkout.
  await page.goto('/es/cuenta/datos');
  await expect(page.getByText(customer.email)).toBeVisible();
  await expect(page.getByText('Entras con email y contraseña.')).toBeVisible();
  await page.getByLabel('Teléfono').fill('600 000 000');
  await page.getByLabel('Ciudad').fill('Castelldefels');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(
    page.getByText(
      'Completa dirección, código postal y ciudad, o deja la dirección vacía.',
    ),
  ).toBeVisible();
  await expect(page.getByLabel('Ciudad')).toHaveValue('Castelldefels');
  await page.getByLabel('Dirección', { exact: true }).fill('Calle Mayor 1');
  await page.getByLabel('Código postal').fill('08860');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  // Exacto: «Borrar la cuenta» también dice «…los datos guardados.».
  await expect(
    page.getByText('Datos guardados.', { exact: true }),
  ).toBeVisible();
  const saved = await admin
    .from('customer_accounts')
    .select('phone, address_line1, postal_code, city')
    .eq('user_id', customer.id)
    .single();
  if (saved.error) throw saved.error;
  expect(saved.data).toEqual({
    phone: '600 000 000',
    address_line1: 'Calle Mayor 1',
    postal_code: '08860',
    city: 'Castelldefels',
  });
  await page.reload();
  await expect(page.getByLabel('Código postal')).toHaveValue('08860');

  // El checkout rellena los datos y el pedido queda en la cuenta.
  await page.goto(`/es/perfume/${product.slug}`);
  await page.getByRole('button', { name: 'Añadir a la cesta' }).click();
  await expect(page.getByText('Añadido a tu cesta.')).toBeVisible();
  await page.goto('/es/finalizar-compra');
  await expect(
    page.getByText(`Compras con tu cuenta (${customer.email})`),
  ).toBeVisible();
  await expect(page.getByLabel('Nombre y apellidos')).toHaveValue(
    'Bea Pedidos',
  );
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue(
    customer.email,
  );
  await expect(page.getByLabel('Teléfono')).toHaveValue('600 000 000');
  await page.getByText('He leído y acepto las').click();
  await page.getByRole('button', { name: 'Confirmar pedido y pagar' }).click();
  await nextVisit(page, visits, 1);
  const { data, error } = await admin
    .from('orders')
    .select('number, customer_id')
    .eq('customer_id', customer.id);
  if (error) throw error;
  expect(data).toHaveLength(1);
  await page.goto('/es/cuenta');
  await expect(
    page.getByRole('link', { name: `Ver el pedido Nº ${data[0]!.number}` }),
  ).toBeVisible();
});

test('sin sesión, el checkout invita a entrar y vuelve con los datos', async ({
  page,
}) => {
  const product = await makeProduct();
  const customer = await confirmedCustomer('Carla Vuelta');
  await page.goto(`/es/perfume/${product.slug}`);
  await page.getByRole('button', { name: 'Añadir a la cesta' }).click();
  await expect(page.getByText('Añadido a tu cesta.')).toBeVisible();
  await page.goto('/es/finalizar-compra');
  await page.getByRole('link', { name: 'Entra', exact: true }).click();
  await expect(page).toHaveURL(
    /\/es\/cuenta\/acceso\?next=%2Fes%2Ffinalizar-compra$/,
  );
  await page.getByLabel('Email', { exact: true }).fill(customer.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/es\/finalizar-compra$/);
  await expect(page.getByLabel('Nombre y apellidos')).toHaveValue(
    'Carla Vuelta',
  );
});

test('recuperar la contraseña desde la tienda', async ({ page }) => {
  const customer = await confirmedCustomer();
  await page.goto('/en/account/sign-in');
  await page.getByRole('link', { name: "I've forgotten my password" }).click();
  await expect(page).toHaveURL(/\/en\/account\/forgot-password$/);
  await page.getByLabel('Email', { exact: true }).fill(customer.email);
  await page.getByRole('button', { name: 'Send link' }).click();
  await expect(
    page.getByRole('heading', { name: 'Check your email' }),
  ).toBeVisible();

  const link = await authLink(customer.email, 'recovery');
  await page.goto(link);
  await expect(page).toHaveURL(/\/en\/account\/new-password$/);
  const fresh = `${password}-nueva`;
  await page.getByLabel('New password').fill(fresh);
  await page.getByLabel('Repeat the password').fill(`${fresh}x`);
  await page.getByRole('button', { name: 'Save password' }).click();
  await expect(page.getByText("The passwords don't match.")).toBeVisible();
  await expect(page.getByLabel('New password')).toHaveValue(fresh);
  await page.getByLabel('Repeat the password').fill(fresh);
  await page.getByRole('button', { name: 'Save password' }).click();
  await expect(page).toHaveURL(/\/en\/account\?contrasena=1$/);
  await expect(page.getByText("We've saved your new password.")).toBeVisible();

  await page.getByRole('button', { name: 'Sign out' }).click();
  await signIn(page, customer.email);
  await expect(page.getByText('Email o contraseña incorrectos.')).toBeVisible();
  await signIn(page, customer.email, fresh);
  await expect(page).toHaveURL(/\/es\/cuenta$/);
});

test('Google: la acción lleva a Supabase con PKCE y la vuelta sin código falla con aviso', async ({
  page,
}) => {
  let authorize: URL | undefined;
  await page.route('**/auth/v1/authorize**', async (route) => {
    authorize = new URL(route.request().url());
    await route.fulfill({ status: 200, body: 'Google simulado' });
  });
  await page.goto('/es/cuenta/acceso?next=%2Fes%2Ffinalizar-compra');
  await page.getByRole('button', { name: 'Continuar con Google' }).click();
  await expect(page.getByText('Google simulado')).toBeVisible();
  expect(authorize?.searchParams.get('provider')).toBe('google');
  expect(authorize?.searchParams.get('code_challenge')).toBeTruthy();
  expect(authorize?.searchParams.get('code_challenge_method')).toBe('s256');
  const back = new URL(authorize!.searchParams.get('redirect_to')!);
  expect(back.origin + back.pathname).toBe(
    'http://localhost:3000/auth/callback',
  );
  expect(back.searchParams.get('next')).toBe('/es/finalizar-compra');

  // Cancelado en Google o código inventado: vuelve a «Entrar» con el aviso.
  await page.goto('/auth/callback?error=access_denied&next=%2Fca%2Fcompte');
  await expect(page).toHaveURL(/\/ca\/compte\/acces\?error=google$/);
  await expect(
    page.getByText('No hem pogut entrar amb Google.', { exact: false }),
  ).toBeVisible();
  await page.goto('/auth/callback?code=inventado&next=https://otro.example/');
  await expect(page).toHaveURL(/\/es\/cuenta\/acceso\?error=google$/);
});

test('el personal entra en la tienda pero no borra su cuenta ni cambia la contraseña sin MFA', async ({
  page,
}) => {
  const email = await user('store_admin');
  await signIn(page, email);
  await expect(page).toHaveURL(/\/es\/cuenta$/);
  await page.goto('/es/cuenta/datos');
  await expect(
    page.getByRole('button', { name: 'Borrar mi cuenta' }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: 'Cambiar la contraseña' }),
  ).toHaveCount(0);
  await page.goto('/es/cuenta/nueva-contrasena');
  await expect(page).toHaveURL(/\/admin\//);
});

test('borrar la cuenta: se va la ficha y el pedido se conserva sin vínculo', async ({
  page,
}) => {
  const product = await makeProduct();
  const customer = await confirmedCustomer();
  const number = await serverOrder(product, 'regalo@test.invalid', customer.id);
  await signIn(page, customer.email);
  await expect(
    page.getByRole('link', { name: `Ver el pedido Nº ${number}` }),
  ).toBeVisible();
  await page.goto('/es/cuenta/datos');
  await page.getByRole('button', { name: 'Borrar mi cuenta' }).click();
  await expect(
    page.getByText('Marca la casilla para confirmar.'),
  ).toBeVisible();
  await page.getByText('Entiendo que no se puede deshacer.').click();
  await page.getByRole('button', { name: 'Borrar mi cuenta' }).click();
  await expect(page).toHaveURL(/\/es\/cuenta\/acceso\?borrada=1$/);
  await expect(page.getByText('Hemos borrado tu cuenta.')).toBeVisible();

  await signIn(page, customer.email);
  await expect(page.getByText('Email o contraseña incorrectos.')).toBeVisible();
  const { data, error } = await admin
    .from('orders')
    .select('customer_id')
    .eq('number', number)
    .single();
  if (error) throw error;
  expect(data.customer_id).toBeNull();
  // Ni la cuenta ni su ficha quedan en la base.
  psql(
    `select 1 / (1 - count(*)) from auth.users where email = :'email';
     select 1 / (1 - count(*)) from public.customer_accounts c
     join auth.users u on u.id = c.user_id where u.email = :'email';`,
    { email: customer.email },
  );
});

test('cuenta con sesión: diseño sin solapes ni desbordes y sin fallos de axe', async ({
  page,
}) => {
  test.setTimeout(5 * 60_000);
  const product = await makeProduct();
  const customer = await confirmedCustomer('Dora Diseño');
  const number = await serverOrder(product, customer.email, customer.id);
  await signIn(page, customer.email);
  await expect(page).toHaveURL(/\/es\/cuenta$/);
  const reports: string[] = [];
  const violations: string[] = [];
  for (const [path, name] of [
    ['/es/cuenta', 'cuenta-pedidos-es'],
    [`/es/cuenta/pedidos/${number}`, 'cuenta-pedido-es'],
    ['/ca/compte/dades', 'cuenta-datos-ca'],
  ] as const) {
    const results = await auditRoute(page, path, name, AUDIT_WIDTHS, 200, {
      minTarget: 24,
    });
    const report = formatFindings(name, results);
    if (report) reports.push(report);
    const axe = await axeBaseline(page, path, name);
    violations.push(
      ...axe.violations.map(
        (v) => `${path}: ${v.id} (${v.impact}, ${v.nodes}) ${v.help}`,
      ),
    );
  }
  expect(reports.join('\n'), reports.join('\n')).toBe('');
  expect(violations, violations.join('\n')).toEqual([]);
});
