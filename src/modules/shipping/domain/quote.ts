import { z } from 'zod';
import type { ShippingZone } from '@/modules/checkout/domain/shipping';
import { SHIPPING_ZONES } from '@/modules/checkout/domain/shipping';

/*
 * Opciones de envío de una cesta, como las devuelve web_shipping_quote: por
 * cada zona con «Ofrecer el envío», los servicios que llevan ese peso con su
 * precio con IVA y si cuentan para el envío gratis, y la promoción de envío
 * gratis que vale ahora en la zona (DECISIONS §189). Sin costes.
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

/** Envío gratis temporal de una zona: desde cuánto (0: todo pedido) y hasta cuándo. */
export type ShippingPromotionOffer = {
  minItemsCents: number;
  endsAt: string;
};

export type ZoneOptions = {
  zone: ShippingZone;
  /** Envío gratis permanente de la zona; null si no tiene. */
  freeFromCents: number | null;
  /** Solo si baja el mínimo de la zona; null si no hay ninguna viva. */
  promotion: ShippingPromotionOffer | null;
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
      promotion: z
        .object({
          min_items_cents: z.number().int().nonnegative(),
          ends_at: z.string(),
        })
        .nullable()
        .optional(),
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
      promotion: zone.promotion
        ? {
            minItemsCents: zone.promotion.min_items_cents,
            endsAt: zone.promotion.ends_at,
          }
        : null,
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

/**
 * Desde cuánto se paga por los artículos (ya con el descuento) para que el
 * envío salga gratis en la zona: el mínimo más bajo entre el de la zona y el
 * de su promoción (0: cualquier pedido); null si no hay ninguno. Es lo mismo
 * que mira web_order_create.
 */
export function freeShippingFrom(zone: ZoneOptions | null): number | null {
  if (!zone) return null;
  const promotion = zone.promotion?.minItemsCents ?? null;
  if (promotion === null) return zone.freeFromCents;
  return zone.freeFromCents === null
    ? promotion
    : Math.min(promotion, zone.freeFromCents);
}

/** Promoción de envío gratis que enseña la cesta, con las zonas en que vale. */
export type FreeShippingOffer = ShippingPromotionOffer & {
  zones: ShippingZone[];
  /** Vale en todas las zonas con envío para esta cesta. */
  everywhere: boolean;
  /** Todos los servicios que cobran algo cuentan para él (si no, se avisa). */
  allServices: boolean;
};

/**
 * Promociones de envío gratis para la cesta: una por mínimo y final, con sus
 * zonas, solo donde algún servicio que cuenta para el envío gratis lleva este
 * pedido y cobraría algo. Sin envío posible (falta un peso, ninguna zona), no
 * hay ninguna: no se anuncia un envío que no se puede elegir.
 */
export function freeShippingOffers(quote: ShippingQuote): FreeShippingOffer[] {
  const shippable = quote.zones.filter((zone) => zone.options.length > 0);
  const offers: FreeShippingOffer[] = [];
  for (const zone of shippable) {
    const promotion = zone.promotion;
    if (
      !promotion ||
      !zone.options.some(
        (option) => option.freeEligible && option.priceCents > 0,
      )
    )
      continue;
    const same = offers.find(
      (offer) =>
        offer.minItemsCents === promotion.minItemsCents &&
        offer.endsAt === promotion.endsAt,
    );
    const allServices = zone.options.every(
      (option) => option.freeEligible || option.priceCents === 0,
    );
    if (same) {
      same.zones.push(zone.zone);
      same.allServices &&= allServices;
    } else
      offers.push({
        ...promotion,
        zones: [zone.zone],
        everywhere: false,
        allServices,
      });
  }
  return offers.map((offer) => ({
    ...offer,
    everywhere: offer.zones.length === shippable.length,
  }));
}
