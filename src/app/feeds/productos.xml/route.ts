import { merchantFeedItems, merchantFeedXml } from '@/modules/catalog';
import {
  getAvailability,
  listPublishedProducts,
} from '@/modules/catalog/server';
import { checkoutEnabled } from '@/modules/checkout/server';
import { getPathname } from '@/modules/i18n';
import { siteUrl } from '@/modules/i18n/seo';

/**
 * Feed de productos para Google Merchant Center (fichas gratuitas y anuncios
 * de Shopping) y el catálogo de Meta (anuncios dinámicos), DECISIONS §179.
 * Solo con la venta online encendida: Google y Meta exigen que el producto
 * se pueda comprar en la página. En español, que es la base del catálogo.
 * No se indexa: es para las plataformas, no para buscadores.
 */
export const revalidate = 3600;

const HEADERS = {
  'X-Robots-Tag': 'noindex, nofollow',
  'Cache-Control': 'public, max-age=0, s-maxage=3600',
};

export async function GET() {
  if (!checkoutEnabled())
    return new Response('Not Found', { status: 404, headers: HEADERS });
  const base = siteUrl();
  let products;
  try {
    products = await listPublishedProducts('es');
  } catch (error) {
    console.error('[feed] no se pudo leer el catálogo', error);
    return new Response('Service Unavailable', {
      status: 503,
      headers: { ...HEADERS, 'Cache-Control': 'no-store' },
    });
  }
  const availability = await getAvailability(
    products.map((product) => product.id),
  );
  const items = merchantFeedItems(
    products,
    availability,
    (product, variant) => {
      const url = new URL(
        getPathname({
          locale: 'es',
          href: { pathname: '/perfume/[slug]', params: { slug: product.slug } },
        }),
        base,
      );
      if (variant) url.searchParams.set('formato', variant);
      return url.href;
    },
  );
  const xml = merchantFeedXml(items, {
    title: 'L’Atelier du Désert',
    link: new URL('/es', base).href,
    description: 'Perfumería árabe en Castelldefels.',
  });
  return new Response(xml, {
    headers: { ...HEADERS, 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
