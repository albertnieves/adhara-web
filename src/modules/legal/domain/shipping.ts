import { formatEuros } from '@/lib/money';

/*
 * Gastos de envío de los textos legales, a partir de las tarifas activas de
 * Panel → Configuración → Tarifas de envío (DECISIONS §136, §168). Así los
 * textos dicen siempre lo mismo que el checkout: sin ninguna tarifa activa
 * («Ofrecer el envío» apagado) no hay línea de gastos, y la de envío gratis
 * solo sale si alguna zona lo tiene.
 */

type Locale = 'es' | 'ca' | 'en';

export type LegalShippingRate = {
  zone: 'peninsula' | 'baleares';
  priceCents: number;
  /** Envío gratis desde este importe de artículos; null: nunca. */
  freeFromCents: number | null;
};

const ZONES: Record<Locale, Record<LegalShippingRate['zone'], string>> = {
  es: { peninsula: 'en la península', baleares: 'en las Illes Balears' },
  ca: { peninsula: 'a la península', baleares: 'a les Illes Balears' },
  en: { peninsula: 'to mainland Spain', baleares: 'to the Balearic Islands' },
};
const AND: Record<Locale, string> = { es: ' y ', ca: ' i ', en: ' and ' };
const ORDER: readonly LegalShippingRate['zone'][] = ['peninsula', 'baleares'];

function describe(
  rates: readonly LegalShippingRate[],
  locale: Locale,
  cents: (rate: LegalShippingRate) => number | null,
): string | null {
  const parts = ORDER.flatMap((zone) => {
    const rate = rates.find((r) => r.zone === zone);
    const amount = rate ? cents(rate) : null;
    return amount === null
      ? []
      : [`${formatEuros(amount, locale)} ${ZONES[locale][zone]}`];
  });
  return parts.length > 0 ? parts.join(AND[locale]) : null;
}

/** «4 € en la península y 10 € en las Illes Balears», o null sin tarifas. */
export function shippingCostText(
  rates: readonly LegalShippingRate[],
  locale: Locale,
): string | null {
  return describe(rates, locale, (rate) => rate.priceCents);
}

/** Desde cuánto es gratis en cada zona que lo tiene, o null si en ninguna. */
export function freeShippingText(
  rates: readonly LegalShippingRate[],
  locale: Locale,
): string | null {
  return describe(rates, locale, (rate) => rate.freeFromCents);
}
