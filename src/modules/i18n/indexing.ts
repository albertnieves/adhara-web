/** Indexación explícita solo en producción; las previews nunca se indexan. */
export function indexingEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (env.SEO_INDEXING !== '1' || env.VERCEL_ENV !== 'production') return false;
  try {
    const url = new URL(env.NEXT_PUBLIC_SITE_URL ?? '');
    return (
      url.origin === 'https://latelierdudesert.com' &&
      url.pathname === '/' &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

/** Las cabeceras HTTP usan la misma decisión que robots, sitemap y metadata. */
export function indexingHeaders(
  env: Record<string, string | undefined> = process.env,
): { source: string; headers: { key: string; value: string }[] }[] {
  const headers = [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }];
  if (!indexingEnabled(env)) return [{ source: '/:path*', headers }];
  // Las rutas operativas siguen cerradas, también las traducidas y sus hijas.
  return [
    '/admin/:path*',
    '/api/:path*',
    '/auth/:path*',
    '/:locale(es|ca|en)/:operation(cuenta|compte|account|cesta|cistella|basket|finalizar-compra|finalitzar-compra|checkout|pedido|comanda|order)/:path*',
  ].map((source) => ({ source, headers }));
}
