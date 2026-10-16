import { expect, test } from '@playwright/test';

test('el entorno de pruebas mantiene robots y sitemap cerrados', async ({
  request,
}) => {
  const robots = await request.get('/robots.txt');
  expect(robots.ok()).toBe(true);
  expect(await robots.text()).toContain('Disallow: /');
  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.ok()).toBe(true);
  expect(sitemap.headers()['content-type']).toContain('xml');
  expect(await sitemap.text()).not.toContain('<loc>');
});
