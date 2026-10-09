import { expect, test } from '@playwright/test';

/*
 * Suscripción a promociones (antes del pie, en todas las páginas) y catálogo
 * olfativo sin compra. Con Supabase local (e2e.yml) el perfume centinela de
 * tests/fixtures/test-db.sql tiene un perfil ficticio; sin base, el catálogo
 * sale vacío y las pruebas que lo necesitan se saltan.
 */

test('suscripción con consentimiento expreso', async ({ page }, testInfo) => {
  await page.goto('/es');
  const section = page.getByRole('region', {
    name: 'Descuentos exclusivos en tu correo',
  });
  await section.scrollIntoViewIfNeeded();
  const email = section.getByRole('textbox', { name: 'Tu email' });
  const consent = section.getByRole('checkbox');
  const submit = section.getByRole('button', { name: 'Suscribirme' });
  await expect(consent).not.toBeChecked();

  await email.fill('no-es-un-email');
  await consent.check();
  await submit.click();
  await expect(section.getByText('Revisa el email')).toBeVisible();

  await email.fill(
    `cliente-${testInfo.project.name}-${Date.now()}@example.com`,
  );
  await consent.uncheck();
  await submit.click();
  await expect(section.getByText('Marca la casilla')).toBeVisible();

  await consent.check();
  await submit.click();
  const done = section.getByText(/Ya formas parte del club|No hemos podido/);
  await expect(done).toBeVisible();
  test.skip(
    (await done.textContent())?.startsWith('No hemos podido') ?? false,
    'Sin Supabase no se guarda el alta',
  );
  await expect(section.getByText('Ya formas parte del club')).toBeVisible();
});

test('el catálogo olfativo no tiene precio ni compra', async ({ page }) => {
  await page.goto('/es/catalogo-olfativo');
  await expect(
    page.getByRole('heading', { level: 1, name: 'El atlas de las fragancias' }),
  ).toBeVisible();
  const main = page.getByRole('main');
  await expect(main).not.toContainText('IVA');
  await expect(main).not.toContainText('€');
  const card = main.getByRole('link', { name: /Perfume centinela/ });
  test.skip((await card.count()) === 0, 'Sin perfumes publicados en esta base');

  // Filtros: invierno lo muestra, verano lo oculta; buscar por nota.
  await main.getByRole('button', { name: 'Invierno' }).click();
  await expect(card).toBeVisible();
  await main.getByRole('button', { name: 'Invierno' }).click();
  await main.getByRole('button', { name: 'Verano' }).click();
  await expect(card).toBeHidden();
  await main.getByRole('button', { name: 'Verano' }).click();
  await main.getByRole('searchbox').fill('bergamota');
  await expect(card).toBeVisible();

  await card.click();
  await expect(page).toHaveURL(/\/es\/catalogo-olfativo\/perfume-centinela$/);
  const pyramid = page.getByRole('region', {
    name: 'Cómo evoluciona en la piel',
  });
  await expect(pyramid.getByText('Bergamota')).toBeVisible();
  await expect(pyramid.getByText('Rosa')).toBeVisible();
  await expect(pyramid.getByText('Ámbar')).toBeVisible();
  await expect(page.getByRole('main')).not.toContainText('IVA');
  await expect(page.getByRole('main')).not.toContainText('€');
});

test('el catálogo olfativo tiene rutas traducidas', async ({ page }) => {
  await page.goto('/ca/cataleg-olfactiu');
  await expect(
    page.getByRole('heading', { level: 1, name: 'L’atles de les fragàncies' }),
  ).toBeVisible();
  await page.goto('/en/scent-catalogue');
  await expect(
    page.getByRole('heading', { level: 1, name: 'An atlas of fragrances' }),
  ).toBeVisible();
  // El pie enlaza el catálogo olfativo desde cualquier página.
  await page.goto('/es');
  await page
    .getByRole('contentinfo')
    .getByRole('link', { name: 'Catálogo olfativo' })
    .click();
  await expect(page).toHaveURL(/\/es\/catalogo-olfativo$/);
});
