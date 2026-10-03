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
  await expect(page.locator('[aria-busy="true"]:not(button)')).toHaveCount(0);

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

test('acciones: teclado en la página de referencia (DS-06)', async ({
  page,
}) => {
  test.setTimeout(2 * 60_000);
  await login(page, await user('viewer'));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/admin/diseno#acciones');
  await expect(page.locator('[aria-busy="true"]:not(button)')).toHaveCount(0);

  // Intro y Espacio activan.
  const press = page.getByRole('button', { name: 'Pulsar', exact: true });
  await press.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Pulsado 1 vez')).toBeVisible();
  await page.keyboard.press('Space');
  await expect(page.getByText('Pulsado 2 veces')).toBeVisible();

  // El deshabilitado no recibe el foco: Tab salta al siguiente.
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('button', { name: 'Simular guardado' }),
  ).toBeFocused();

  // Foco visible de 2 px (criterio 5).
  const outline = await page.evaluate(() => {
    const style = getComputedStyle(document.activeElement!);
    return `${style.outlineStyle} ${style.outlineWidth}`;
  });
  expect(outline).toBe('solid 2px');

  // Cargando: no responde mientras dura.
  await page.keyboard.press('Enter');
  const saving = page.getByRole('button', { name: 'Guardando…' });
  await expect(saving).toBeDisabled();
  await expect(saving).toHaveAttribute('aria-busy', 'true');

  // Un enlace con aspecto de botón se sigue con Intro.
  await page.getByRole('link', { name: 'Ir a acciones' }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#acciones$/);
});

test('formularios: teclado y errores en la página de referencia (DS-07)', async ({
  page,
}) => {
  test.setTimeout(2 * 60_000);
  await login(page, await user('viewer'));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/admin/diseno#formularios');
  await expect(page.locator('[aria-busy="true"]:not(button)')).toHaveCount(0);

  // La etiqueta nombra el control; la ayuda y el error lo describen.
  await expect(
    page.getByLabel('Nombre', { exact: true }),
  ).toHaveAccessibleDescription('Como figura en el pedido.');
  const mail = page.getByLabel('Correo', { exact: true });
  await expect(mail).toHaveAttribute('aria-invalid', 'true');
  await expect(mail).toHaveAccessibleDescription(
    'Escribe un correo con @ y dominio.',
  );

  // Tab salta el deshabilitado; el de solo lectura se enfoca y no se edita.
  await mail.focus();
  await page.keyboard.press('Tab');
  const created = page.getByLabel('Creado', { exact: true });
  await expect(created).toBeFocused();
  await expect(created).not.toBeEditable();
  const outline = await page.evaluate(() => {
    const style = getComputedStyle(document.activeElement!);
    return `${style.outlineStyle} ${style.outlineWidth}`;
  });
  expect(outline).toBe('solid 2px');

  // Espacio marca la casilla.
  const notify = page.getByRole('checkbox', { name: 'Avisarme por correo' });
  await notify.focus();
  await page.keyboard.press('Space');
  await expect(notify).toBeChecked();

  // Las flechas cambian la elección del grupo y saltan la deshabilitada.
  await expect(page.getByRole('group', { name: 'Vista' })).toBeVisible();
  await page.getByRole('radio', { name: 'Tabla' }).focus();
  await page.keyboard.press('ArrowDown');
  const cards = page.getByRole('radio', { name: 'Tarjetas' });
  await expect(cards).toBeChecked();
  await expect(cards).toBeFocused();

  // Prueba: al validar vacío, errores y foco en el primero que falla.
  const form = page.getByRole('form', { name: 'Formulario de prueba' });
  const email = form.getByLabel('Correo electrónico');
  await form.getByRole('button', { name: 'Validar' }).focus();
  await page.keyboard.press('Enter');
  await expect(email).toBeFocused();
  await expect(email).toHaveAttribute('aria-invalid', 'true');
  await expect(email).toHaveAccessibleDescription(
    /^Escribe un correo con @ y dominio\.\s*Solo para esta prueba/,
  );

  // Se corrige con el teclado y vuelve a validar.
  await page.keyboard.type('equipo@example.com');
  await page.keyboard.press('Tab');
  const terms = form.getByRole('checkbox', {
    name: 'He leído las condiciones de prueba',
  });
  await expect(terms).toBeFocused();
  await expect(terms).toHaveAttribute('aria-invalid', 'true');
  await page.keyboard.press('Space');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(form.getByText('Formulario válido.')).toBeVisible();
  await expect(email).not.toHaveAttribute('aria-invalid', 'true');
});
