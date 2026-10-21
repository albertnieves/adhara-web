import type { MetadataRoute } from 'next';
import { listSitemapProducts } from '@/modules/catalog/server';
import { routing } from '@/modules/i18n/routing';
import { indexingEnabled } from '@/modules/i18n/indexing';
import { siteUrl } from '@/modules/i18n/seo';

export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!indexingEnabled()) return [];
  const base = siteUrl();
  const entries: MetadataRoute.Sitemap = [];
  function add(
    pathname: keyof typeof routing.pathnames,
    locales: readonly string[],
    slug?: string,
  ) {
    const published = routing.locales.filter((locale) =>
      locales.includes(locale),
    );
    const languages = Object.fromEntries(
      published.map((locale) => {
        const route = routing.pathnames[pathname];
        const translated = typeof route === 'string' ? route : route[locale];
        const path =
          translated === '/'
            ? ''
            : translated.replace('[slug]', encodeURIComponent(slug ?? ''));
        return [locale, new URL(`/${locale}${path}`, base).href];
      }),
    );
    if (languages.es) languages['x-default'] = languages.es;
    for (const locale of published)
      entries.push({ url: languages[locale]!, alternates: { languages } });
  }
  for (const href of [
    '/',
    '/catalogo',
    '/catalogo-olfativo',
    '/casas',
  ] as const)
    add(href, routing.locales);
  const products = await listSitemapProducts();
  // Una página por casa con algún perfume publicado, en los tres idiomas.
  const brands = new Set(products.map((product) => product.brand.slug));
  for (const brand of [...brands].sort())
    add('/casas/[slug]', routing.locales, brand);
  for (const product of products) {
    const locales = [
      'es',
      ...product.translations
        .filter((t) => t.tagline || t.description)
        .map((t) => t.locale),
    ];
    add('/perfume/[slug]', locales, product.slug);
  }
  return entries;
}
