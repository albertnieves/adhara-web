import type { BasisPoints, Cents } from '@/lib/money';
import { BASIS_POINTS, divideHalfEven } from '@/lib/money';

/** Cambio masivo de PVP (por marca, línea o selección). Cada resultado se revisa con reviewPriceChange. */
export type PriceAdjustment =
  { kind: 'percent'; bp: BasisPoints } | { kind: 'fixed'; cents: Cents };

/** exact: sin redondeo; ends_95: x,95 más cercano; ends_00: euro entero más cercano. */
export type PriceEnding = 'exact' | 'ends_95' | 'ends_00';

function roundToEnding(cents: Cents, ending: PriceEnding): Cents {
  if (ending === 'exact') return cents;
  if (ending === 'ends_00')
    return Math.max(100, divideHalfEven(cents, 100) * 100);
  const candidate = Math.floor(cents / 100) * 100 + 95;
  // Ante empate se elige el importe menor.
  return [candidate - 100, candidate, candidate + 100]
    .filter((value) => value >= 95)
    .reduce((best, value) =>
      Math.abs(value - cents) < Math.abs(best - cents) ? value : best,
    );
}

/** Devuelve null si el resultado no es un precio positivo. */
export function adjustRetailPrice(
  currentGrossCents: Cents,
  adjustment: PriceAdjustment,
  ending: PriceEnding,
): Cents | null {
  const raw =
    adjustment.kind === 'percent'
      ? divideHalfEven(
          currentGrossCents * (BASIS_POINTS + adjustment.bp),
          BASIS_POINTS,
        )
      : currentGrossCents + adjustment.cents;
  if (raw <= 0) return null;
  return roundToEnding(raw, ending);
}
