import { routing } from './routing';

export type Locale = (typeof routing.locales)[number];

export type AlternatesInput = {
  /** Ruta de la misma página en cada idioma, con prefijo (p. ej. /ca/cataleg). */
  entityPaths: Record<Locale, string>;
  /** Idiomas en los que la página está publicada (con contenido propio). */
  publishedLocales: readonly string[];
  currentLocale: string;
};

export type Alternates = {
  canonical: string;
  /** hreflang: solo idiomas publicados, más x-default → español. */
  languages: Record<string, string>;
  /** El idioma actual no está publicado: no indexar y canonical al español. */
  noindex: boolean;
};

/**
 * Base de las URL absolutas (canonical, hreflang): NEXT_PUBLIC_SITE_URL cuando
 * exista el dominio definitivo; mientras, la URL de Vercel del entorno.
 */
export function siteUrl(
  env: Record<string, string | undefined> = process.env,
): URL {
  if (env.NEXT_PUBLIC_SITE_URL) return new URL(env.NEXT_PUBLIC_SITE_URL);
  const host =
    env.VERCEL_ENV === 'production'
      ? env.VERCEL_PROJECT_PRODUCTION_URL
      : (env.VERCEL_BRANCH_URL ?? env.VERCEL_URL);
  return new URL(host ? `https://${host}` : 'http://localhost:3000');
}

/** Canonical y hreflang (docs/source/FASE_1_PLAN.md, SEO). Pura. */
export function buildAlternates({
  entityPaths,
  publishedLocales,
  currentLocale,
}: AlternatesInput): Alternates {
  const fallback = entityPaths[routing.defaultLocale];
  const published = routing.locales.filter((locale) =>
    publishedLocales.includes(locale),
  );
  const current = published.find((locale) => locale === currentLocale);
  const languages: Record<string, string> = Object.fromEntries(
    published.map((locale) => [locale, entityPaths[locale]]),
  );
  if (published.length > 0) languages['x-default'] = fallback;
  return {
    canonical: current ? entityPaths[current] : fallback,
    languages,
    noindex: !current,
  };
}
