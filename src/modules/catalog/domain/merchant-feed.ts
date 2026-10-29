import type { Availability, ProductMedia, StorefrontProduct } from './product';
import { CONCENTRATION_NAMES, variantLabel } from './product';

/**
 * Feed de productos para Google Merchant Center y el catálogo de Meta
 * (DECISIONS §180): RSS 2.0 con los atributos `g:` de Google, que Meta
 * también lee. Un artículo por formato con PVP, con el mismo ID que los
 * eventos de la analítica y la publicidad (§179) para el remarketing
 * dinámico.
 *
 * Solo datos verificados del catálogo: sin GTIN ni MPN (la base no los
 * tiene; un SKU interno no es un MPN), sin reseñas y sin fotos generadas o
 * provisionales. Un perfume sin foto con derechos no entra: Google y Meta
 * exigen imagen.
 */

/** Health & Beauty > Personal Care > Cosmetics > Perfume & Cologne. */
export const GOOGLE_PERFUME_CATEGORY = '479';

/** Fotos que se pueden enseñar como el producto real. */
const FEED_ORIGINS = new Set<ProductMedia['origin']>([
  'own_photo',
  'brand_official',
  'catalog_pdf',
]);

export type FeedItem = {
  id: string;
  groupId: string;
  title: string;
  description: string;
  link: string;
  imageLink: string;
  additionalImageLinks: string[];
  availability: 'in_stock' | 'out_of_stock';
  /** «49.90 EUR»; con rebaja, el precio anterior (Ómnibus). */
  price: string;
  salePrice: string | null;
  brand: string;
  productType: string;
};

const amount = (cents: number) => `${(cents / 100).toFixed(2)} EUR`;

/** Imágenes válidas, la principal primero. */
function feedImages(product: StorefrontProduct): string[] {
  const media = product.media
    .filter((item) => FEED_ORIGINS.has(item.origin) && !item.provisional)
    .sort((a, b) => a.position - b.position);
  const hero = media.find((item) => item.role === 'hero') ?? media[0];
  if (!hero) return [];
  return [hero, ...media.filter((item) => item !== hero)].map(
    (item) => item.url,
  );
}

/**
 * Artículos del feed. `link` da la URL de la ficha con el formato elegido
 * (`?formato=`), para que la página muestre el mismo precio que el anuncio.
 */
export function merchantFeedItems(
  products: readonly StorefrontProduct[],
  availability: Readonly<Record<string, Availability>>,
  link: (product: StorefrontProduct, variantId: string | null) => string,
): FeedItem[] {
  return products.flatMap((product) => {
    const images = feedImages(product);
    if (images.length === 0 || !product.brand.name) return [];
    const priced = product.variants.filter(
      (variant) =>
        variant.priceCents !== null &&
        Number.isSafeInteger(variant.priceCents) &&
        variant.priceCents > 0,
    );
    const concentration =
      product.concentration && product.concentration !== 'OTHER'
        ? CONCENTRATION_NAMES[product.concentration]
        : null;
    return priced.map((variant): FeedItem => {
      const size = variantLabel(variant);
      const title = [
        product.brand.name,
        product.name,
        concentration,
        size === '—' ? null : size,
      ]
        .filter(Boolean)
        .join(' ')
        .slice(0, 150);
      const description =
        product.description?.trim() || product.tagline?.trim() || title;
      const price = variant.priceCents!;
      const before =
        variant.compareAtCents !== null && variant.compareAtCents > price
          ? variant.compareAtCents
          : null;
      return {
        id: variant.id,
        groupId: product.slug,
        title,
        description: description.slice(0, 5000),
        link: link(product, priced.length > 1 ? variant.id : null),
        imageLink: images[0]!,
        additionalImageLinks: images.slice(1, 11),
        availability:
          availability[variant.id] === 'in_stock' ||
          availability[variant.id] === 'low_stock'
            ? 'in_stock'
            : 'out_of_stock',
        price: amount(before ?? price),
        salePrice: before ? amount(price) : null,
        brand: product.brand.name,
        productType: `Perfumes > ${product.brand.name}`,
      };
    });
  });
}

const escape = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    // Caracteres de control que XML no admite.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

/** El feed en RSS 2.0 con el espacio de nombres de Google. */
export function merchantFeedXml(
  items: readonly FeedItem[],
  channel: { title: string; link: string; description: string },
): string {
  const tag = (name: string, value: string | null) =>
    value === null ? '' : `<${name}>${escape(value)}</${name}>`;
  const body = items
    .map((item) =>
      [
        '<item>',
        tag('g:id', item.id),
        tag('g:item_group_id', item.groupId),
        tag('g:title', item.title),
        tag('g:description', item.description),
        tag('g:link', item.link),
        tag('g:image_link', item.imageLink),
        ...item.additionalImageLinks.map((url) =>
          tag('g:additional_image_link', url),
        ),
        tag('g:availability', item.availability),
        tag('g:price', item.price),
        tag('g:sale_price', item.salePrice),
        tag('g:brand', item.brand),
        tag('g:condition', 'new'),
        tag('g:google_product_category', GOOGLE_PERFUME_CATEGORY),
        tag('g:product_type', item.productType),
        '</item>',
      ].join(''),
    )
    .join('\n');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
    '<channel>',
    tag('title', channel.title),
    tag('link', channel.link),
    tag('description', channel.description),
    body,
    '</channel>',
    '</rss>',
    '',
  ].join('\n');
}
