import { expect, test, type Page } from '@playwright/test';

/*
 * Carrusel 3D de la portada (DECISIONS §188). Sale con los perfumes
 * publicados que tienen escena 3D (los cuatro del piloto); la base de la CI
 * solo tiene el perfume centinela, sin escena, así que allí se omite y la
 * portada fija la cubren el resto de pruebas. Se ejecuta con los pilotos en la
 * base local.
 *
 * El navegador de pruebas no tiene GPU: el carrusel enseña las fotos con los
 * mismos controles, y `?3d` fuerza la escena para comprobar que arranca.
 */

async function openHome(
  page: Page,
  path = '/es',
  name = 'Perfumes de la colección en 3D',
) {
  await page.goto(path);
  const carousel = page.getByRole('group', { name });
  test.skip(
    (await carousel.count()) === 0,
    'Sin perfumes publicados con escena 3D en esta base',
  );
  return carousel;
}

const current = (page: Page) =>
  page.locator('[aria-roledescription="perfume"]').getAttribute('aria-label');

test('cambia de perfume con los botones, las rayas y el teclado', async ({
  page,
}) => {
  const carousel = await openHome(page);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  // Sin dejar que gire solo mientras se prueba.
  await carousel.getByRole('button', { name: 'Pausar el giro' }).click();
  await expect(
    carousel.getByRole('button', { name: 'Reanudar el giro' }),
  ).toBeVisible();

  const total = await carousel
    .getByRole('button', { name: /^Mostrar / })
    .count();
  expect(total).toBeGreaterThan(1);
  await expect(
    page.locator('[aria-roledescription="perfume"]'),
  ).toHaveAttribute('aria-label', `1 de ${total}`);

  await carousel.getByRole('button', { name: 'Perfume siguiente' }).click();
  await expect.poll(() => current(page)).toBe(`2 de ${total}`);
  await carousel.getByRole('button', { name: 'Perfume anterior' }).click();
  await expect.poll(() => current(page)).toBe(`1 de ${total}`);
  // Del primero hacia atrás se llega al último.
  await carousel.getByRole('button', { name: 'Perfume anterior' }).click();
  await expect.poll(() => current(page)).toBe(`${total} de ${total}`);

  // Cada raya lleva a su perfume y queda marcada.
  const pickers = carousel.getByRole('button', { name: /^Mostrar / });
  await pickers.nth(1).click();
  await expect.poll(() => current(page)).toBe(`2 de ${total}`);
  await expect(pickers.nth(1)).toHaveAttribute('aria-current', 'true');
  await expect(carousel.locator('[aria-current="true"]')).toHaveCount(1);

  // Flechas del teclado dentro del carrusel.
  await pickers.nth(1).focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => current(page)).toBe(`3 de ${total}`);
  await page.keyboard.press('ArrowLeft');
  await expect.poll(() => current(page)).toBe(`2 de ${total}`);
});

test('gira solo y se puede pausar', async ({ page }) => {
  const carousel = await openHome(page);
  const total = await carousel
    .getByRole('button', { name: /^Mostrar / })
    .count();
  // Cada perfume se queda 6,5 s al frente.
  await expect
    .poll(() => current(page), { timeout: 12_000 })
    .toBe(`2 de ${total}`);
  await carousel.getByRole('button', { name: 'Pausar el giro' }).click();
  await page.waitForTimeout(8_000);
  expect(await current(page)).toBe(`2 de ${total}`);
});

test('con «reducir movimiento» no gira solo', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const carousel = await openHome(page);
  await expect(
    carousel.getByRole('button', { name: 'Reanudar el giro' }),
  ).toBeVisible();
  await page.waitForTimeout(8_000);
  expect(await current(page)).toMatch(/^1 de /);
});

test('«Ver el perfume» lleva a la ficha del perfume del frente', async ({
  page,
}) => {
  const carousel = await openHome(page);
  await carousel.getByRole('button', { name: 'Pausar el giro' }).click();
  await carousel.getByRole('button', { name: 'Perfume siguiente' }).click();
  await expect.poll(() => current(page)).toMatch(/^2 de /);
  const link = carousel.getByRole('link', { name: /^Ver el perfume / });
  const name = (await link.textContent())!.replace('Ver el perfume', '').trim();
  await link.click();
  await expect(page).toHaveURL(/\/es\/perfume\/[a-z0-9-]+$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
});

test('en catalán y en inglés, con sus textos', async ({ page }) => {
  const ca = await openHome(page, '/ca', 'Perfums de la col·lecció en 3D');
  await expect(ca).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Perfum següent' }),
  ).toBeVisible();
  await page.goto('/en');
  await expect(
    page.getByRole('group', { name: 'Fragrances from the collection in 3D' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: /^View the fragrance / }),
  ).toBeVisible();
});

test('sin GPU enseña fotos y con ?3d arranca la escena sin errores', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openHome(page);
  // Navegador de pruebas sin GPU: fotos, sin lienzo y sin descargar three.js
  // (§191). La escena llegaría después de cargar, con el navegador libre: se
  // espera a ese momento antes de comprobarlo.
  await expect(page.locator('main img').first()).toBeVisible();
  await page.waitForLoadState('load');
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestIdleCallback(() => setTimeout(resolve, 1000), {
          timeout: 3000,
        }),
      ),
  );
  await expect(page.locator('main canvas')).toHaveCount(0);
  // three.js se anuncia en window.__THREE__ al cargarse.
  expect(await page.evaluate(() => '__THREE__' in window)).toBe(false);

  await page.goto('/es?3d');
  // Mientras llega la escena, la foto del perfume del frente.
  await expect(page.locator('main img').first()).toBeVisible();
  await expect(page.locator('main canvas')).toHaveCount(1, { timeout: 20_000 });
  // La escena es decorativa: el lienzo va dentro de un contenedor oculto.
  await expect(
    page
      .locator('main canvas')
      .locator('xpath=ancestor::*[@aria-hidden="true"][1]'),
  ).toHaveCount(1);
  expect(errors).toEqual([]);
});
