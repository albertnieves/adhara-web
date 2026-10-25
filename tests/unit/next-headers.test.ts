import { afterEach, describe, expect, it, vi } from 'vitest';
import config from '../../next.config';

afterEach(() => vi.unstubAllEnvs());

describe('configuración HTTP real de Next', () => {
  it('no añade noindex global cuando se autoriza el dominio de producción', async () => {
    vi.stubEnv('SEO_INDEXING', '1');
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://latelierdudesert.com');
    const rules = await config.headers!();
    expect(
      rules
        .filter((rule) => rule.source === '/:path*')
        .flatMap((rule) => rule.headers)
        .some((header) => header.key.toLowerCase() === 'x-robots-tag'),
    ).toBe(false);
    expect(
      rules.find((rule) => rule.source === '/api/:path*')?.headers,
    ).toContainEqual({ key: 'X-Robots-Tag', value: 'noindex, nofollow' });
  });
  it('sin aprobación mantiene noindex incluso con el dominio correcto', async () => {
    vi.stubEnv('SEO_INDEXING', '');
    const rules = await config.headers!();
    expect(
      rules
        .filter((rule) => rule.source === '/:path*')
        .flatMap((rule) => rule.headers),
    ).toContainEqual({ key: 'X-Robots-Tag', value: 'noindex, nofollow' });
  });
});
