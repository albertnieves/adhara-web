import { expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { createHmac, randomUUID } from 'node:crypto';

/*
 * Ayudantes de los recorridos autenticados: solo contra Supabase local
 * (scripts/local-env.ts). Crean personal ficticio con MFA real.
 */

if (
  process.env.ADHARA_LOCAL_TEST !== '1' ||
  !/^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  )
)
  throw new Error('Pruebas únicamente locales');
export const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { persistSession: false } },
);
export const password = `Test-${randomUUID()}`;
export function totp(secret: string) {
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
export async function user(role: string) {
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

/**
 * SQL como postgres en la base local (contenedor de Supabase de Docker). Los
 * valores van en variables de psql (`:'nombre'` las cita como literal), no
 * pegados en el texto.
 */
export function psql(sql: string, vars: Record<string, string> = {}) {
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
      ...Object.entries(vars).flatMap(([name, value]) => [
        '-v',
        `${name}=${value}`,
      ]),
    ],
    { input: sql, stdio: ['pipe', 'ignore', 'inherit'] },
  );
}

/**
 * Hace titular de la consola (/admin/control) a un usuario ya creado: la
 * lista internal.control_owners solo se cambia por SQL (DECISIONS §127).
 */
export function makeControlOwner(email: string) {
  psql(
    `insert into internal.control_owners (user_id, note)
     select id, 'Prueba local' from auth.users where email = :'email'
     on conflict (user_id) do nothing;
     -- División por cero (y error) si el usuario no existe.
     select 1 / count(*) from internal.control_owners o
     join auth.users u on u.id = o.user_id where u.email = :'email';`,
    { email },
  );
}

export async function login(page: Page, email: string) {
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

export type TestProduct = { variantId: string; name: string; slug: string };

/**
 * Perfume publicado de 49,90 €, sin coste (no altera el stock a coste del
 * inicio), con `units` en la tienda registradas por un administrador de la
 * tienda. Hay que archivarlo al terminar (archiveProduct).
 */
export async function sellableProduct(units: number): Promise<TestProduct> {
  const id = randomUUID().slice(0, 8);
  const name = `Perfume pedidos ${id}`;
  const slug = `perfume-pedidos-${id}`;
  const email = await user('store_admin');
  psql(
    `begin;
     with b as (
       insert into public.brands (slug, name)
       values ('marca-pedidos-' || :'id', 'Marca pedidos ' || :'id') returning id
     ), p as (
       insert into public.products (brand_id, slug, name)
       select b.id, :'slug', :'name'
       from b returning id
     ), s as (
       insert into public.product_sources (product_id, source_ref)
       select p.id, 'tests/integration/support.ts' from p
     )
     insert into public.product_variants (product_id, sku, size_ml, retail_price_cents)
     select p.id, 'PED-' || :'id', 100, 4990 from p;
     update public.products set status = 'published' where slug = :'slug';
     select set_config('request.jwt.claims', json_build_object(
       'sub', (select id from auth.users where email = :'email'),
       'aal', 'aal2', 'role', 'authenticated')::text, true);
     select public.admin_record_inventory_movement(v.id,
       (select id from public.stock_locations where code = 'castelldefels'),
       'PURCHASE_RECEIPT', ${units})
     from public.product_variants v
     join public.products p on p.id = v.product_id where p.slug = :'slug';
     commit;`,
    { id, name, slug, email },
  );
  const { data, error } = await admin
    .from('product_variants')
    .select('id, products!inner(slug)')
    .eq('products.slug', slug)
    .single();
  if (error) throw error;
  return { variantId: String(data.id), name, slug };
}

/** Fuera de la tienda pública; los pedidos lo siguen nombrando. */
export function archiveProduct(product: TestProduct) {
  psql(`update public.products set status = 'archived' where slug = :'slug';`, {
    slug: product.slug,
  });
}
