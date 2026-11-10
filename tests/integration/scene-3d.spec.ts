import { expect, test, type Page } from '@playwright/test';
import { archiveProduct, psql, sellableProduct } from './support';

/*
 * Escena 3D bajo demanda (DECISIONS §190): la ficha abre con la foto y no
 * descarga three.js hasta pulsar «Abrir la caja en 3D». Sin WebGL, o si se
 * vuelve a las fotos, la compra sigue igual.
 */

async function withScene() {
  const product = await sellableProduct(1);
  psql(
    `update public.products set unboxing_scene = 'asad' where slug = :'slug';
     insert into public.product_media (product_id, url, alt, role, origin, source, provisional, position)
     select p.id, '/media/pilot/asad/official_asad-2.jpg', 'Foto de prueba', 'hero',
            'brand_official', 'tests/integration/scene-3d.spec.ts', true, 0
     from public.products p where p.slug = :'slug';`,
    { slug: product.slug },
  );
  return product;
}

/** Trozos de JavaScript con three.js descargados por la página. */
function watchThree(page: Page) {
  const pending: Promise<string | null>[] = [];
  page.on('response', (response) => {
    if (!response.url().endsWith('.js')) return;
    pending.push(
      response
        .text()
        .then((body) =>
          body.includes('WebGLRenderer') ? response.url() : null,
        )
        .catch(() => null),
    );
  });
  return async () =>
    (await Promise.all(pending)).filter((url): url is string => url !== null);
}

async function hasWebGL(page: Page) {
  return page.evaluate(() => {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  });
}

test('la ficha abre con la foto y three.js llega solo al pulsar «Abrir la caja en 3D»', async ({
  page,
}) => {
  const product = await withScene();
  try {
    const three = watchThree(page);
    await page.goto(`/es/perfume/${product.slug}`);
    await expect(
      page.getByRole('img', { name: /Foto de prueba|Perfume pedidos/ }).first(),
    ).toBeVisible();
    test.skip(!(await hasWebGL(page)), 'Este navegador no tiene WebGL');

    const open = page.getByRole('button', { name: 'Abrir la caja en 3D' });
    await expect(open).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(await three()).toEqual([]);

    await open.click();
    await expect(
      page.getByRole('img', { name: `Animación 3D de ${product.name}` }),
    ).toBeVisible({ timeout: 20000 });
    expect((await three()).length).toBeGreaterThan(0);

    // El foco pasa a «Ver las fotos» y, al volver, al botón que la abrió.
    const close = page.getByRole('button', { name: 'Ver las fotos' });
    await expect(close).toBeFocused();
    await close.click();
    await expect(open).toBeFocused();
    await expect(
      page.getByRole('img', { name: `Animación 3D de ${product.name}` }),
    ).toHaveCount(0);
  } finally {
    archiveProduct(product);
  }
});

test('con movimiento reducido, la escena abre ya en su final y sin WebGL solo hay fotos', async ({
  page,
}) => {
  const product = await withScene();
  try {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`/es/perfume/${product.slug}`);
    test.skip(!(await hasWebGL(page)), 'Este navegador no tiene WebGL');
    await page.getByRole('button', { name: 'Abrir la caja en 3D' }).click();
    // «Repetir» solo aparece al final de la coreografía (S5).
    await expect(page.getByRole('button', { name: 'Repetir' })).toBeVisible({
      timeout: 20000,
    });

    // ?nowebgl simula un navegador sin WebGL: ni botón ni escena.
    await page.goto(`/es/perfume/${product.slug}?nowebgl`);
    // El botón aparecería al hidratar: se espera a que la página esté quieta.
    await page.waitForLoadState('networkidle');
    await expect(
      page.getByRole('button', { name: 'Abrir la caja en 3D' }),
    ).toHaveCount(0);
  } finally {
    await page.emulateMedia({ reducedMotion: null });
    archiveProduct(product);
  }
});
