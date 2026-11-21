import type { StorefrontProduct } from '@/modules/catalog';
import { findSceneSlug } from '@/modules/unboxing';

/** Como mucho, los frascos que caben en el anillo sin amontonarse. */
export const MAX_HERO_SLIDES = 6;

/**
 * Perfumes del carrusel 3D de la portada: los publicados con escena 3D, en el
 * orden de la colección (como mucho MAX_HERO_SLIDES). Solo entran los que la
 * tienda ve, así que uno archivado o en borrador desaparece solo. Con la venta
 * encendida, los agotados (`soldOut`) van detrás: la portada no abre con un
 * perfume que no se puede comprar si hay otro con escena que sí (§195).
 */
export function heroSlides(
  products: StorefrontProduct[],
  soldOut: ReadonlySet<string> = new Set(),
): StorefrontProduct[] {
  const seen = new Set<string>();
  return [...products]
    .sort(
      (a, b) =>
        Number(soldOut.has(a.id)) - Number(soldOut.has(b.id)) ||
        a.position - b.position,
    )
    .filter((product) => {
      // Una escena, un frasco: dos perfumes con la misma escena se verían iguales.
      const scene = findSceneSlug(product.unboxingScene);
      if (!scene || seen.has(scene)) return false;
      seen.add(scene);
      return true;
    })
    .slice(0, MAX_HERO_SLIDES);
}
