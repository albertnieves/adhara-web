import type { Cents } from '@/lib/money';

/**
 * Directiva Ómnibus (art. 20 Ley 7/1996 en España): al anunciar una rebaja,
 * el precio anterior mostrado es el más bajo aplicado en los 30 días previos.
 * Excepciones (rebajas progresivas, perecederos) pendientes de asesoría.
 */
export const OMNIBUS_WINDOW_DAYS = 30;

const DAY_MS = 86_400_000;

/** Periodo en que un PVP estuvo vigente; `to` exclusivo, null si sigue vigente. */
export type PricePeriod = {
  retailGrossCents: Cents;
  from: Date;
  to: Date | null;
};

export function lowestPriceInWindow(
  history: readonly PricePeriod[],
  reductionAt: Date,
  windowDays: number = OMNIBUS_WINDOW_DAYS,
): Cents | null {
  const end = reductionAt.getTime();
  const start = end - windowDays * DAY_MS;
  let lowest: Cents | null = null;
  for (const period of history) {
    const from = period.from.getTime();
    const to = period.to?.getTime() ?? Number.POSITIVE_INFINITY;
    if (from < end && to > start) {
      lowest =
        lowest === null
          ? period.retailGrossCents
          : Math.min(lowest, period.retailGrossCents);
    }
  }
  return lowest;
}
