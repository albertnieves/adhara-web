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
    '/aviso-legal': {
      es: '/aviso-legal',
      ca: '/avis-legal',
      en: '/legal-notice',
    },
    '/condiciones-de-venta': {
      es: '/condiciones-de-venta',
      ca: '/condicions-de-venda',
      en: '/terms-of-sale',
    },
    '/privacidad': {
      es: '/privacidad',
      ca: '/privacitat',
      en: '/privacy-policy',
    },
    '/cookies': { es: '/cookies', ca: '/galetes', en: '/cookie-policy' },
    '/envios-y-devoluciones': {
      es: '/envios-y-devoluciones',
      ca: '/enviaments-i-devolucions',
      en: '/shipping-and-returns',
    },
    '/perfume/[slug]': {
      es: '/perfume/[slug]',
      ca: '/perfum/[slug]',
      en: '/fragrance/[slug]',
    },
  },
});
