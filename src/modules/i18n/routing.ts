import { defineRouting } from 'next-intl/routing';
export const routing = defineRouting({
  locales: ['es', 'ca', 'en'],
  defaultLocale: 'es',
  localePrefix: 'always',
  pathnames: {
    '/': '/',
    '/catalogo': { es: '/catalogo', ca: '/cataleg', en: '/catalog' },
  },
});
