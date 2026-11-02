import { describe, expect, it } from 'vitest';
import type { StorefrontProduct } from '../../src/modules/catalog/domain/product';
import type {
  ScentFamily,
  ScentProfile,
} from '../../src/modules/catalog/domain/scent';
import {
  SCENT_FAMILIES,
  SCENT_FAMILY_NAMES,
} from '../../src/modules/catalog/domain/scent';
import {
  searchCatalog,
  searchTerms,
} from '../../src/modules/catalog/domain/search';
import type { SearchDocument } from '../../src/modules/catalog/domain/search';

/*
 * Búsqueda de la tienda (roadmap 5, DECISIONS §181): perfumes por nombre,
 * casa, familia o nota, sin tildes ni mayúsculas, con todas las palabras.
 */

function product(slug: string, name: string, brand: string): StorefrontProduct {
  return {
    id: slug,
    slug,
    name,
    brand: { slug: brand.toLowerCase().replace(/\s+/g, '-'), name: brand },
    concentration: 'EDP',
    audience: null,
    featured: false,
    position: 0,
    unboxingScene: null,
    tagline: null,
    description: null,
    translatedLocales: [],
    variants: [],
    media: [],
  };
}

function profile(over: Partial<ScentProfile>): ScentProfile {
  return {
    top: [],
    heart: [],
    base: [],
    key: [],
    families: [],
    seasons: [],
    times: [],
    sourceUrl: 'https://example.invalid',
    ...over,
  };
}

const DOCS: SearchDocument[] = [
  {
    product: product('asad', 'Asad', 'Lattafa'),
    profile: profile({
      top: ['black-pepper'],
      base: ['vanilla'],
      families: ['spicy', 'amber'],
    }),
  },
  {
    product: product('yara', 'Yara', 'Lattafa'),
    profile: profile({ heart: ['rose'], families: ['floral'] }),
  },
  {
    product: product('rose-oud', 'Rose Oud', 'Ard Al Zaafaran'),
    profile: null,
  },
  { product: product('khamrah', 'Khamrah', 'Lattafa'), profile: null },
];

/** Etiquetas en español (las de la tienda en `es` y las del panel). */
const LABELS = Object.fromEntries(
  SCENT_FAMILIES.map((family) => [family, [SCENT_FAMILY_NAMES[family]]]),
) as Record<ScentFamily, string[]>;

const slugs = (query: string) =>
  searchCatalog(DOCS, query, LABELS).products.map((p) => p.slug);

describe('searchTerms', () => {
  it('sin tildes, mayúsculas ni palabras de una letra', () => {
    expect(searchTerms('  Ámbar  y  ROSA, a ')).toEqual(['ambar', 'rosa']);
    expect(searchTerms('a')).toEqual([]);
  });
});

describe('searchCatalog', () => {
  it('sin palabras no busca', () => {
    expect(searchCatalog(DOCS, ' ', LABELS)).toEqual({
      products: [],
      brands: [],
      families: [],
    });
  });

  it('por nombre, primero lo que empieza así', () => {
    expect(slugs('rose')).toEqual(['rose-oud', 'yara']);
    expect(slugs('yara')).toEqual(['yara']);
  });

  it('por casa, con la casa como resultado propio', () => {
    const result = searchCatalog(DOCS, 'lattafa', LABELS);
    expect(result.products.map((p) => p.slug)).toEqual([
      'asad',
      'yara',
      'khamrah',
    ]);
    expect(result.brands).toEqual([
      { slug: 'lattafa', name: 'Lattafa', count: 3 },
    ]);
  });

  it('por nota en cualquiera de los tres idiomas y por familia', () => {
    expect(slugs('vainilla')).toEqual(['asad']);
    expect(slugs('vanilla')).toEqual(['asad']);
    expect(slugs('especiada')).toEqual(['asad']);
    const floral = searchCatalog(DOCS, 'floral', LABELS);
    expect(floral.products.map((p) => p.slug)).toEqual(['yara']);
    expect(floral.families).toEqual([{ family: 'floral', count: 1 }]);
  });

  it('todas las palabras tienen que estar en el perfume', () => {
    expect(slugs('lattafa vainilla')).toEqual(['asad']);
    expect(slugs('lattafa oud')).toEqual([]);
    expect(slugs('zzzz')).toEqual([]);
  });
});
