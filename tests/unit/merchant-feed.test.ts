import { describe, expect, it } from 'vitest';
import {
  merchantFeedItems,
  merchantFeedXml,
} from '../../src/modules/catalog/domain/merchant-feed';
import type {
  ProductMedia,
  StorefrontProduct,
} from '../../src/modules/catalog/domain/product';

/*
 * Feed de productos para Google Merchant Center y Meta (DECISIONS §179): un
 * artículo por formato con PVP, sin datos inventados ni fotos generadas.
 */

function media(over: Partial<ProductMedia>): ProductMedia {
  return {
    url: 'https://x.supabase.co/storage/v1/object/public/product-media/a.jpg',
    alt: null,
    role: 'gallery',
    origin: 'own_photo',
    provisional: false,
    position: 0,
    ...over,
  };
}

function product(over: Partial<StorefrontProduct> = {}): StorefrontProduct {
  return {
    id: 'p1',
    slug: 'asad',
    name: 'Asad',
    brand: { slug: 'lattafa', name: 'Lattafa' },
    concentration: 'EDP',
    audience: 'men',
    featured: false,
    position: 0,
    unboxingScene: null,
    tagline: 'Especiado y ambarado.',
    description: null,
    translatedLocales: [],
    variants: [
      {
        id: 'v100',
        label: null,
        sizeMl: 100,
        priceCents: 3290,
        compareAtCents: null,
        position: 0,
      },
    ],
    media: [
      media({ url: 'https://img/galeria.jpg', position: 1 }),
      media({ url: 'https://img/principal.jpg', role: 'hero', position: 2 }),
    ],
    ...over,
  };
}

const link = (p: StorefrontProduct, variant: string | null) =>
  `https://latelierdudesert.com/es/perfume/${p.slug}${variant ? `?formato=${variant}` : ''}`;

describe('merchantFeedItems', () => {
  it('un artículo por formato con PVP, con título de marca, nombre, tipo y tamaño', () => {
    const [item] = merchantFeedItems([product()], { v100: 'low_stock' }, link);
    expect(item).toEqual({
      id: 'v100',
      groupId: 'asad',
      title: 'Lattafa Asad Eau de Parfum 100 ml',
      description: 'Especiado y ambarado.',
      link: 'https://latelierdudesert.com/es/perfume/asad',
      imageLink: 'https://img/principal.jpg',
      additionalImageLinks: ['https://img/galeria.jpg'],
      availability: 'in_stock',
      price: '32.90 EUR',
      salePrice: null,
      brand: 'Lattafa',
      productType: 'Perfumes > Lattafa',
    });
  });

  it('con varios formatos, cada uno enlaza el suyo; sin precio, fuera', () => {
    const items = merchantFeedItems(
      [
        product({
          variants: [
            {
              id: 'v30',
              label: null,
              sizeMl: 30,
              priceCents: 1990,
              compareAtCents: null,
              position: 0,
            },
            {
              id: 'v100',
              label: 'Frasco 100 ml',
              sizeMl: 100,
              priceCents: 3290,
              compareAtCents: 3990,
              position: 1,
            },
            {
              id: 'sin-precio',
              label: null,
              sizeMl: 50,
              priceCents: null,
              compareAtCents: null,
              position: 2,
            },
          ],
        }),
      ],
      { v30: 'out_of_stock' },
      link,
    );
    expect(items.map((item) => [item.id, item.link])).toEqual([
      ['v30', 'https://latelierdudesert.com/es/perfume/asad?formato=v30'],
      ['v100', 'https://latelierdudesert.com/es/perfume/asad?formato=v100'],
    ]);
    // Agotado o sin dato: fuera de stock. Con rebaja: precio anterior y de oferta.
    expect(items[0]!.availability).toBe('out_of_stock');
    expect(items[1]!.availability).toBe('out_of_stock');
    expect(items[1]).toMatchObject({
      title: 'Lattafa Asad Eau de Parfum Frasco 100 ml',
      price: '39.90 EUR',
      salePrice: '32.90 EUR',
    });
  });

  it('sin foto con derechos no entra; las generadas o provisionales no se usan', () => {
    expect(
      merchantFeedItems(
        [
          product({
            media: [
              media({ origin: 'generated_draft', role: 'hero' }),
              media({ provisional: true }),
            ],
          }),
        ],
        {},
        link,
      ),
    ).toEqual([]);
    const [item] = merchantFeedItems(
      [
        product({
          media: [
            media({
              url: 'https://img/ia.jpg',
              origin: 'generated_draft',
              role: 'hero',
            }),
            media({
              url: 'https://img/marca.jpg',
              origin: 'brand_official',
              position: 3,
            }),
          ],
        }),
      ],
      {},
      link,
    );
    expect(item!.imageLink).toBe('https://img/marca.jpg');
    expect(item!.additionalImageLinks).toEqual([]);
  });

  it('sin frase ni descripción, la descripción es el título (nada inventado)', () => {
    const [item] = merchantFeedItems(
      [product({ tagline: null, description: null, concentration: 'OTHER' })],
      {},
      link,
    );
    expect(item!.title).toBe('Lattafa Asad 100 ml');
    expect(item!.description).toBe('Lattafa Asad 100 ml');
  });
});

describe('merchantFeedXml', () => {
  it('RSS 2.0 con el espacio de nombres de Google y el texto escapado', () => {
    const [item] = merchantFeedItems(
      [product({ name: 'Oud & <Rosa>', tagline: 'Dulce "y" seco' })],
      { v100: 'in_stock' },
      link,
    );
    const xml = merchantFeedXml([item!], {
      title: 'L’Atelier du Désert',
      link: 'https://latelierdudesert.com/es',
      description: 'Perfumería',
    });
    expect(xml).toMatch(
      /^<\?xml version="1.0" encoding="UTF-8"\?>\n<rss version="2.0" xmlns:g="http:\/\/base.google.com\/ns\/1.0">/,
    );
    expect(xml).toContain(
      '<g:title>Lattafa Oud &amp; &lt;Rosa&gt; Eau de Parfum 100 ml</g:title>',
    );
    expect(xml).toContain(
      '<g:description>Dulce &quot;y&quot; seco</g:description>',
    );
    expect(xml).toContain('<g:price>32.90 EUR</g:price>');
    expect(xml).toContain(
      '<g:google_product_category>479</g:google_product_category>',
    );
    expect(xml).toContain('<g:condition>new</g:condition>');
    expect(xml).not.toContain('g:sale_price');
    expect(xml).not.toMatch(/gtin|mpn|identifier_exists|review|rating/i);
  });
});
