import type { ProductMedia, StorefrontProduct } from '@/modules/catalog';
import { heroMedia } from '@/modules/catalog';

/** Cartas del abanico de la cabecera de la colección. */
export const MAX_DECK_CARDS = 4;

export type DeckCard = {
  slug: string;
  name: string;
  brand: string;
  media: ProductMedia;
};

/**
 * Perfumes del abanico 3D de la colección: uno de cada casa, el primero de la
 * colección que tenga foto, en el orden de la colección. Así el abanico enseña
 * casas distintas en vez de repetir la primera fila de la rejilla.
 */
export function deckCards(
  products: StorefrontProduct[],
  max = MAX_DECK_CARDS,
): DeckCard[] {
  const seen = new Set<string>();
  const cards: DeckCard[] = [];
  for (const product of [...products].sort((a, b) => a.position - b.position)) {
    if (cards.length >= max) break;
    const brand = product.brand.slug || product.brand.name;
    if (seen.has(brand)) continue;
    const media = heroMedia(product);
    if (!media) continue;
    seen.add(brand);
    cards.push({
      slug: product.slug,
      name: product.name,
      brand: product.brand.name,
      media,
    });
  }
  return cards;
}
