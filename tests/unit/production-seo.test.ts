import { afterEach, describe, expect, it, vi } from 'vitest';
import { indexingEnabled } from '@/modules/i18n/indexing';
import {
  productStructuredData,
  serializeJsonLd,
} from '@/modules/catalog/domain/structured-data';
import type { StorefrontProduct } from '@/modules/catalog/domain/product';

const listProducts = vi.hoisted(() => vi.fn());
vi.mock('@/modules/catalog/server', () => ({
  listSitemapProducts: listProducts,
}));
import sitemap from '@/app/sitemap';
import robots from '@/app/robots';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
const production = {
  SEO_INDEXING: '1',
  VERCEL_ENV: 'production',
  NEXT_PUBLIC_SITE_URL: 'https://latelierdudesert.com',
};

describe('apertura a buscadores', () => {
  it('exige consentimiento explícito, producción y dominio canónico', () => {
    expect(indexingEnabled(production)).toBe(true);
    for (const override of [
      { SEO_INDEXING: undefined },
      { VERCEL_ENV: 'preview' },
      { VERCEL_ENV: undefined },
      { NEXT_PUBLIC_SITE_URL: 'https://preview.vercel.app' },
      { NEXT_PUBLIC_SITE_URL: 'http://latelierdudesert.com' },
      { NEXT_PUBLIC_SITE_URL: 'invalid' },
    ]) {
      expect(indexingEnabled({ ...production, ...override })).toBe(false);
    }
  });
  it('no consulta productos ni anuncia sitemap cuando está desactivada', async () => {
    vi.stubEnv('SEO_INDEXING', '');
    expect(await sitemap()).toEqual([]);
    expect(listProducts).not.toHaveBeenCalled();
    expect(robots()).toEqual({ rules: { userAgent: '*', disallow: '/' } });
  });
  it('genera URLs traducidas solo para contenido publicado y excluye operaciones', async () => {
    for (const [key, value] of Object.entries(production))
      vi.stubEnv(key, value);
    listProducts.mockResolvedValue([
      {
        slug: 'perfume-de-prueba',
        brand: { slug: 'marca-de-prueba' },
        translations: [
          { locale: 'ca', tagline: 'Text', description: null },
          { locale: 'en', tagline: null, description: null },
        ],
      },
    ]);
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);
    expect(urls).toContain('https://latelierdudesert.com/ca/cataleg');
    expect(urls).toContain(
      'https://latelierdudesert.com/ca/perfum/perfume-de-prueba',
    );
    expect(urls).not.toContain(
      'https://latelierdudesert.com/en/fragrance/perfume-de-prueba',
    );
    // Las casas con algún perfume publicado, en los tres idiomas.
    expect(urls).toEqual(
      expect.arrayContaining([
        'https://latelierdudesert.com/es/casas',
        'https://latelierdudesert.com/ca/cases',
        'https://latelierdudesert.com/en/houses',
        'https://latelierdudesert.com/es/casas/marca-de-prueba',
        'https://latelierdudesert.com/ca/cases/marca-de-prueba',
        'https://latelierdudesert.com/en/houses/marca-de-prueba',
      ]),
    );
    expect(urls.filter((url) => url.includes('marca-de-prueba'))).toHaveLength(
      3,
    );
    expect(
      urls.some((url) => /admin|checkout|cesta|pedido|auth/.test(url)),
    ).toBe(false);
    expect(entries.at(-1)?.alternates?.languages).toEqual({
      es: 'https://latelierdudesert.com/es/perfume/perfume-de-prueba',
      ca: 'https://latelierdudesert.com/ca/perfum/perfume-de-prueba',
      'x-default': 'https://latelierdudesert.com/es/perfume/perfume-de-prueba',
    });
    expect(robots().sitemap).toBe('https://latelierdudesert.com/sitemap.xml');
  });
});

describe('datos estructurados públicos', () => {
  it('publica ofertas solo con venta activa y precios válidos del catálogo', () => {
    const product = {
      name: 'Prueba',
      brand: { name: 'Marca' },
      media: [],
      variants: [
        { id: 'a', sizeMl: 100, priceCents: 2999 },
        { id: 'b', sizeMl: 50, priceCents: null },
        { id: 'c', sizeMl: 20, priceCents: 0 },
      ],
    } as unknown as StorefrontProduct;
    expect(
      productStructuredData(product, 'https://example.com', {
        enabled: false,
        availability: {},
      }),
    ).not.toHaveProperty('offers');
    expect(
      productStructuredData(product, 'https://example.com', {
        enabled: true,
        availability: { a: 'out_of_stock' },
      }).offers,
    ).toEqual([
      {
        '@type': 'Offer',
        url: 'https://example.com',
        name: 'Prueba · 100 ml',
        priceCurrency: 'EUR',
        price: '29.99',
        availability: 'https://schema.org/OutOfStock',
      },
    ]);
  });
  it('escapa texto editorial y selecciona solo propiedades públicas', () => {
    const product = {
      name: '</script><script>alert(1)</script>',
      brand: { name: 'Marca de prueba' },
      description: null,
      tagline: null,
      media: [],
      cost: 987654,
    } as unknown as StorefrontProduct;
    const data = productStructuredData(
      product,
      'https://latelierdudesert.com/es/perfume/test',
    );
    const json = serializeJsonLd(data);
    expect(json).not.toContain('<');
    expect(json).not.toContain('987654');
    expect(JSON.parse(json).name).toBe(product.name);
    expect(data).not.toHaveProperty('aggregateRating');
    expect(data).not.toHaveProperty('offers');
  });
});
