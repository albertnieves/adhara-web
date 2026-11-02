import type { TrackingCategory, TrackingVendor } from './vendors';
import { TRACKING_VENDORS, VENDOR_CATEGORY } from './vendors';

/**
 * IDs públicos de cada proveedor (aparecen en el HTML de cualquier tienda que
 * los use; no son secretos). Sin el suyo, el proveedor no existe para la web:
 * ni se carga, ni sale en el aviso, ni en la política de cookies.
 */
export type TrackingConfig = {
  ga4: string | null;
  googleAds: { id: string; purchaseLabel: string | null } | null;
  meta: string | null;
  tiktok: string | null;
};

export const NO_TRACKING: TrackingConfig = {
  ga4: null,
  googleAds: null,
  meta: null,
  tiktok: null,
};

/** Variables de entorno de cada ID (Vercel → Settings → Environment Variables). */
export const TRACKING_ENV = {
  ga4: 'NEXT_PUBLIC_GA_MEASUREMENT_ID',
  googleAds: 'NEXT_PUBLIC_GOOGLE_ADS_ID',
  googleAdsPurchaseLabel: 'NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL',
  meta: 'NEXT_PUBLIC_META_PIXEL_ID',
  tiktok: 'NEXT_PUBLIC_TIKTOK_PIXEL_ID',
} as const;

/** Formato de cada ID; uno que no encaja se ignora (y el build lo señala). */
export const TRACKING_ID_PATTERNS: Record<keyof typeof TRACKING_ENV, RegExp> = {
  ga4: /^G-[A-Z0-9]{4,20}$/,
  googleAds: /^AW-\d{6,15}$/,
  googleAdsPurchaseLabel: /^[A-Za-z0-9_-]{4,64}$/,
  meta: /^\d{10,20}$/,
  tiktok: /^[A-Z0-9]{15,30}$/,
};

type Environment = Record<string, string | undefined>;

function read(env: Environment, key: keyof typeof TRACKING_ENV) {
  const value = env[TRACKING_ENV[key]]?.trim();
  return value && TRACKING_ID_PATTERNS[key].test(value) ? value : null;
}

/**
 * Proveedores configurados. Las Preview nunca miden: sus pedidos de prueba
 * contarían como conversiones reales en las campañas.
 */
export function trackingConfig(env: Environment): TrackingConfig {
  if (env.VERCEL_ENV === 'preview') return NO_TRACKING;
  const adsId = read(env, 'googleAds');
  return {
    ga4: read(env, 'ga4'),
    googleAds: adsId
      ? { id: adsId, purchaseLabel: read(env, 'googleAdsPurchaseLabel') }
      : null,
    meta: read(env, 'meta'),
    tiktok: read(env, 'tiktok'),
  };
}

/** Variables con un valor que no tiene el formato de su ID (sin mostrar el valor). */
export function trackingConfigIssues(env: Environment): string[] {
  return (Object.keys(TRACKING_ENV) as (keyof typeof TRACKING_ENV)[]).flatMap(
    (key) => {
      const value = env[TRACKING_ENV[key]]?.trim();
      return value && !TRACKING_ID_PATTERNS[key].test(value)
        ? [`${TRACKING_ENV[key]} no tiene el formato esperado.`]
        : [];
    },
  );
}

/** Proveedores con ID, en orden. */
export function activeVendors(config: TrackingConfig): TrackingVendor[] {
  return TRACKING_VENDORS.filter((vendor) => config[vendor] !== null);
}

/** Tipos de cookies con algún proveedor configurado. */
export function activeCategories(
  vendors: readonly TrackingVendor[],
): TrackingCategory[] {
  const set = new Set(vendors.map((vendor) => VENDOR_CATEGORY[vendor]));
  return (['analytics', 'ads'] as const).filter((category) =>
    set.has(category),
  );
}
