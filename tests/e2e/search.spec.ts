import { expect, test } from '@playwright/test';

/*
 * Búsqueda de la tienda (roadmap 5, DECISIONS §181): desde la cabecera en el
 * ordenador y desde el menú en el móvil, por nombre, casa, familia o nota,
 * con la búsqueda en la URL y salidas útiles si no hay nada. Las que buscan
 * datos usan el perfume centinela de tests/fixtures/test-db.sql (notas
 * bergamota, rosa y ámbar; familia floral).
 */

const SENTINEL = Boolean(process.env.ADHARA_COST_SENTINEL);

test('las rutas existen en los tres idiomas y no se indexan', async ({
  page,
}) => {
  for (const [path, lang, heading] of [
    ['/es/buscar', 'es', 'Encuentra tu perfume'],
    ['/ca/cercar', 'ca', 'Troba el teu perfum'],
    ['/en/search', 'en', 'Find your fragrance'],
  ] as const) {
    const response = await page.goto(path);
    expect(response!.status()).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
    await expect(
      page.getByRole('heading', { level: 1, name: heading }),
    ).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      /noindex/,
    );
  }
});

test('desde la cabecera: busca por nombre y guarda la búsqueda en la URL', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'En el móvil va en el menú');
  test.skip(!SENTINEL, 'Solo con tests/fixtures/test-db.sql (e2e.yml)');
  await page.goto('/es/catalogo');
  await page.getByRole('banner').getByRole('link', { name: 'Buscar' }).click();
  await expect(page).toHaveURL(/\/es\/buscar$/);
  const box = page.getByRole('searchbox', {
    name: 'Buscar perfumes, casas, familias o notas',
  });
  await expect(box).toBeFocused();
  await box.fill('centinela');
  await expect(page).toHaveURL(/\/es\/buscar\?q=centinela$/);
  await expect(page.getByRole('status')).toHaveText(
    /1 perfume para «centinela»/i,
  );
  await expect(
    page.getByRole('link', { name: /Perfume centinela \(prueba\)/ }),
  ).toBeVisible();

  // Al recargar o compartir el enlace, la búsqueda sigue ahí.
  await page.reload();
  await expect(box).toHaveValue('centinela');
  await expect(
    page.getByRole('link', { name: /Perfume centinela \(prueba\)/ }),
  ).toBeVisible();
});

test('por nota en cualquier idioma, por familia y por casa', async ({
  page,
}) => {
  test.skip(!SENTINEL, 'Solo con tests/fixtures/test-db.sql (e2e.yml)');
  // Nota en inglés desde la página en catalán: las notas se buscan en los tres.
  await page.goto('/ca/cercar?q=bergamot');
  await expect(
    page.getByRole('link', { name: /Perfume centinela \(prueba\)/ }),
  ).toBeVisible();

  // Familia: enlaza el catálogo olfativo ya filtrado.
  await page.goto('/es/buscar?q=floral');
  const families = page.getByRole('region', { name: 'Familias olfativas' });
  await families.getByRole('link', { name: /Floral/ }).click();
  await expect(page).toHaveURL(/\/es\/catalogo-olfativo\?familia=floral$/);
  await expect(
    page.getByRole('button', { name: 'Floral', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');

  // Casa: enlaza su página.
  await page.goto('/en/search?q=marca%20centinela');
  await page
    .getByRole('region', { name: 'Houses' })
    .getByRole('link', { name: /Marca centinela \(prueba\)/ })
    .click();
  await expect(page).toHaveURL(/\/en\/houses\/marca-centinela$/);
});

test('sin resultados: lo dice y propone por dónde seguir', async ({ page }) => {
  await page.goto('/es/buscar?q=zzzzqx');
  await expect(page.getByText('Sin resultados para «zzzzqx»')).toBeVisible();
  await page.getByRole('link', { name: 'Ver la colección' }).click();
  await expect(page).toHaveURL(/\/es\/catalogo$/);
});

test('en el móvil, desde el menú', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Menú solo en el móvil');
  await page.goto('/es');
  await page.getByRole('button', { name: 'Menú' }).click();
  const menu = page.locator('#mobile-menu');
  const box = menu.getByRole('searchbox', {
    name: 'Buscar perfumes, casas, familias o notas',
  });
  await box.fill('rosa');
  await box.press('Enter');
  await expect(page).toHaveURL(/\/es\/buscar\?q=rosa$/);
  await expect(menu).toBeHidden();
  await expect(
    page.getByRole('searchbox', {
      name: 'Buscar perfumes, casas, familias o notas',
    }),
  ).toHaveValue('rosa');
  await expect(page.getByRole('status')).toContainText('«rosa»');
});

test('en el móvil, las casas de la colección en un desplegable', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Solo por debajo de 640 px');
  await page.goto('/es/catalogo');
  const list = page.getByRole('main').getByRole('list');
  test.skip((await list.count()) === 0, 'Sin perfumes publicados en esta base');
  const select = page.getByRole('combobox', { name: 'Casa' });
  await expect(select).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Todas las casas' }),
  ).toBeHidden();
  test.skip(!SENTINEL, 'Solo con tests/fixtures/test-db.sql (e2e.yml)');
  await select.selectOption({ label: 'Marca centinela (prueba)' });
  await expect(page.getByText('1 perfume', { exact: true })).toBeVisible();
});
