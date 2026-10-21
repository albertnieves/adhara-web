import { expect, test } from '@playwright/test';

/*
 * Páginas de casa: el índice solo lista casas con perfumes a la vista, cada
 * casa enseña los suyos y la ficha enlaza su casa. Una casa que no existe (o
 * sin publicados) es 404 en los tres idiomas.
 */

test('el índice de casas responde en los tres idiomas y lo enlaza el pie', async ({
  page,
}) => {
  await page.goto('/ca/cataleg');
  await page
    .getByRole('contentinfo')
    .getByRole('link', { name: 'Cases', exact: true })
    .click();
  await expect(page).toHaveURL(/\/ca\/cases$/);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Les cases' }),
  ).toBeVisible();
  for (const [path, title] of [
    ['/es/casas', 'Las casas'],
    ['/en/houses', 'The houses'],
  ] as const) {
    await page.goto(path);
    await expect(
      page.getByRole('heading', { level: 1, name: title }),
    ).toBeVisible();
  }
});

test('una casa que no existe es 404', async ({ request }) => {
  for (const path of [
    '/es/casas/no-existe',
    '/ca/cases/no-existe',
    '/en/houses/no-existe',
  ]) {
    expect((await request.get(path)).status()).toBe(404);
  }
});

test('de la ficha a su casa y de la casa a sus perfumes', async ({
  page,
  request,
}) => {
  const catalog = await (await request.get('/es/catalogo')).text();
  const slug = catalog.match(/href="\/es\/perfume\/([a-z0-9-]+)"/)?.[1];
  test.skip(!slug, 'No hay perfumes publicados en esta base');

  await page.goto(`/es/perfume/${slug}`);
  // El antetítulo de la ficha es el primer enlace a la casa (el segundo, «Ver
  // todo de…», solo sale si la casa tiene más perfumes).
  const brand = page.locator('main a[href^="/es/casas/"]').first();
  const name = (await brand.textContent())?.trim() ?? '';
  expect(name).not.toBe('');
  await brand.click();
  await expect(page).toHaveURL(/\/es\/casas\/[a-z0-9-]+$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
  // La casa incluye el perfume del que venimos.
  await expect(page.locator(`main a[href="/es/perfume/${slug}"]`)).toHaveCount(
    1,
  );

  // El índice lleva a esta casa.
  const house = new URL(page.url()).pathname;
  await page.goto('/es/casas');
  await expect(page.locator(`main a[href="${house}"]`)).toHaveCount(1);
});

test('la casa centinela enseña su perfume', async ({ request }) => {
  test.skip(
    !process.env.ADHARA_COST_SENTINEL,
    'Solo con tests/fixtures/test-db.sql cargado (e2e.yml)',
  );
  for (const path of [
    '/es/casas/marca-centinela',
    '/ca/cases/marca-centinela',
    '/en/houses/marca-centinela',
  ]) {
    const page = await request.get(path);
    expect(page.status()).toBe(200);
    const html = await page.text();
    expect(html).toContain('Marca centinela (prueba)');
    expect(html).toContain('Perfume centinela (prueba)');
  }
});
