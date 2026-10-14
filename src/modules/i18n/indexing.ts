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
