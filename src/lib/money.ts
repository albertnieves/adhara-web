/**
 * Dinero en céntimos enteros (EUR) y porcentajes en puntos básicos
 * (1 % = 100 pb). Las divisiones redondean al par más cercano (half-even)
 * con aritmética entera, sin coma flotante.
 */
export type Cents = number;
export type BasisPoints = number;

export const BASIS_POINTS = 10_000;

export function isNonNegativeCents(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

export function divideHalfEven(numerator: number, denominator: number): number {
  if (
    !Number.isSafeInteger(numerator) ||
    !Number.isSafeInteger(denominator) ||
    denominator <= 0
  ) {
    throw new RangeError('divideHalfEven requiere enteros y divisor positivo');
  }
  const n = BigInt(numerator);
  const d = BigInt(denominator);
  let quotient = n / d;
  const remainder = n - quotient * d;
  const twice = 2n * (remainder < 0n ? -remainder : remainder);
  if (twice > d || (twice === d && quotient % 2n !== 0n)) {
    quotient += n < 0n ? -1n : 1n;
  }
  return Number(quotient);
}

export function ratioBp(part: number, whole: number): BasisPoints {
  return divideHalfEven(part * BASIS_POINTS, whole);
}

export function grossToNet(grossCents: Cents, vatBp: BasisPoints): Cents {
  return divideHalfEven(grossCents * BASIS_POINTS, BASIS_POINTS + vatBp);
}

export function netToGross(netCents: Cents, vatBp: BasisPoints): Cents {
  return divideHalfEven(netCents * (BASIS_POINTS + vatBp), BASIS_POINTS);
}

const EUROS_PATTERN = /^(\d{1,7})(?:[.,](\d{1,2}))?$/;

/** «29,95», «29.95 €», «14,5€» o «17» → céntimos. Devuelve null si no es un importe válido. */
export function parseEuros(input: string): Cents | null {
  const match = EUROS_PATTERN.exec(input.replace(/€/g, '').trim());
  if (!match) return null;
  const [, euros = '0', decimals = ''] = match;
  return Number(euros) * 100 + Number(decimals.padEnd(2, '0'));
}
