import type { StorefrontProduct } from '@/modules/catalog';
import { findSceneSlug } from '@/modules/unboxing';

/** Como mucho, los frascos que caben en el anillo sin amontonarse. */
export const MAX_HERO_SLIDES = 6;

/**
 * Perfumes del carrusel 3D de la portada: los publicados con escena 3D (hoy
 * los cuatro del piloto), en el orden de la colección. Solo entran los que la
 * tienda ve, así que uno archivado o en borrador desaparece solo.
 */
export function heroSlides(products: StorefrontProduct[]): StorefrontProduct[] {
  const seen = new Set<string>();
  return [...products]
    .sort((a, b) => a.position - b.position)
    .filter((product) => {
      // Una escena, un frasco: dos perfumes con la misma escena se verían iguales.
      const scene = findSceneSlug(product.unboxingScene);
      if (!scene || seen.has(scene)) return false;
      seen.add(scene);
      return true;
    })
    .slice(0, MAX_HERO_SLIDES);
}
