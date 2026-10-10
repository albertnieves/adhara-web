import { expect, test } from '@playwright/test';

/*
 * Textos legales: enlazados desde la barra inferior del pie en los tres
 * idiomas, con rutas traducidas e índice que lleva a cada sección. Lo que
 * depende de un dato pendiente no se publica.
 */

const PAGES = [
  ['es', 'Aviso legal', /\/es\/aviso-legal$/],
  ['es', 'Condiciones de venta', /\/es\/condiciones-de-venta$/],
  ['es', 'Política de privacidad', /\/es\/privacidad$/],
  ['es', 'Política de cookies', /\/es\/cookies$/],
  ['es', 'Envíos y devoluciones', /\/es\/envios-y-devoluciones$/],
  ['ca', 'Política de galetes', /\/ca\/galetes$/],
  ['en', 'Shipping and returns', /\/en\/shipping-and-returns$/],
] as const;

for (const [locale, title, url] of PAGES) {
  test(`el pie enlaza «${title}» (${locale})`, async ({ page }) => {
    await page.goto(`/${locale}`);
    await page
      .getByRole('contentinfo')
      .getByRole('link', { name: title, exact: true })
      .click();
    await expect(page).toHaveURL(url);
    await expect(
      page.getByRole('heading', { level: 1, name: title }),
    ).toBeVisible();
  });
}

test('el índice lleva a cada sección y no se publican datos pendientes', async ({
  page,
}) => {
  await page.goto('/es/envios-y-devoluciones');
  await page
    .getByRole('navigation', { name: 'En esta página' })
    .getByRole('link', { name: 'Perfumes precintados' })
    .click();
  await expect(page).toHaveURL(/#precintados$/);
  await expect(
    page.getByRole('heading', { name: 'Perfumes precintados' }),
  ).toBeInViewport();
  // Sin datos del titular ni de envíos, esas líneas no se ven en la tienda.
  await expect(page.locator('mark[data-pending]')).toHaveCount(0);
  await expect(page.getByText('Pendiente', { exact: false })).toHaveCount(0);
  await expect(page.getByText(/^Enviamos a/)).toHaveCount(0);
  await expect(
    page.getByText(/^A la atención de L’Atelier du Désert, .+Castelldefels:$/),
  ).toBeVisible();
});

test('el aviso de la suscripción enlaza la política de privacidad', async ({
  page,
}) => {
  await page.goto('/ca');
  await page
    .locator('section[aria-labelledby="newsletter-title"]')
    .getByRole('link', { name: 'política de privacitat' })
    .click();
  await expect(page).toHaveURL(/\/ca\/privacitat$/);
});

test.describe('aviso de entrada', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('hay que aceptarlo antes de navegar y no vuelve a salir', async ({
    page,
    context,
  }) => {
    await page.goto('/es');
    const dialog = page.getByRole('dialog', { name: 'Antes de empezar' });
    await expect(dialog).toBeVisible();
    const accept = dialog.getByRole('button', { name: 'Aceptar y continuar' });
    await expect(accept).toBeFocused();

    // Esc no lo cierra y el resto de la página queda inerte.
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 5; i += 1) await page.keyboard.press('Tab');
    expect(
      await dialog.evaluate((node) => node.contains(document.activeElement)),
    ).toBe(true);

    await accept.click();
    await expect(dialog).toBeHidden();
    const cookie = (await context.cookies()).find(
      (item) => item.name === 'atelier_aviso',
    );
    expect(cookie?.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(cookie!.expires - Date.now() / 1000).toBeGreaterThan(
      360 * 24 * 3600,
    );

    await page.goto('/ca/cataleg');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('enlaza los textos legales y no tapa esas páginas', async ({ page }) => {
    await page.goto('/en');
    const dialog = page.getByRole('dialog', { name: 'Before you start' });
    await dialog.getByRole('link', { name: 'privacy policy' }).click();
    await expect(page).toHaveURL(/\/en\/privacy-policy$/);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Privacy policy' }),
    ).toBeVisible();

    // Al volver a la tienda sin aceptar, se muestra otra vez.
    await page.goto('/en/catalog');
    await expect(
      page.getByRole('dialog', { name: 'Before you start' }),
    ).toBeVisible();
  });

  test('sin infracciones de accesibilidad', async ({ page }) => {
    await page.goto('/es');
    await expect(page.getByRole('dialog')).toBeVisible();
    const { default: AxeBuilder } = await import('@axe-core/playwright');
    const results = await new AxeBuilder({ page })
      .include('dialog')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
