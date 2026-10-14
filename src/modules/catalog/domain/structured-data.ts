import type { Availability, StorefrontProduct } from './product';
import { variantLabel } from './product';

/** Datos públicos exclusivamente. Sin reseñas, SKU o disponibilidad inventados. */
export function productStructuredData(
  product: StorefrontProduct,
  url: string,
  commerce?: { enabled: boolean; availability: Record<string, Availability> },
) {
  const offers = commerce?.enabled
    ? product.variants.flatMap((variant) => {
        if (
          variant.priceCents === null ||
          !Number.isSafeInteger(variant.priceCents) ||
          variant.priceCents <= 0
        )
          return [];
        const availability = commerce.availability[variant.id];
        return [
          {
            '@type': 'Offer',
            url,
            name: `${product.name} · ${variantLabel(variant)}`,
            priceCurrency: 'EUR',
            price: (variant.priceCents / 100).toFixed(2),
            ...(availability
              ? {
                  availability:
                    availability === 'out_of_stock'
                      ? 'https://schema.org/OutOfStock'
                      : 'https://schema.org/InStock',
                }
              : {}),
          },
        ];
      })
    : [];
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${url}#product`,
    url,
    name: product.name,
    brand: { '@type': 'Brand', name: product.brand.name },
    ...(offers.length ? { offers } : {}),
    ...(product.description || product.tagline
      ? { description: product.description || product.tagline }
      : {}),
    ...(product.media.length
      ? { image: product.media.map((media) => media.url) }
      : {}),
  };
}

/** Impide cerrar el script con contenido editorial como </script>. */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
