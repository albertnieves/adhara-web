import { defineRouting } from 'next-intl/routing';
export const routing = defineRouting({
  locales: ['es', 'ca', 'en'],
  defaultLocale: 'es',
  localePrefix: 'always',
  pathnames: {
    '/': '/',
    '/catalogo': { es: '/catalogo', ca: '/cataleg', en: '/catalog' },
    '/catalogo-olfativo': {
      es: '/catalogo-olfativo',
      ca: '/cataleg-olfactiu',
      en: '/scent-catalogue',
    },
    '/catalogo-olfativo/[slug]': {
      es: '/catalogo-olfativo/[slug]',
      ca: '/cataleg-olfactiu/[slug]',
      en: '/scent-catalogue/[slug]',
    },
    '/perfume/[slug]': {
      es: '/perfume/[slug]',
      ca: '/perfum/[slug]',
      en: '/fragrance/[slug]',
    },
  },
});
