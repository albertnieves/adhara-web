import { formatEuros } from '@/lib/money';

/*
 * Gastos de envío de los textos legales, a partir de las zonas activas de
 * Panel → Envíos (DECISIONS §136, §168, §172). Desde §172 el
 * precio depende del peso y del transportista que elige el cliente: el texto
 * lo dice y remite al importe que se ve antes de pagar. Sin ninguna zona
 * activa («Ofrecer el envío» apagado) no hay línea de gastos, y la de envío
 * gratis solo sale si alguna zona lo tiene.
 */

type Locale = 'es' | 'ca' | 'en';

export type LegalShippingZone = {
  zone: 'peninsula' | 'baleares';
  /** Envío gratis desde este importe de artículos; null: nunca. */
  freeFromCents: number | null;
};

const ZONES: Record<Locale, Record<LegalShippingZone['zone'], string>> = {
  es: { peninsula: 'en la península', baleares: 'en las Illes Balears' },
  ca: { peninsula: 'a la península', baleares: 'a les Illes Balears' },
  en: { peninsula: 'to mainland Spain', baleares: 'to the Balearic Islands' },
};
const AND: Record<Locale, string> = { es: ' y ', ca: ' i ', en: ' and ' };
const ORDER: readonly LegalShippingZone['zone'][] = ['peninsula', 'baleares'];

const COST: Record<Locale, (zones: string) => string> = {
  es: (zones) =>
    `según el peso del pedido y el transportista que elijas, ${zones}; el importe se muestra antes de pagar`,
  ca: (zones) =>
    `segons el pes de la comanda i el transportista que triïs, ${zones}; l’import es mostra abans de pagar`,
  en: (zones) =>
    `based on the weight of your order and the carrier you choose, ${zones}; the amount is shown before you pay`,
};
const FREE_NOTE: Record<Locale, string> = {
  es: ', con las opciones de envío que lo indican al pagar',
  ca: ', amb les opcions d’enviament que ho indiquen en pagar',
  en: ', with the delivery options marked as free at checkout',
};

function zonesIn(
  zones: readonly LegalShippingZone[],
  locale: Locale,
): string[] {
  return ORDER.filter((zone) => zones.some((z) => z.zone === zone)).map(
    (zone) => ZONES[locale][zone],
  );
}

/**
 * «según el peso del pedido y el transportista que elijas, en la península y
 * en las Illes Balears; …», o null sin zonas con envío.
 */
export function shippingCostText(
  zones: readonly LegalShippingZone[],
  locale: Locale,
): string | null {
  const names = zonesIn(zones, locale);
  return names.length > 0 ? COST[locale](names.join(AND[locale])) : null;
}

/** Desde cuánto es gratis en cada zona que lo tiene, o null si en ninguna. */
export function freeShippingText(
  zones: readonly LegalShippingZone[],
  locale: Locale,
): string | null {
  const parts = ORDER.flatMap((zone) => {
    const amount = zones.find((z) => z.zone === zone)?.freeFromCents ?? null;
    return amount === null
      ? []
      : [`${formatEuros(amount, locale)} ${ZONES[locale][zone]}`];
  });
  return parts.length > 0
    ? `${parts.join(AND[locale])}${FREE_NOTE[locale]}`
    : null;
}
