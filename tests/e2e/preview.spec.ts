import { test, expect } from '@playwright/test';

/*
 * La vista previa con borradores solo se activa desde el panel (Server Action
 * con catalog.edit y MFA). Una cookie inventada no la activa y la página sigue
 * saliendo de la caché pública.
 */
test('una cookie de vista previa falsa no activa la vista previa', async ({
  request,
}) => {
  const response = await request.get('/es', {
    headers: { Cookie: '__prerender_bypass=inventada' },
  });
  expect(response.status()).toBe(200);
  expect(await response.text()).not.toContain('con borradores, solo personal');
  expect(response.headers()['cache-control']).not.toContain('private');
});
