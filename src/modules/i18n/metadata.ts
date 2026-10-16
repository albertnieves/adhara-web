import type { Metadata } from 'next';
import { getPathname } from './navigation';
import { routing } from './routing';
import type { Locale } from './seo';
import { buildAlternates } from './seo';

type Href = Parameters<typeof getPathname>[0]['href'];

/**
 * Metadatos de idioma de una página de la tienda. Nunca activa la indexación:
 * el layout decide según SEO_INDEXING, entorno y Draft Mode.
 */
export function alternatesMetadata(
  href: Href,
  currentLocale: string,
  publishedLocales: readonly string[] = routing.locales,
): Pick<Metadata, 'alternates' | 'robots'> {
  const entityPaths = Object.fromEntries(
    routing.locales.map((locale) => [locale, getPathname({ locale, href })]),
  ) as Record<Locale, string>;
  const result = buildAlternates({
    entityPaths,
    publishedLocales,
    currentLocale,
  });
  return {
    alternates: { canonical: result.canonical, languages: result.languages },
    ...(result.noindex ? { robots: { index: false, follow: true } } : {}),
  };
}
