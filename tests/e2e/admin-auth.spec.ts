import { expect, test } from '@playwright/test';

for (const path of [
  '/admin',
  '/admin/mfa',
  '/admin/contrasena',
  '/admin/catalogo',
  '/admin/catalogo/nuevo',
  '/admin/catalogo/etiquetas',
  '/admin/catalogo/importar',
  '/admin/catalogo/precios',
  '/admin/inventario',
  '/admin/movimientos',
  '/admin/movimientos/exportar',
  '/admin/equipo',
  '/admin/diseno',
  '/admin/control',
  '/admin/control/negocio',
  '/admin/control/costes',
  '/admin/control/tareas',
  '/admin/control/entregas',
  '/admin/control/productos',
  '/admin/control/atencion',
  '/admin/control/sistema',
  '/admin/control/copias',
  '/admin/control/asistente',
  '/admin/control/calidad',
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

test('abrir el enlace de un correo no abre sesión sin pulsar el botón', async ({
  request,
}) => {
  const token = 'abcdefghijklmnop';
  const page = await request.get(
    `/auth/confirm?token_hash=${token}&type=recovery&next=%22%3E%3Cscript%3Ealert(1)%3C%2Fscript%3E`,
    { maxRedirects: 0 },
  );
  expect(page.status()).toBe(200);
  expect(page.headers()['cache-control']).toContain('no-store');
  expect(page.headers()['referrer-policy']).toBe('no-referrer');
  const html = await page.text();
  expect(html).toContain('<form method="post" action="/auth/confirm">');
  expect(html).not.toContain('<script');
  // Otra web no puede enviar el token por la persona (DECISIONS §187).
  const forged = await request.post('/auth/confirm', {
    form: { token_hash: token, type: 'recovery' },
    headers: { Origin: 'https://evil.example', 'Sec-Fetch-Site': 'cross-site' },
    maxRedirects: 0,
  });
  expect(forged.status()).toBe(303);
  expect(forged.headers().location).toMatch(/\/admin\/acceso\?error=enlace$/);
});

test('los enlaces de acceso inválidos no abren sesión', async ({ request }) => {
  const response = await request.get('/auth/confirm?token_hash=x&type=invite', {
    maxRedirects: 0,
  });
  expect(response.headers().location).toMatch(/\/admin\/acceso\?error=enlace$/);
});
