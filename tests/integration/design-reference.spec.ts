import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { AXE_TAGS } from '../support/layout-audit';
import { login, user } from './support';

/*
 * Página de referencia del sistema de diseño (Fase 2, DS-03): la ve todo el
 * personal con sesión (D6), aquí con el rol con menos permisos. Comprueba que
 * salen todos los tokens con valor, que el contraste calculado en el navegador
 * cumple en los cinco tonos y que axe no encuentra infracciones.
 */

test('referencia del sistema de diseño con sesión de encargado', async ({
  page,
}) => {
  test.setTimeout(3 * 60_000);
  await login(page, await user('viewer'));

  // Enlace en el pie del menú, fuera de las secciones de trabajo.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('link', { name: 'Sistema de diseño' }).click();
  await expect(page).toHaveURL(/\/admin\/diseno$/);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Sistema de diseño' }),
  ).toBeVisible();

  const response = await page.reload();
  expect(response?.status()).toBe(200);
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);

  // Todos los tokens tienen valor en el CSS compilado.
  await expect(page.getByText('sin valor', { exact: true })).toHaveCount(0);
  for (const variable of [
    '--color-surface',
    '--color-indigo-night',
    '--text-2xs',
    '--tracking-caps-lg',
    '--radius-hairline',
    '--duration-slow',
    '--z-toast',
  ])
    await expect(
      page.getByText(variable, { exact: true }).first(),
    ).toBeVisible();

  // Contraste calculado en cada tono: todas las combinaciones cumplen.
  for (const tone of ['Claro', 'Oscuro', 'Oud', 'Índigo', 'Bosque']) {
    const region = page.getByRole('region', { name: tone, exact: true });
    const summary = await region.getByText(/^Cumplen \d+ de \d+/).innerText();
    const [, passing, total] = summary.match(/Cumplen (\d+) de (\d+)/)!;
    expect(Number(total)).toBeGreaterThan(0);
    expect(passing, `${tone}: ${summary}`).toBe(total);
    await expect(region.getByText('No cumple')).toHaveCount(0);
  }

  // Componentes tipográficos (DS-04) en su sección.
  for (const name of ['Heading', 'Text', 'Eyebrow'])
    await expect(
      page.getByRole('heading', { level: 3, name, exact: true }),
    ).toBeVisible();

  // La demostración de movimiento se maneja con el teclado.
  const play = page.getByRole('button', { name: 'Reproducir' });
  await play.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Volver' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  // En móvil el enlace va en el pie del menú deslizante.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Menú' }).click();
  await expect(
    page.getByRole('dialog').getByRole('link', { name: 'Sistema de diseño' }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(
      results.violations.map((v) => `${v.id}: ${v.nodes.length}`),
      `axe a ${width} px`,
    ).toEqual([]);
  }
});
