import { expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
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
