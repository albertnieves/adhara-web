import { expect, test } from '@playwright/test';

/*
 * Preguntas frecuentes de la portada: plegadas para no cargar la página,
 * una abierta cada vez, con teclado, y enlazadas desde el pie de todas las
 * páginas.
 */

test('preguntas frecuentes plegadas en la portada', async ({ page }) => {
  await page.goto('/es');
  const faq = page.getByRole('region', { name: 'Preguntas frecuentes' });
  const questions = faq.locator('summary');
  await expect(questions).toHaveCount(5);

  // Cerradas: solo se ven las preguntas.
  const answer = faq.getByText(/^Todavía no\. La compra online/);
  await expect(answer).toBeHidden();

  // Intro abre la pregunta enfocada.
  await questions.first().focus();
  await page.keyboard.press('Enter');
  await expect(answer).toBeVisible();

  // Una abierta cada vez.
  await questions.nth(1).click();
  await expect(faq.getByText(/^En .+, Castelldefels\./)).toBeVisible();
  await expect(answer).toBeHidden();
});

test('el pie enlaza las preguntas frecuentes desde la colección', async ({
  page,
}) => {
  await page.goto('/en/catalog');
  await page
    .getByRole('contentinfo')
    .getByRole('link', { name: 'FAQ', exact: true })
    .click();
  await expect(page).toHaveURL(/\/en#preguntas-frecuentes$/);
  await expect(
    page.getByRole('region', { name: 'Frequently asked questions' }),
  ).toBeInViewport();
});
