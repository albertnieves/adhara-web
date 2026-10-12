/*
 * Envíos (DECISIONS §136): península y Baleares, con las tarifas del panel.
 * Las mismas reglas que private.shipping_zone en la migración
 * 20261012120000_web_checkout: aquí solo sirven para enseñar el importe
 * antes de pagar; el que cuenta lo calcula la base al crear el pedido.
 */

export const SHIPPING_ZONES = ['peninsula', 'baleares'] as const;
export type ShippingZone = (typeof SHIPPING_ZONES)[number];

/** Nombres del panel (solo en español). */
export const SHIPPING_ZONE_LABELS: Readonly<Record<ShippingZone, string>> = {
  peninsula: 'Península',
  baleares: 'Illes Balears',
};

export type ShippingRate = {
  zone: ShippingZone;
  priceCents: number;
  /** Envío gratis desde este importe de artículos; null: nunca. */
  freeFromCents: number | null;
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

/** Gastos de envío de un pedido con `itemsCents` de artículos. */
export function shippingCost(itemsCents: number, rate: ShippingRate): number {
  return rate.freeFromCents !== null && itemsCents >= rate.freeFromCents
    ? 0
    : rate.priceCents;
}
