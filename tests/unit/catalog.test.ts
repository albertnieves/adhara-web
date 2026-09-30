import { describe, expect, it } from 'vitest';
import type { StorefrontProduct } from '@/modules/catalog';
import {
  heroMedia,
  lowestPrice,
  slugify,
  variantLabel,
} from '@/modules/catalog';
import { findSceneSlug } from '@/modules/unboxing';

const base: StorefrontProduct = {
  id: 'p',
  slug: 'asad',
  name: 'Asad',
  brand: { slug: 'lattafa', name: 'Lattafa' },
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

const variant = (priceCents: number | null, sizeMl: number | null = 100) => ({
  id: `v${priceCents}`,
  label: null,
  sizeMl,
  priceCents,
  compareAtCents: null,
  position: 0,
});

describe('catálogo de la tienda', () => {
  it('el precio mínimo ignora los formatos sin PVP', () => {
    expect(lowestPrice(base)).toBeNull();
    expect(
      lowestPrice({
        ...base,
        variants: [variant(null), variant(4990), variant(2990)],
      }),
    ).toBe(2990);
  });

  it('la imagen principal es la marcada como hero o la primera por posición', () => {
    const media = (
      url: string,
      role: 'hero' | 'gallery',
      position: number,
    ) => ({
      url,
      alt: null,
      role,
      origin: 'own_photo' as const,
      provisional: false,
      position,
    });
    expect(heroMedia(base)).toBeNull();
    expect(
      heroMedia({
        ...base,
        media: [media('/b', 'gallery', 1), media('/a', 'gallery', 0)],
      })?.url,
    ).toBe('/a');
    expect(
      heroMedia({
        ...base,
        media: [media('/a', 'gallery', 0), media('/h', 'hero', 5)],
      })?.url,
    ).toBe('/h');
  });

  it('la etiqueta del formato prefiere el texto escrito y si no los ml', () => {
    expect(variantLabel(variant(null, 100))).toBe('100 ml');
    expect(
      variantLabel({ ...variant(null, 100), label: '  Set regalo ' }),
    ).toBe('Set regalo');
    expect(variantLabel(variant(null, null))).toBe('—');
  });

  it('slugify quita acentos, símbolos y espacios', () => {
    expect(slugify('Khamrah Qahwa')).toBe('khamrah-qahwa');
    expect(slugify('  Club de Nuit Intense Man — Édition  ')).toBe(
      'club-de-nuit-intense-man-edition',
    );
    expect(slugify('Oud & Rose')).toBe('oud-and-rose');
    expect(slugify('***')).toBe('');
  });

  it('solo se usan escenas 3D que existen', () => {
    expect(findSceneSlug('asad')).toBe('asad');
    expect(findSceneSlug('otra')).toBeNull();
    expect(findSceneSlug(null)).toBeNull();
  });
});
