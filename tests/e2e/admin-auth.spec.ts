import { expect, test } from '@playwright/test';

for (const path of [
  '/admin',
  '/admin/mfa',
  '/admin/contrasena',
  '/admin/catalogo',
  '/admin/catalogo/nuevo',
  '/admin/catalogo/etiquetas',
  '/admin/inventario',
  '/admin/movimientos',
  '/admin/equipo',
]) {
  test(`sin sesión ${path} redirige al acceso`, async ({ request }) => {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers().location).toMatch(/\/admin\/acceso$/);
  });
}

test('la pantalla de acceso no se indexa ni se cachea', async ({ page }) => {
  const response = await page.goto('/admin/acceso');
  expect(response?.status()).toBe(200);
  expect(response?.headers()['x-robots-tag']).toBe('noindex, nofollow');
  expect(response?.headers()['cache-control']).toContain('no-store');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel('Contraseña')).toBeVisible();
});

test('los enlaces de acceso inválidos no abren sesión', async ({ request }) => {
  const response = await request.get('/auth/confirm?token_hash=x&type=invite', {
    maxRedirects: 0,
  });
  expect(response.headers().location).toMatch(/\/admin\/acceso\?error=enlace$/);
});
