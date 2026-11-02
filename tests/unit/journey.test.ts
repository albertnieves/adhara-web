import { describe, expect, it } from 'vitest';
import {
  answersFromSearch,
  answersToSearch,
  journeyOptions,
  NO_ANSWERS,
  recommend,
} from '../../src/modules/catalog/domain/journey';
import type { JourneyDocument } from '../../src/modules/catalog/domain/journey';
import type { StorefrontProduct } from '../../src/modules/catalog/domain/product';
import type { ScentProfile } from '../../src/modules/catalog/domain/scent';

/*
 * Recorrido olfativo (roadmap 6, DECISIONS §182): propuestas reproducibles y
 * explicadas a partir de los perfiles con fuente, nunca de perfumes sin él.
 */

function product(slug: string): StorefrontProduct {
  return {
    id: slug,
    slug,
    name: slug,
    brand: { slug: 'casa', name: 'Casa' },
    concentration: null,
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
    sourceUrl: 'https://example.invalid/fuente',
    ...over,
  };
}

const DOCS: JourneyDocument[] = [
  {
    product: product('ambar-noche'),
    profile: profile({
      base: ['vanilla', 'amber'],
      families: ['amber', 'gourmand'],
      seasons: ['winter'],
      times: ['night'],
    }),
  },
  {
    product: product('rosa-dia'),
    profile: profile({
      heart: ['rose'],
      families: ['floral'],
      seasons: ['spring', 'summer'],
      times: ['day'],
    }),
  },
  {
    product: product('rosa-oud'),
    profile: profile({
      heart: ['rose'],
      base: ['oud', 'vanilla'],
      families: ['woody', 'floral'],
      seasons: ['winter'],
      times: ['night'],
    }),
  },
  // Sin perfil: nunca se propone.
  { product: product('sin-ficha'), profile: null },
];

const slugs = (answers: Partial<typeof NO_ANSWERS>) =>
  recommend(DOCS, { ...NO_ANSWERS, ...answers }).map((m) => m.product.slug);

describe('recommend', () => {
  it('sin respuestas no propone nada; evitar notas solo, tampoco', () => {
    expect(slugs({})).toEqual([]);
    expect(slugs({ avoid: ['rose'] })).toEqual([]);
  });

  it('ordena por coincidencias y explica cada propuesta', () => {
    const matches = recommend(DOCS, {
      ...NO_ANSWERS,
      families: ['amber'],
      seasons: ['winter'],
      times: ['night'],
      likes: ['vanilla'],
    });
    expect(matches.map((m) => [m.product.slug, m.score])).toEqual([
      ['ambar-noche', 3 + 1 + 1 + 2],
      ['rosa-oud', 1 + 1 + 2],
    ]);
    expect(matches[1]!.reasons).toEqual({
      families: [],
      seasons: ['winter'],
      times: ['night'],
      notes: ['vanilla'],
    });
  });

  it('una nota que se evita descarta el perfume', () => {
    expect(slugs({ families: ['floral'] })).toEqual(['rosa-dia', 'rosa-oud']);
    expect(slugs({ families: ['floral'], avoid: ['oud'] })).toEqual([
      'rosa-dia',
    ]);
  });

  it('a igual puntuación, el orden de la colección; y es reproducible', () => {
    const answers = { ...NO_ANSWERS, likes: ['rose' as const] };
    expect(recommend(DOCS, answers).map((m) => m.product.slug)).toEqual([
      'rosa-dia',
      'rosa-oud',
    ]);
    expect(recommend(DOCS, answers)).toEqual(recommend(DOCS, answers));
  });
});

describe('journeyOptions', () => {
  it('solo lo que tiene algún perfume, y cuántos tienen perfil', () => {
    const options = journeyOptions(DOCS, 3);
    expect(options.families).toEqual(['floral', 'gourmand', 'amber', 'woody']);
    expect(options.seasons).toEqual(['spring', 'summer', 'winter']);
    expect(options.times).toEqual(['day', 'night']);
    expect(options.notes).toEqual(['rose', 'vanilla', 'amber']);
    expect([options.covered, options.total]).toEqual([3, 4]);
  });
});

describe('respuestas en la URL', () => {
  it('ida y vuelta, sin valores desconocidos ni repetidos', () => {
    const answers = {
      families: ['woody', 'amber'] as const,
      seasons: ['winter'] as const,
      times: ['night'] as const,
      likes: ['vanilla'] as const,
      avoid: ['rose'] as const,
    };
    const search = answersToSearch({
      families: [...answers.families],
      seasons: [...answers.seasons],
      times: [...answers.times],
      likes: [...answers.likes],
      avoid: [...answers.avoid],
    });
    expect(search).toBe(
      '?familias=woody,amber&estaciones=winter&momento=night&notas=vanilla&evitar=rose',
    );
    expect(answersFromSearch(search)).toEqual(answers);
    expect(answersToSearch(NO_ANSWERS)).toBe('');
    expect(
      answersFromSearch(
        '?familias=woody,inventada,woody,amber,floral&notas=vanilla&evitar=vanilla,<x>',
      ),
    ).toEqual({
      families: ['woody', 'amber', 'floral'],
      seasons: [],
      times: [],
      likes: ['vanilla'],
      avoid: [],
    });
  });
});
