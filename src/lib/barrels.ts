/**
 * `index.ts` que Next carga solo en lo que se importa de ellos
 * (`experimental.optimizePackageImports`, DECISIONS §200).
 *
 * Sin esto, una página que importa un componente de cliente desde el índice
 * de su módulo recibe todos los demás: la búsqueda cargaba el carrusel de la
 * portada, y lo que el layout importa por índice (el aviso de cookies, las
 * etiquetas de medición) arrastraba la lista de archivos de la portada,
 * `motion` incluido, a todas las páginas.
 *
 * Solo índices que no hacen más que reexportar: Next no puede recortar los
 * que tienen código propio (`@/modules/unboxing`). La prueba
 * `tests/unit/barrels.test.ts` comprueba que esta lista y los índices del
 * proyecto coinciden.
 */
export const OPTIMIZED_BARRELS = [
  '@/components/ui',
  '@/modules/account',
  '@/modules/account/ui',
  '@/modules/admin',
  '@/modules/assistant',
  '@/modules/auth',
  '@/modules/brand',
  '@/modules/catalog',
  '@/modules/catalog/ui',
  '@/modules/checkout',
  '@/modules/checkout/ui',
  '@/modules/content',
  '@/modules/control',
  '@/modules/control/ui',
  '@/modules/customers',
  '@/modules/customers/ui',
  '@/modules/design',
  '@/modules/i18n',
  '@/modules/inventory',
  '@/modules/inventory/ui',
  '@/modules/legal',
  '@/modules/mail',
  '@/modules/messaging',
  '@/modules/messaging/ui',
  '@/modules/newsletter',
  '@/modules/orders',
  '@/modules/orders/ui',
  '@/modules/pricing',
  '@/modules/promotions',
  '@/modules/promotions/ui',
  '@/modules/purchasing',
  '@/modules/purchasing/ui',
  '@/modules/reports',
  '@/modules/shipping',
  '@/modules/shipping/ui',
  '@/modules/storefront',
  '@/modules/tracking',
];
