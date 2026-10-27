import { BASIS_POINTS } from '@/lib/money';

/*
 * Precio del envío (DECISIONS §172). Las mismas reglas que
 * private.shipping_price y web_order_create en la migración
 * 20261025120000_shipping_carriers: aquí solo sirven para enseñar el importe
 * antes de pagar y en el panel; el que cuenta lo calcula la base.
 */

/**
 * Coste del transportista sin IVA → precio con IVA, redondeado al céntimo
 * hacia arriba, más el recargo del servicio (con IVA).
 */
export function shippingPrice(
  costCents: number,
  vatBp: number,
  surchargeCents: number,
): number {
  return (
    Math.ceil((costCents * (BASIS_POINTS + vatBp)) / BASIS_POINTS) +
    surchargeCents
  );
}

/**
 * Lo que paga el cliente con una opción: nada si cuenta para el envío gratis
 * de la zona y lo que paga por los artículos (ya con el descuento) llega al
 * mínimo; si no, su precio.
 */
export function optionCost(
  option: { priceCents: number; freeEligible: boolean },
  itemsAfterDiscountCents: number,
  freeFromCents: number | null,
): number {
  return option.freeEligible &&
    freeFromCents !== null &&
    itemsAfterDiscountCents >= freeFromCents
    ? 0
    : option.priceCents;
}

/**
 * Decimal en texto de la plataforma («15.50», «4.000») → céntimos enteros,
 * redondeando la tercera cifra decimal. null si no es un importe positivo.
 */
export function decimalToCents(value: string): number | null {
  const match = /^(\d{1,7})(?:\.(\d{1,6}))?$/.exec(value.trim());
  if (!match) return null;
  const [, whole = '0', decimals = ''] = match;
  const digits = decimals.padEnd(3, '0');
  const cents = Number(whole) * 100 + Number(digits.slice(0, 2));
  return Number(digits[2]) >= 5 ? cents + 1 : cents;
}

/** Peso de la plataforma ({value: "0.450", unit: "kg"}) → gramos enteros. */
export function gramsFrom(weight: {
  value: string;
  unit: string;
}): number | null {
  const match = /^(\d{1,6})(?:\.(\d{1,6}))?$/.exec(weight.value.trim());
  if (!match) return null;
  const amount = Number(`${match[1]}.${match[2] ?? '0'}`);
  const factor: Record<string, number> = {
    g: 1,
    kg: 1000,
    lbs: 453.59237,
    oz: 28.349523125,
  };
  const per = factor[weight.unit];
  if (per === undefined) return null;
  return Math.round(amount * per);
}

/** Gramos → kilos en texto para la plataforma («0.550»). */
export function kilosText(grams: number): string {
  return (grams / 1000).toFixed(3);
}
