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
    '/casas': { es: '/casas', ca: '/cases', en: '/houses' },
    '/casas/[slug]': {
      es: '/casas/[slug]',
      ca: '/cases/[slug]',
      en: '/houses/[slug]',
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
    // Cesta, checkout (P03) y vuelta del banco (P04): 404 mientras
    // WEB_CHECKOUT no esté encendido.
    '/cesta': { es: '/cesta', ca: '/cistella', en: '/basket' },
    '/finalizar-compra': {
      es: '/finalizar-compra',
      ca: '/finalitzar-compra',
      en: '/checkout',
    },
    '/pedido': { es: '/pedido', ca: '/comanda', en: '/order' },
    // Cuenta de cliente (F14): 404 mientras CUSTOMER_ACCOUNTS no esté
    // encendido. El prefijo de cada idioma lo usa también el proxy
    // (account/domain/paths.ts).
    '/cuenta': { es: '/cuenta', ca: '/compte', en: '/account' },
    '/cuenta/pedidos/[number]': {
      es: '/cuenta/pedidos/[number]',
      ca: '/compte/comandes/[number]',
      en: '/account/orders/[number]',
    },
    '/cuenta/datos': {
      es: '/cuenta/datos',
      ca: '/compte/dades',
      en: '/account/details',
    },
    '/cuenta/acceso': {
      es: '/cuenta/acceso',
      ca: '/compte/acces',
      en: '/account/sign-in',
    },
    '/cuenta/registro': {
      es: '/cuenta/registro',
      ca: '/compte/registre',
      en: '/account/register',
    },
    '/cuenta/recuperar': {
      es: '/cuenta/recuperar',
      ca: '/compte/recuperar',
      en: '/account/forgot-password',
    },
    '/cuenta/nueva-contrasena': {
      es: '/cuenta/nueva-contrasena',
      ca: '/compte/nova-contrasenya',
      en: '/account/new-password',
    },
    // Formulario de contacto (A6.1): 404 mientras CONTACT_FORM no esté encendido.
    '/contacto': { es: '/contacto', ca: '/contacte', en: '/contact' },
  },
});
