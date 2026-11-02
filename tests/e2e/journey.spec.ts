import { expect, test } from '@playwright/test';

/*
 * Recorrido olfativo (roadmap 6, DECISIONS §182): tres preguntas y
 * propuestas explicadas a partir de las fichas olfativas. Las que buscan
 * datos usan el perfume centinela de tests/fixtures/test-db.sql (floral,
 * invierno, noche; bergamota, rosa y ámbar).
 */

const SENTINEL = Boolean(process.env.ADHARA_COST_SENTINEL);

test('existe en los tres idiomas y se llega desde el catálogo olfativo', async ({
  page,
}) => {
  await page.goto('/es/catalogo-olfativo');
  await page
    .getByRole('link', {
      name: '¿No sabes por dónde empezar? Haz el recorrido olfativo',
    })
    .click();
  await expect(page).toHaveURL(/\/es\/recorrido-olfativo$/);
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Tu perfume en tres preguntas',
    }),
  ).toBeVisible();
  for (const [path, heading] of [
    ['/ca/recorregut-olfactiu', 'El teu perfum en tres preguntes'],
    ['/en/scent-journey', 'Your fragrance in three questions'],
  ] as const) {
    expect((await page.goto(path))!.status()).toBe(200);
    await expect(
      page.getByRole('heading', { level: 1, name: heading }),
    ).toBeVisible();
  }
});

test('propone con su porqué, guarda las respuestas y respeta lo que se evita', async ({
  page,
}) => {
  test.skip(!SENTINEL, 'Solo con tests/fixtures/test-db.sql (e2e.yml)');
  await page.goto('/es/recorrido-olfativo');
  const results = page.getByRole('region', { name: 'Te proponemos' });
  await expect(results.getByRole('status')).toHaveText(
    /Elige al menos una familia/,
  );

  await page.getByRole('button', { name: 'Floral', exact: true }).click();
  await page.getByRole('button', { name: 'Noche', exact: true }).click();
  await expect(page).toHaveURL(
    /\/es\/recorrido-olfativo\?familias=floral&momento=night$/,
  );
  const item = results.getByRole('listitem').filter({
    hasText: 'Perfume centinela (prueba)',
  });
  await expect(item).toBeVisible();
  await expect(item.getByText('Coincide en: Floral · Noche')).toBeVisible();
  await expect(
    item.getByRole('link', { name: 'Fuente de las notas' }),
  ).toHaveAttribute('href', /^https:\/\/example\.invalid\//);

  // Al recargar, las respuestas siguen ahí.
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Floral', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(item).toBeVisible();

  // Evitar una de sus notas lo descarta.
  await page
    .getByRole('group', { name: '3. ¿Alguna nota?' })
    .getByRole('button', { name: 'Rosa', exact: true })
    .last()
    .click();
  await expect(item).toHaveCount(0);

  await page.getByRole('button', { name: 'Empezar de nuevo' }).click();
  await expect(page).toHaveURL(/\/es\/recorrido-olfativo$/);
});

test('sin infracciones de accesibilidad', async ({ page }) => {
  // Sin la animación de entrada: a medio aparecer, el texto aún no tiene su
  // contraste final (como en la auditoría de diseño).
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/es/recorrido-olfativo?familias=floral');
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Tu perfume en tres preguntas',
    }),
  ).toBeVisible();
  // Entradas terminadas: axe mide el color final, no uno a medio fundir.
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every(
        (a) =>
          a.playState !== 'running' ||
          a.effect?.getComputedTiming().iterations === Infinity,
      ),
  );
  await page.waitForFunction(() =>
    [...document.querySelectorAll<HTMLElement>('main *')].every(
      (el) =>
        getComputedStyle(el).opacity === '1' || el.closest('[aria-hidden]'),
    ),
  );
  const { default: AxeBuilder } = await import('@axe-core/playwright');
  const results = await new AxeBuilder({ page })
    .include('main')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});
