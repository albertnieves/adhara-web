import { existsSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  GENERATED_PRODUCT_SLUGS,
  withGeneratedProductImage,
} from '@/modules/catalog/domain/generated-product-images';
import { heroMedia, type StorefrontProduct } from '@/modules/catalog';
import { productStructuredData } from '@/modules/catalog/domain/structured-data';
import { merchantFeedItems } from '@/modules/catalog/domain/merchant-feed';

const product: StorefrontProduct = {
  id: 'p',
  slug: 'asad-bourbon',
  name: 'Asad Bourbon',
  brand: { slug: 'lattafa', name: 'Lattafa' },
  concentration: 'EDP',
  audience: null,
  featured: false,
  position: 0,
  unboxingScene: null,
  tagline: null,
  description: null,
  translatedLocales: [],
  variants: [
    {
      id: 'v',
      label: null,
      sizeMl: 100,
      priceCents: 1000,
      compareAtCents: null,
      position: 0,
    },
  ],
  media: [
    {
      url: 'https://example.invalid/original.webp',
      alt: 'Original',
      role: 'hero',
      origin: 'brand_official',
      provisional: false,
      position: 0,
    },
  ],
};

describe('imágenes generadas de la PR #59', () => {
  it('cada asociación tiene su WebP público y no hay archivos sin asociar', () => {
    const root = 'public/media/generated-products';
    const files = readdirSync(root).flatMap((directory) =>
      readdirSync(`${root}/${directory}`).map((file) => `${directory}/${file}`),
    );
    const urls = GENERATED_PRODUCT_SLUGS.map(
      (slug) => heroMedia(withGeneratedProductImage({ ...product, slug }))?.url,
    );
    expect(urls.sort()).toEqual(
      files.map((file) => `/media/generated-products/${file}`).sort(),
    );
    expect(
      existsSync('assets/generated-products/2026-11-02/miss-sakura.webp'),
    ).toBe(true);
  });

  it('añade la recreación como principal sin perder originales ni cambiar datos comerciales', () => {
    const result = withGeneratedProductImage(product);
    expect(heroMedia(result)).toMatchObject({
      origin: 'generated_draft',
      provisional: true,
      url: '/media/generated-products/2026-11-02/asad-bourbon.webp',
    });
    expect(result.media.slice(1)).toEqual(product.media);
    expect({ ...result, media: [] }).toEqual({ ...product, media: [] });
    expect(product.media).toHaveLength(1);
    expect(withGeneratedProductImage(result)).toBe(result);
  });

  it('no asigna imágenes a Miss Sakura ni a un perfume fuera de la selección', () => {
    for (const slug of ['miss-sakura', 'perfume-desconocido', 'toString']) {
      const other = { ...product, slug };
      expect(withGeneratedProductImage(other)).toBe(other);
    }
  });

  it('respeta la foto propia principal elegida desde el panel', () => {
    const own = { ...product.media[0]!, origin: 'own_photo' as const };
    const result = withGeneratedProductImage({ ...product, media: [own] });
    expect(heroMedia(result)).toEqual(own);
    expect(result.media[0]).toEqual(own);
    expect(result.media[1]).toMatchObject({
      origin: 'generated_draft',
      role: 'gallery',
    });
  });

  it('puede ilustrar un producto existente sin fotografías sin inventar otros datos', () => {
    const result = withGeneratedProductImage({ ...product, media: [] });
    expect(result.media).toHaveLength(1);
    expect(result.variants).toBe(product.variants);
    expect(
      productStructuredData(result, 'https://example.invalid/perfume'),
    ).not.toHaveProperty('image');
  });

  it('conserva las fotos originales para datos estructurados y anuncios', () => {
    const result = withGeneratedProductImage(product);
    expect(
      productStructuredData(result, 'https://example.invalid/perfume').image,
    ).toEqual([product.media[0]!.url]);
    const items = merchantFeedItems(
      [result],
      { v: 'in_stock' },
      () => 'https://example.invalid/perfume',
      'https://example.invalid',
    );
    expect(items[0]!.imageLink).toBe(product.media[0]!.url);
    expect(items[0]!.additionalImageLinks).toEqual([]);
  });
});
