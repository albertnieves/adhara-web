/**
 * Medición opcional de la tienda (DECISIONS §178): analítica y publicidad de
 * terceros, solo con el consentimiento del visitante. Las cookies técnicas no
 * entran aquí: no necesitan consentimiento (LSSI, art. 22.2).
 */

/** Tipos de cookies que el visitante acepta o rechaza por separado. */
export const TRACKING_CATEGORIES = ['analytics', 'ads'] as const;
export type TrackingCategory = (typeof TRACKING_CATEGORIES)[number];

/** Proveedores que la tienda sabe cargar; cada uno se enciende con su ID. */
export const TRACKING_VENDORS = ['ga4', 'googleAds', 'meta', 'tiktok'] as const;
export type TrackingVendor = (typeof TRACKING_VENDORS)[number];

export const VENDOR_CATEGORY: Record<TrackingVendor, TrackingCategory> = {
  ga4: 'analytics',
  googleAds: 'ads',
  meta: 'ads',
  tiktok: 'ads',
};

/** Nombre que ve el visitante en el aviso (igual en los tres idiomas). */
export const VENDOR_NAMES: Record<TrackingVendor, string> = {
  ga4: 'Google Analytics',
  googleAds: 'Google Ads',
  meta: 'Meta (Facebook, Instagram)',
  tiktok: 'TikTok',
};

/**
 * Cookies que cada proveedor guarda en el dominio de la tienda. Al retirar
 * el consentimiento se borran (las de sus propios dominios no se pueden
 * borrar desde aquí; lo explica la política de cookies).
 */
export const VENDOR_COOKIES: Record<
  TrackingVendor,
  { names: readonly string[]; prefixes: readonly string[] }
> = {
  ga4: { names: ['_ga', '_gid'], prefixes: ['_ga_', '_gat'] },
  googleAds: { names: [], prefixes: ['_gcl_'] },
  meta: { names: ['_fbp', '_fbc'], prefixes: [] },
  tiktok: {
    names: ['_ttp', '_tt_enable_cookie', 'ttcsid'],
    prefixes: ['ttcsid_'],
  },
};

/** Duración de las cookies de Google Analytics: 13 meses, no los 2 años por defecto. */
export const GA_COOKIE_EXPIRES_SECONDS = 60 * 60 * 24 * 395;

/** Proveedores en el orden de la lista, sin repetir. */
export function sortVendors(
  vendors: Iterable<TrackingVendor>,
): TrackingVendor[] {
  const set = new Set(vendors);
  return TRACKING_VENDORS.filter((vendor) => set.has(vendor));
}
