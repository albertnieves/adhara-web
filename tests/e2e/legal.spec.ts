import { expect, test } from '@playwright/test';

/*
 * Textos legales: enlazados desde el pie en los tres idiomas, con rutas
 * traducidas, índice que lleva a cada sección y los datos que faltan
 * señalados como pendientes.
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

test('el índice lleva a cada sección y los datos pendientes se ven', async ({
  page,
}) => {
  await page.goto('/es/envios-y-devoluciones');
  await expect(page.getByRole('note')).toContainText(
    'La compra online todavía no está disponible',
  );
  await page
    .getByRole('navigation', { name: 'En esta página' })
    .getByRole('link', { name: 'Perfumes precintados' })
    .click();
  await expect(page).toHaveURL(/#precintados$/);
  await expect(
    page.getByRole('heading', { name: 'Perfumes precintados' }),
  ).toBeInViewport();
  await expect(page.locator('mark[data-pending="taxId"]')).toHaveCount(0);
  await expect(
    page.locator('mark[data-pending="shippingZones"]').first(),
  ).toHaveText('Pendiente: zonas de envío');
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
