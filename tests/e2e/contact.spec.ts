import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';

/*
 * Formulario de contacto (A6.1). Solo existe con CONTACT_FORM=1 (e2e.yml);
 * sin él, la página responde 404 y el pie no la enlaza. El recorrido con el
 * panel y el correo entrante está en tests/integration/messages.spec.ts.
 */

const enabled = process.env.CONTACT_FORM === '1';

test.describe('con el formulario encendido', () => {
  test.skip(!enabled, 'CONTACT_FORM apagado');

  test('el pie lleva al formulario en los tres idiomas', async ({ page }) => {
    for (const [locale, link, path, heading] of [
      ['es', 'Escríbenos', '/es/contacto', 'Contacto'],
      ['ca', 'Escriu-nos', '/ca/contacte', 'Contacte'],
      ['en', 'Write to us', '/en/contact', 'Contact'],
    ] as const) {
      await page.goto(`/${locale}`);
      await page
        .getByRole('contentinfo')
        .getByRole('link', { name: link })
        .click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(
        page.getByRole('heading', { level: 1, name: heading }),
      ).toBeVisible();
    }
  });

  test('marca los campos que faltan sin enviar nada', async ({ page }) => {
    await page.goto('/es/contacto');
    await page.getByRole('button', { name: 'Enviar mensaje' }).click();
    await expect(page.getByText('Revisa los campos marcados.')).toBeVisible();
    await expect(page.getByText('Escribe tu nombre.')).toBeVisible();
    await expect(
      page.getByText('Revisa el email: no parece válido.'),
    ).toBeVisible();
    await expect(page.getByText('Escribe tu mensaje.')).toBeVisible();
    await expect(page.getByLabel('Nombre', { exact: true })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    // El número de pedido solo se pide si la consulta es sobre un pedido.
    await expect(page.getByLabel('Número de pedido (opcional)')).toBeVisible();
    await page.getByRole('radio', { name: 'Un perfume' }).check();
    await expect(page.getByLabel('Número de pedido (opcional)')).toHaveCount(0);
  });

  test('envía una consulta y da su número', async ({ page }) => {
    await page.goto('/en/contact');
    await page.getByRole('radio', { name: 'A fragrance' }).check();
    await page.getByLabel('Name', { exact: true }).fill('Visitor');
    await page
      .getByLabel('Email', { exact: true })
      .fill(`visitor-${randomUUID().slice(0, 8)}@test.invalid`);
    await page
      .getByLabel('Message', { exact: true })
      .fill('Do you have Khamrah in 100 ml?');
    await page.getByRole('button', { name: 'Send message' }).click();
    const done = page
      .getByRole('status')
      .filter({ hasText: 'Message received' });
    await expect(done).toBeVisible();
    await expect(done).toContainText(/Your enquiry is no\. \d{4,}/);
    await done.getByRole('button', { name: 'Send another message' }).click();
    await expect(page.getByLabel('Message', { exact: true })).toHaveValue('');
  });
});

test.describe('con el formulario apagado', () => {
  test.skip(enabled, 'CONTACT_FORM encendido');

  test('la página no existe y el pie no la enlaza', async ({ page }) => {
    const response = await page.goto('/es/contacto');
    expect(response?.status()).toBe(404);
    await page.goto('/es');
    await expect(
      page.getByRole('contentinfo').getByRole('link', { name: 'Escríbenos' }),
    ).toHaveCount(0);
  });
});

test('el correo entrante no procesa nada sin su configuración', async ({
  request,
}) => {
  const response = await request.post('/api/correo/entrante', {
    data: { type: 'email.received', data: { email_id: 'x' } },
  });
  expect(response.status()).toBe(503);
});
