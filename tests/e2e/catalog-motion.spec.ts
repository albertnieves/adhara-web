import { expect, test } from '@playwright/test';

/*
 * Colección y catálogo olfativo con movimiento y 3D (DECISIONS §189): los
 * filtros siguen siendo botones con aria-pressed, el abanico de la cabecera
 * enlaza a las fichas, la pirámide olfativa conserva sus tres explicaciones y
 * el movimiento ligado al scroll desaparece con «reducir movimiento».
 *
 * La base de la CI solo tiene el perfume centinela, sin foto ni escena: lo
 * que depende de fotos o de escenas 3D se omite allí y se pasa con el
 * catálogo en la base local.
 */

test('los filtros de casa se marcan de uno en uno', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile',
    'En el móvil es un desplegable',
  );
  await page.goto('/es/catalogo');
  const all = page.getByRole('button', { name: 'Todas las casas' });
  await expect(all).toHaveAttribute('aria-pressed', 'true');
  const brand = page
    .getByRole('button', { name: 'Marca centinela (prueba)' })
    .first();
  await brand.click();
  await expect(brand).toHaveAttribute('aria-pressed', 'true');
  await expect(all).toHaveAttribute('aria-pressed', 'false');
  // Solo quedan perfumes de esa casa (las demás tarjetas se van con un fundido).
  const cards = page.locator('main ul > li a.group');
  await expect(cards.first()).toBeVisible();
  await expect
    .poll(async () =>
      (await cards.allInnerTexts()).every((text) =>
        text.toUpperCase().includes('MARCA CENTINELA'),
      ),
    )
    .toBe(true);
  // Volver a pulsarlo lo quita.
  await brand.click();
  await expect(all).toHaveAttribute('aria-pressed', 'true');
});

test('el titular y el resumen de la colección dicen cuántas hay', async ({
  page,
}) => {
  await page.goto('/es/catalogo');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Todas las fragancias',
  );
  await expect(
    page.getByText(/^\d+ fragancias? de \d+ casas?\.$/),
  ).toBeVisible();
});

test('el abanico de la cabecera lleva a la ficha', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'Solo en pantallas anchas');
  await page.goto('/es/catalogo');
  const deck = page.getByRole('list', { name: 'Una fragancia de cada casa' });
  test.skip((await deck.count()) === 0, 'Sin perfumes con foto en esta base');
  const links = deck.getByRole('link');
  expect(await links.count()).toBeGreaterThan(0);
  expect(await links.count()).toBeLessThanOrEqual(4);
  const first = links.first();
  const name = await first.getAttribute('aria-label');
  expect(name).toBeTruthy();
  // Con el teclado: el foco saca la carta y Intro abre la ficha.
  await first.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/es\/perfume\/[a-z0-9-]+$/);
});

test('los perfumes con escena llevan «Vista 3D»', async ({ page }) => {
  await page.goto('/es/catalogo');
  const tags = page
    .locator('main ul > li')
    .getByText('Vista 3D', { exact: true });
  test.skip(
    (await tags.count()) === 0,
    'Sin perfumes con escena 3D en esta base',
  );
  // La marca va dentro del enlace a la ficha, donde está la escena.
  await expect(
    tags.first().locator('xpath=ancestor::a[contains(@href, "/es/perfume/")]'),
  ).toHaveCount(1);
});

test('la pirámide olfativa conserva sus tres explicaciones', async ({
  page,
}) => {
  await page.goto('/es/catalogo-olfativo');
  for (const name of ['Salida', 'Corazón', 'Fondo'])
    await expect(
      page.getByRole('heading', { level: 2, name, exact: true }),
    ).toBeVisible();
  await expect(
    page.getByText('Los primeros minutos: la primera impresión.'),
  ).toBeVisible();
  // Los filtros del catálogo olfativo también son botones con estado.
  const family = page.getByRole('button', { name: 'Floral', exact: true });
  await family.click();
  await expect(family).toHaveAttribute('aria-pressed', 'true');
});

test('con «reducir movimiento» las tarjetas no se mueven con el scroll', async ({
  page,
}) => {
  await page.goto('/es/catalogo');
  const rise = page.locator('main ul > li .scroll-rise').first();
  await expect(rise).toBeAttached();
  const animation = () =>
    rise.evaluate((node) => getComputedStyle(node).animationName);
  // Chromium admite animation-timeline: sin la preferencia, la entrada existe.
  expect(await animation()).toBe('scroll-rise');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await animation()).toBe('none');
  await expect(rise).toHaveCSS('opacity', '1');
});
