import type { TrackingCategory, TrackingVendor } from './vendors';
import { sortVendors, TRACKING_VENDORS, VENDOR_CATEGORY } from './vendors';

/**
 * Elección del visitante sobre las cookies opcionales. Se guarda en una
 * cookie propia (técnica: recordar el consentimiento no lo necesita) con la
 * versión del aviso, lo que eligió, los proveedores que vio y la fecha, para
 * poder acreditarlo.
 */
export const TRACKING_CONSENT_COOKIE = 'atelier_cookies';

/**
 * Versión del aviso de cookies. Cambiarla vuelve a preguntar a todos: hacerlo
 * si cambian las finalidades o el texto del aviso. Un proveedor nuevo no
 * necesita cambiarla (ver `consentNeeded`).
 */
export const TRACKING_CONSENT_VERSION = '2026-10-29';

/** Un año; después se vuelve a preguntar (la AEPD admite hasta 24 meses). */
export const TRACKING_CONSENT_MAX_AGE = 60 * 60 * 24 * 365;

export type ConsentChoice = Record<TrackingCategory, boolean>;

export type StoredConsent = {
  version: string;
  choice: ConsentChoice;
  /** Proveedores que el visitante tenía delante al elegir. */
  vendors: TrackingVendor[];
  /** Segundos desde 1970. */
  at: number;
};

export const ALL_GRANTED: ConsentChoice = { analytics: true, ads: true };
export const ALL_DENIED: ConsentChoice = { analytics: false, ads: false };

const VENDOR_SET = new Set<string>(TRACKING_VENDORS);

/** `2026-10-29~10~ga4.meta~1793318400`: versión, analítica y publicidad (1/0), proveedores y fecha. */
export function serializeConsent(
  choice: ConsentChoice,
  vendors: readonly TrackingVendor[],
  at: number,
  version: string = TRACKING_CONSENT_VERSION,
): string {
  return [
    version,
    `${choice.analytics ? 1 : 0}${choice.ads ? 1 : 0}`,
    sortVendors(vendors).join('.'),
    Math.floor(at),
  ].join('~');
}

export function parseConsent(
  value: string | null | undefined,
): StoredConsent | null {
  if (!value) return null;
  const parts = value.split('~');
  if (parts.length !== 4) return null;
  const [version, flags, vendors, at] = parts as [
    string,
    string,
    string,
    string,
  ];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(version) || !/^[01]{2}$/.test(flags))
    return null;
  const list = vendors ? vendors.split('.') : [];
  if (list.some((vendor) => !VENDOR_SET.has(vendor))) return null;
  if (!/^\d{1,12}$/.test(at)) return null;
  return {
    version,
    choice: { analytics: flags[0] === '1', ads: flags[1] === '1' },
    vendors: sortVendors(list as TrackingVendor[]),
    at: Number(at),
  };
}

/** La cookie de consentimiento dentro de `document.cookie` (o de una cabecera Cookie). */
export function consentFromCookieHeader(header: string): StoredConsent | null {
  const prefix = `${TRACKING_CONSENT_COOKIE}=`;
  const raw = header
    .split(/;\s*/)
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length);
  if (!raw) return null;
  try {
    return parseConsent(decodeURIComponent(raw));
  } catch {
    return null;
  }
}

/**
 * Hay que preguntar: sin elección guardada o de otra versión, o con un
 * proveedor nuevo en un tipo que había aceptado (no lo conocía). Si había
 * rechazado ese tipo, el proveedor nuevo sigue rechazado y no se pregunta.
 */
export function consentNeeded(
  stored: StoredConsent | null,
  configured: readonly TrackingVendor[],
): boolean {
  if (configured.length === 0) return false;
  if (!stored || stored.version !== TRACKING_CONSENT_VERSION) return true;
  return configured.some(
    (vendor) =>
      stored.choice[VENDOR_CATEGORY[vendor]] &&
      !stored.vendors.includes(vendor),
  );
}

/** Proveedores configurados que se pueden cargar con la elección guardada. */
export function grantedVendors(
  stored: StoredConsent | null,
  configured: readonly TrackingVendor[],
): TrackingVendor[] {
  if (!stored || stored.version !== TRACKING_CONSENT_VERSION) return [];
  return configured.filter(
    (vendor) =>
      stored.choice[VENDOR_CATEGORY[vendor]] && stored.vendors.includes(vendor),
  );
}
