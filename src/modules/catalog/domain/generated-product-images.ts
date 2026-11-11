import type { StorefrontProduct } from './product';

/** PR #59, 02/11/2026. Recreaciones, no fotografías verificadas.
 * Miss Sakura se incorpora el 11/11/2026 a petición del usuario.
 * Solo se enriquecen productos ya leídos con RLS; no se crea catálogo.
 */
const originalSlugs = [
  'asad-bourbon',
  'asad-elixir',
  'bharara-double-bleu',
  'bharara-king',
  'bharara-niche',
  'bharara-queen',
  'bharara-the-collection',
  'champagne-black',
  'champagne-blue',
  'champagne-pink',
  'club-de-nuit-iconic',
  'club-de-nuit-intense',
  'club-de-nuit-maleka',
  'club-de-nuit-milestone',
  'club-de-nuit-sillage',
  'club-de-nuit-untold',
  'club-de-nuit-white-imperiale',
  'game-of-spades-blind-bid',
  'game-of-spades-queen',
  'glitch',
  'little-garden',
  'miss-arrogate',
  'miss-sakura',
  'odyssey-artisto',
  'odyssey-candee',
  'odyssey-limoni',
  'odyssey-mandarin-sky-vintage-edition',
  'odyssey-mandarin-sky',
  'odyssey-mega',
  'odyssey-revolution-ultra-edition',
  'odyssey-toffee-coffee',
  'pharaoh-ramesses-i',
  'pharaoh-ramesses-ii',
  'queen-rose',
  'reef-19',
  'reef-33-white',
  'reef-33',
  'risk-comete',
  'voux-turquoise',
  'vulcan-baie',
  'vulcan-sable',
  'yara-aceite-concentrado',
  'yara-elixir',
  'yara-moi-aceite-concentrado',
  'yara-moi',
  'yara-tous-aceite-concentrado',
] as const;

const additionalSlugs = [
  'abaq-oud-for-love',
  'aether-extrait',
  'afeef',
  'affection-love',
  'ajwad-pink-to-pink',
  'ajwad',
  'al-areeq-gold',
  'al-qasr-rouge',
  'al-qiam-gold',
  'amber-oud-aqua-dubai',
  'amber-oud-dubai-night',
] as const;

export const GENERATED_PRODUCT_SLUGS = [...originalSlugs, ...additionalSlugs];

const directories = new Map<string, string>([
  ...originalSlugs.map((slug) => [slug, '2026-11-02'] as const),
  ...additionalSlugs.map((slug) => [slug, '2026-11-03'] as const),
]);

/** Conserva las fuentes originales y permite sustituir la propuesta desde el panel
 * marcando una foto propia como principal. No modifica el producto recibido.
 */
export function withGeneratedProductImage(
  product: StorefrontProduct,
): StorefrontProduct {
  const directory = directories.get(product.slug);
  if (!directory) return product;
  const url = `/media/generated-products/${directory}/${product.slug}.webp`;
  if (product.media.some((media) => media.url === url)) return product;
  const ownHero = product.media.find(
    (media) => media.role === 'hero' && media.origin === 'own_photo',
  );
  const generated = {
    url,
    alt: null,
    role: ownHero ? ('gallery' as const) : ('hero' as const),
    origin: 'generated_draft' as const,
    provisional: true,
    position: ownHero ? ownHero.position + 1 : -1,
  };
  return {
    ...product,
    media: ownHero
      ? [ownHero, generated, ...product.media.filter((m) => m !== ownHero)]
      : [generated, ...product.media],
  };
}
