/*
 * Zonas de envío (DECISIONS §136): península y Baleares. Las mismas reglas
 * que private.shipping_zone en la migración 20261012120000_web_checkout. El
 * precio sale del peso y del servicio elegido (src/modules/shipping, §172) y
 * lo calcula la base al crear el pedido.
 */

export const SHIPPING_ZONES = ['peninsula', 'baleares'] as const;
export type ShippingZone = (typeof SHIPPING_ZONES)[number];

/** Nombres del panel (solo en español). */
export const SHIPPING_ZONE_LABELS: Readonly<Record<ShippingZone, string>> = {
  peninsula: 'Península',
  baleares: 'Illes Balears',
};

const POSTAL_CODE = /^(0[1-9]|[1-4][0-9]|5[0-2])[0-9]{3}$/;
/** Canarias (35, 38), Ceuta (51) y Melilla (52): IGIC y aduana. */
const OUTSIDE = new Set(['35', '38', '51', '52']);

/** Zona de un código postal español, o null si no se envía allí. */
export function shippingZone(postalCode: string): ShippingZone | null {
  const code = postalCode.trim();
  if (!POSTAL_CODE.test(code)) return null;
  const province = code.slice(0, 2);
  if (province === '07') return 'baleares';
  if (OUTSIDE.has(province)) return null;
  return 'peninsula';
}

export function isPostalCode(value: string): boolean {
  return /^[0-9]{5}$/.test(value.trim());
}
