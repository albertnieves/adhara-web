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

test('salir de la vista previa vuelve a la tienda sin redirigir fuera', async ({
  request,
}) => {
  const local = await request.post('/api/vista-previa/salir', {
    form: { path: '/ca/cataleg' },
    maxRedirects: 0,
  });
  expect(local.status()).toBe(303);
  expect(new URL(local.headers().location!).pathname).toBe('/ca/cataleg');
  const external = await request.post('/api/vista-previa/salir', {
    form: { path: '//ejemplo.com/es' },
    maxRedirects: 0,
  });
  expect(new URL(external.headers().location!).host).toBe('localhost:3000');
  expect(new URL(external.headers().location!).pathname).toBe('/es');
});
