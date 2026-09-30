import { describe, expect, it } from 'vitest';
import { buildAlternates, siteUrl } from '@/modules/i18n/seo';

describe('siteUrl', () => {
  it('usa el dominio configurado, luego el de Vercel y en local localhost', () => {
    expect(
      siteUrl({ NEXT_PUBLIC_SITE_URL: 'https://adhara.example' }).origin,
    ).toBe('https://adhara.example');
    expect(
      siteUrl({
        VERCEL_ENV: 'production',
        VERCEL_PROJECT_PRODUCTION_URL: 'adhara.vercel.app',
      }).origin,
    ).toBe('https://adhara.vercel.app');
    expect(
      siteUrl({ VERCEL_ENV: 'preview', VERCEL_BRANCH_URL: 'rama.vercel.app' })
        .origin,
    ).toBe('https://rama.vercel.app');
    expect(siteUrl({}).origin).toBe('http://localhost:3000');
  });
});

const entityPaths = {
  es: '/es/perfume/yara',
  ca: '/ca/perfum/yara',
  en: '/en/fragrance/yara',
};

describe('buildAlternates', () => {
  it('publicado en todos los idiomas: canonical propio y hreflang completo', () => {
    expect(
      buildAlternates({
        entityPaths,
        publishedLocales: ['es', 'ca', 'en'],
        currentLocale: 'ca',
      }),
    ).toEqual({
      canonical: '/ca/perfum/yara',
      languages: {
        es: '/es/perfume/yara',
        ca: '/ca/perfum/yara',
        en: '/en/fragrance/yara',
        'x-default': '/es/perfume/yara',
      },
      noindex: false,
    });
  });

  it('idioma actual no publicado: canonical al español y noindex', () => {
    expect(
      buildAlternates({
        entityPaths,
        publishedLocales: ['es'],
        currentLocale: 'en',
      }),
    ).toEqual({
      canonical: '/es/perfume/yara',
      languages: { es: '/es/perfume/yara', 'x-default': '/es/perfume/yara' },
      noindex: true,
    });
  });

  it('sin traducciones: sin hreflang, canonical al español y noindex', () => {
    expect(
      buildAlternates({
        entityPaths,
        publishedLocales: [],
        currentLocale: 'es',
      }),
    ).toEqual({ canonical: '/es/perfume/yara', languages: {}, noindex: true });
  });

  it('x-default siempre apunta al español aunque se esté en otro idioma', () => {
    const result = buildAlternates({
      entityPaths,
      publishedLocales: ['ca', 'en'],
      currentLocale: 'en',
    });
    expect(result.languages['x-default']).toBe('/es/perfume/yara');
    expect(result.languages).not.toHaveProperty('es');
    expect(result.canonical).toBe('/en/fragrance/yara');
  });

  it('ignora idiomas desconocidos', () => {
    expect(
      buildAlternates({
        entityPaths,
        publishedLocales: ['es', 'fr'],
        currentLocale: 'fr',
      }).languages,
    ).toEqual({ es: '/es/perfume/yara', 'x-default': '/es/perfume/yara' });
  });
});
