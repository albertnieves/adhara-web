import { expect, test } from '@playwright/test';
import {
  admin,
  archiveProduct,
  login,
  psql,
  sellableProduct,
  user,
} from './support';

/*
 * Derechos de las imágenes (DECISIONS §183): una foto oficial de la marca es
 * provisional hasta que el personal con `media.edit` confirma sus derechos, y
 * solo entonces entra en el feed de Google y Meta, con la URL completa aunque
 * se sirva desde la propia web. Un borrador generado nunca se confirma.
 */

const OFFICIAL = '/media/pilot/asad/official_asad-2.jpg';

test('confirmar los derechos lleva la foto oficial al feed y volver a provisional la saca', async ({
  page,
  request,
}) => {
  test.skip(process.env.WEB_CHECKOUT !== '1', 'El feed sale con la venta');
  const product = await sellableProduct(2);
  try {
    psql(
      `insert into public.product_media (product_id, url, alt, role, origin, source, provisional, position)
       select p.id, :'url', 'Foto oficial (prueba)', 'hero', 'brand_official',
              'https://example.invalid/oficial', true, 0
       from public.products p where p.slug = :'slug';
       insert into public.product_media (product_id, url, alt, role, origin, source, provisional, position)
       select p.id, '/media/pilot/yara/official_yara-2.jpg', 'Borrador (prueba)',
              'gallery', 'generated_draft', 'tests/integration/media-rights.spec.ts', true, 1
       from public.products p where p.slug = :'slug';`,
      { url: OFFICIAL, slug: product.slug },
    );
    const { data, error } = await admin
      .from('products')
      .select('id')
      .eq('slug', product.slug)
      .single();
    if (error) throw error;

    const feed = async () => (await request.get('/feeds/productos.xml')).text();
    // Provisional: el perfume no tiene foto que se pueda usar fuera de la web.
    expect(await feed()).not.toContain(product.slug);

    await login(page, await user('store_admin'));
    await page.goto(`/admin/catalogo/${data.id}#imagenes`);
    const official = page
      .getByRole('listitem')
      .filter({ hasText: 'Imagen oficial de la marca' });
    const generated = page
      .getByRole('listitem')
      .filter({ hasText: 'Borrador generado' });
    await expect(official).toContainText('provisional');
    await expect(
      generated.getByRole('button', { name: 'Derechos confirmados' }),
    ).toHaveCount(0);

    page.once('dialog', (dialog) => dialog.accept());
    await official
      .getByRole('button', { name: 'Derechos confirmados' })
      .click();
    await expect(
      page.getByText('Derechos confirmados: la imagen'),
    ).toBeVisible();
    await expect(official).toContainText('derechos confirmados');

    const xml = await feed();
    expect(xml).toContain(`/es/perfume/${product.slug}</g:link>`);
    expect(xml).toContain(
      `<g:image_link>http://localhost:3000${OFFICIAL}</g:image_link>`,
    );
    // El borrador generado no sale nunca.
    expect(xml).not.toContain('official_yara-2.jpg');

    await official
      .getByRole('button', { name: 'Volver a provisional' })
      .click();
    await expect(
      page.getByText('La imagen vuelve a ser provisional.'),
    ).toBeVisible();
    expect(await feed()).not.toContain(product.slug);
  } finally {
    archiveProduct(product);
  }
});
