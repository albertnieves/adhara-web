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
