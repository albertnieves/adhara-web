import { z } from 'zod';
import type { ShippingZone } from '@/modules/checkout/domain/shipping';
import { SHIPPING_ZONES } from '@/modules/checkout/domain/shipping';

/*
 * Opciones de envío de una cesta, como las devuelve web_shipping_quote: por
 * cada zona con «Ofrecer el envío», los servicios que llevan ese peso con su
 * precio con IVA y si cuentan para el envío gratis. Sin costes.
 */

export type ShippingOption = {
  serviceId: string;
  /** «Correos · Paq Estándar». */
  label: string;
  carrierName: string;
  /** Días laborables que se enseñan; null si el servicio no lo dice. */
  transitDays: number | null;
  priceCents: number;
  freeEligible: boolean;
};

export type ZoneOptions = {
  zone: ShippingZone;
  freeFromCents: number | null;
  options: ShippingOption[];
};

export type ShippingQuote = {
  /** null: algún formato aún no tiene peso de envío. */
  weightG: number | null;
  zones: ZoneOptions[];
};

export const EMPTY_SHIPPING_QUOTE: ShippingQuote = { weightG: null, zones: [] };

const quoteSchema = z.object({
  weight_g: z.number().int().positive().nullable(),
  zones: z.array(
    z.object({
      zone: z.enum(SHIPPING_ZONES),
      free_from_cents: z.number().int().positive().nullable(),
      options: z.array(
        z.object({
          service_id: z.uuid(),
          label: z.string(),
          carrier_name: z.string(),
          transit_days: z.number().int().positive().nullable(),
          price_cents: z.number().int().nonnegative(),
          free_eligible: z.boolean(),
        }),
      ),
    }),
  ),
});

/** Respuesta de web_shipping_quote → opciones; vacía si no se entiende. */
export function parseShippingQuote(data: unknown): ShippingQuote {
  const parsed = quoteSchema.safeParse(data);
  if (!parsed.success) return EMPTY_SHIPPING_QUOTE;
  return {
    weightG: parsed.data.weight_g,
    zones: parsed.data.zones.map((zone) => ({
      zone: zone.zone,
      freeFromCents: zone.free_from_cents,
      options: zone.options.map((option) => ({
        serviceId: option.service_id,
        label: option.label,
        carrierName: option.carrier_name,
        transitDays: option.transit_days,
        priceCents: option.price_cents,
        freeEligible: option.free_eligible,
      })),
    })),
  };
}

/** Opciones de una zona, o ninguna si la zona no tiene envío. */
export function zoneOptions(
  quote: ShippingQuote,
  zone: ShippingZone | null,
): ZoneOptions | null {
  return zone ? (quote.zones.find((z) => z.zone === zone) ?? null) : null;
}
