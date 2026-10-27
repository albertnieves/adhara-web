import 'server-only';
import type { ShippingZone } from '@/modules/checkout/domain/shipping';
import { SHIPPING_ZONES } from '@/modules/checkout/domain/shipping';
import type { RateEntry } from '../domain/brackets';
import { mergeBrackets } from '../domain/brackets';
import type { SendcloudOption } from './sendcloud/api';
import { fetchShippingOptions } from './sendcloud/api';
import type { SendcloudConfig } from './sendcloud/config';

/*
 * «Actualizar tarifas» (DECISIONS §172): cotiza en la plataforma desde la
 * tienda hasta varios códigos postales de referencia de cada zona y recorre los
 * tramos de peso de cada opción (cada respuesta dice hasta dónde llega el tramo
 * del peso pedido; se pregunta por el gramo siguiente) hasta el peso máximo.
 * Un tramo entra con el coste más alto de las referencias y solo si todas lo
 * cotizan. Fuera: las opciones que entregan en un punto o una taquilla (la
 * tienda solo vende entrega a domicilio) y las que no tienen precio.
 */

export const REFERENCE_POSTCODES: Readonly<
  Record<ShippingZone, readonly { postalCode: string; city: string }[]>
> = {
  peninsula: [
    { postalCode: '28001', city: 'Madrid' },
    { postalCode: '41001', city: 'Sevilla' },
    { postalCode: '15001', city: 'A Coruña' },
  ],
  baleares: [
    { postalCode: '07001', city: 'Palma' },
    { postalCode: '07701', city: 'Maó' },
    { postalCode: '07800', city: 'Eivissa' },
  ],
};

const MAX_STEPS = 40;

type Fetcher = typeof fetchShippingOptions;

type Seen = { option: SendcloudOption; entries: RateEntry[] };

async function walk(
  config: SendcloudConfig,
  fetcher: Fetcher,
  from: { postalCode: string; city: string },
  to: { postalCode: string; city: string },
  maxWeightG: number,
): Promise<Map<string, Seen>> {
  const seen = new Map<string, Seen>();
  let weight = 1;
  for (let step = 0; step < MAX_STEPS && weight <= maxWeightG; step += 1) {
    const options = await fetcher(config, { from, to, weightG: weight });
    let next = Number.POSITIVE_INFINITY;
    for (const option of options) {
      const quote = option.quotes.find(
        (q) => q.minWeightG <= weight && weight <= q.maxWeightG,
      );
      if (!quote) continue;
      const entry = seen.get(option.code) ?? { option, entries: [] };
      if (
        !entry.entries.some(
          (e) =>
            e.minWeightG === quote.minWeightG &&
            e.maxWeightG === quote.maxWeightG,
        )
      )
        entry.entries.push(quote);
      seen.set(option.code, entry);
      next = Math.min(next, quote.maxWeightG + 1);
    }
    if (!Number.isFinite(next) || next <= weight) break;
    weight = next;
  }
  return seen;
}

export type SyncService = {
  code: string;
  carrier_code: string;
  carrier_name: string;
  name: string;
  contract_id: number | null;
  first_mile: string | null;
  dangerous_goods: boolean | null;
  rates: {
    zone: ShippingZone;
    min_weight_g: number;
    max_weight_g: number;
    cost_cents: number;
    lead_time_hours: number | null;
  }[];
};

/** Servicios con sus tramos por zona, listos para admin_shipping_sync. */
export async function collectServiceRates(
  config: SendcloudConfig,
  from: { postalCode: string; city: string },
  maxWeightG: number,
  fetcher: Fetcher = fetchShippingOptions,
): Promise<SyncService[]> {
  const walks = await Promise.all(
    SHIPPING_ZONES.flatMap((zone) =>
      REFERENCE_POSTCODES[zone].map(async (to) => ({
        zone,
        seen: await walk(config, fetcher, from, to, maxWeightG),
      })),
    ),
  );
  const options = new Map<string, SendcloudOption>();
  for (const { seen } of walks)
    for (const [code, entry] of seen)
      if (!options.has(code)) options.set(code, entry.option);

  const services: SyncService[] = [];
  for (const [code, option] of options) {
    if (
      option.servicePointRequired ||
      (option.lastMile !== null && option.lastMile !== 'home_delivery')
    )
      continue;
    const rates = SHIPPING_ZONES.flatMap((zone) => {
      const sources = walks
        .filter((w) => w.zone === zone)
        .map((w) => w.seen.get(code)?.entries ?? []);
      return mergeBrackets(sources, maxWeightG).map((rate) => ({
        zone,
        min_weight_g: rate.minWeightG,
        max_weight_g: rate.maxWeightG,
        cost_cents: rate.costCents,
        lead_time_hours: rate.leadTimeHours,
      }));
    });
    if (rates.length === 0) continue;
    services.push({
      code,
      carrier_code: option.carrierCode,
      carrier_name: option.carrierName,
      name: option.name,
      contract_id: option.contractId,
      first_mile: option.firstMile,
      dangerous_goods: option.dangerousGoods,
      rates,
    });
  }
  return services.sort((a, b) => a.code.localeCompare(b.code));
}
