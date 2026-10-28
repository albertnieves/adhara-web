import type { CatalogSnapshot } from '../../scripts/preview-catalog.ts';
import { PRODUCTION_SUPABASE_REF } from '../../scripts/check-deployment-environment.ts';

/** Catálogo ficticio exclusivo de pruebas del importador; no es un perfume real. */
export function previewCatalogFixture(): CatalogSnapshot {
  const brand = '00000000-0000-4000-8000-00000000cf01';
  const product = '00000000-0000-4000-8000-00000000cf02';
  return {
    format: 'atelier-public-catalog-v1',
    sourceRef: PRODUCTION_SUPABASE_REF,
    exportedAt: '2026-10-28T12:00:00.000Z',
    tables: {
      brands: [{ id: brand, slug: 'fixture-catalogo', name: 'Marca ficticia' }],
      products: [
        {
          id: product,
          brand_id: brand,
          slug: 'fixture-catalogo',
          name: 'Perfume ficticio',
          concentration: 'EDP',
          audience: 'unisex',
          status: 'published',
          featured: false,
          position: 0,
          unboxing_scene: null,
        },
      ],
      product_variants: [
        {
          id: '00000000-0000-4000-8000-00000000cf03',
          product_id: product,
          sku: null,
          ean: null,
          size_ml: 100,
          label: null,
          retail_price_cents: 4990,
          compare_at_price_cents: 5990,
          active: true,
          position: 0,
          shipping_weight_g: 300,
        },
      ],
      product_translations: [
        {
          product_id: product,
          locale: 'es',
          tagline: 'Solo pruebas',
          description: null,
        },
      ],
      product_media: [],
      product_scent_profiles: [],
    },
    assets: [],
  };
}
