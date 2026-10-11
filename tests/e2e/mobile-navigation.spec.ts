import { expect, test, type Locator } from '@playwright/test';

/*
 * Navegación en el móvil: el menú desplegable ocupa la pantalla y lleva a
 * cada sección, y la colección se ve en cuadrícula de dos columnas (por
 * defecto) o en vista amplia. Desde 640 px las dos vistas son iguales y el
 * selector no se muestra.
 */

const columns = (list: Locator) =>
  list.evaluate(
    (el) => getComputedStyle(el).gridTemplateColumns.split(' ').length,
  );

test('el menú móvil ocupa la pantalla y navega', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Menú solo en el móvil');
  const menu = page.locator('#mobile-menu');
  const destinations = [
    ['/es/catalogo', 'Catálogo olfativo', /\/es\/catalogo-olfativo$/],
    ['/es/catalogo-olfativo', 'Colección', /\/es\/catalogo$/],
    ['/es/catalogo', 'Inicio', /\/es$/],
  ] as const;
  for (const [from, name, url] of destinations) {
    await page.goto(from);
    await page.getByRole('button', { name: 'Menú' }).click();
    await expect(menu).toBeVisible();
    // Dentro de la cabecera quedaba encerrado en sus 72 px y sin recibir toques.
    expect((await menu.boundingBox())!.height).toBeGreaterThan(600);
    await menu.getByRole('link', { name, exact: true }).click();
    await expect(page).toHaveURL(url);
    await expect(menu).toBeHidden();
  }

  await page.getByRole('button', { name: 'Menú' }).click();
  await expect(menu).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
});

test('la colección se ve en cuadrícula o en vista amplia', async ({
  page,
}, testInfo) => {
  await page.goto('/es/catalogo');
  const view = page.getByRole('group', { name: 'Vista' });
  if (testInfo.project.name !== 'mobile') {
    await expect(view).toBeHidden();
    return;
  }
  const list = page.getByRole('main').getByRole('list');
  test.skip((await list.count()) === 0, 'Sin perfumes publicados en esta base');

  const grid = view.getByRole('button', { name: 'Cuadrícula' });
  const large = view.getByRole('button', { name: 'Vista amplia' });
  await expect(grid).toHaveAttribute('aria-pressed', 'true');
  expect(await columns(list)).toBe(2);

  await large.click();
  await expect(large).toHaveAttribute('aria-pressed', 'true');
  await expect(grid).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(() => columns(list)).toBe(1);

  // Se conserva al ir a una ficha y volver.
  await list.getByRole('link').first().click();
  await expect(page).toHaveURL(/\/es\/perfume\//);
  await page.goBack();
  await expect(large).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => columns(list)).toBe(1);

  await grid.click();
  await expect.poll(() => columns(list)).toBe(2);
});
