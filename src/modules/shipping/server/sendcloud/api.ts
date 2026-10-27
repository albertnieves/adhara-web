import 'server-only';
import { z } from 'zod';
import { decimalToCents, gramsFrom, kilosText } from '../../domain/price';
import type { SendcloudConfig } from './config';
import { SendcloudError, sendcloudBytes, sendcloudJson } from './client';

/*
 * Lo que la tienda usa de la API v3 de Sendcloud (documentación de
 * sendcloud.dev, especificaciones OpenAPI v3): opciones con su cotización,
 * crear y cancelar envíos, la etiqueta, recogidas y puntos del transportista.
 * Las respuestas se leen con zod y solo con los campos necesarios.
 */

export type Address = {
  name: string;
  companyName?: string;
  addressLine1: string;
  houseNumber?: string | null;
  addressLine2?: string | null;
  postalCode: string;
  city: string;
  country: 'ES';
  email?: string | null;
  phone?: string | null;
};

function address(a: Address) {
  return {
    name: a.name,
    ...(a.companyName && { company_name: a.companyName }),
    address_line_1: a.addressLine1,
    ...(a.houseNumber && { house_number: a.houseNumber }),
    ...(a.addressLine2 && { address_line_2: a.addressLine2 }),
    postal_code: a.postalCode,
    city: a.city,
    country_code: a.country,
    ...(a.email && { email: a.email }),
    ...(a.phone && { phone_number: a.phone }),
  };
}

export type Dimensions = {
  lengthCm: number;
  widthCm: number;
  heightCm: number;
};

function dimensions(d: Dimensions | null | undefined) {
  return d
    ? {
        dimensions: {
          length: String(d.lengthCm),
          width: String(d.widthCm),
          height: String(d.heightCm),
          unit: 'cm',
        },
      }
    : {};
}

// ---------------------------------------------------------------------------
// Opciones y cotizaciones
// ---------------------------------------------------------------------------

const weight = z.object({ value: z.string(), unit: z.string() });
const money = z.object({ value: z.string(), currency: z.string() });

const optionSchema = z.object({
  code: z.string().min(1).max(200),
  name: z.string().max(200).nullable().optional(),
  carrier: z.object({
    code: z.string().min(1).max(60),
    name: z.string().max(80),
  }),
  product: z
    .object({
      code: z.string().nullable().optional(),
      name: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  functionalities: z
    .object({
      first_mile: z.string().nullable().optional(),
      last_mile: z.string().nullable().optional(),
      dangerous_goods: z.boolean().nullable().optional(),
    })
    .passthrough()
    .nullable()
    .optional(),
  contract: z
    .object({ id: z.number().int().nullable().optional() })
    .nullable()
    .optional(),
  requirements: z
    .object({ is_service_point_required: z.boolean().nullable().optional() })
    .passthrough()
    .nullable()
    .optional(),
  quotes: z
    .array(
      z.object({
        weight: z.object({ min: weight, max: weight }).nullable().optional(),
        lead_time: z.number().nullable().optional(),
        price: z
          .object({ total: money.nullable().optional() })
          .nullable()
          .optional(),
      }),
    )
    .nullable()
    .optional(),
});

export type QuotedRate = {
  minWeightG: number;
  maxWeightG: number;
  costCents: number;
  leadTimeHours: number | null;
};

export type SendcloudOption = {
  code: string;
  name: string;
  carrierCode: string;
  carrierName: string;
  contractId: number | null;
  firstMile: string | null;
  lastMile: string | null;
  dangerousGoods: boolean | null;
  servicePointRequired: boolean;
  /** Tramos que cotizó, sin IVA. Vacío si no tiene precio para ese envío. */
  quotes: QuotedRate[];
};

const FIRST_MILES = new Set([
  'pickup',
  'dropoff',
  'pickup_dropoff',
  'fulfilment',
]);

function toOption(raw: z.infer<typeof optionSchema>): SendcloudOption {
  const quotes = (raw.quotes ?? []).flatMap((quote): QuotedRate[] => {
    const total = quote.price?.total;
    if (!total || total.currency !== 'EUR' || !quote.weight) return [];
    const cost = decimalToCents(total.value);
    const min = gramsFrom(quote.weight.min);
    const max = gramsFrom(quote.weight.max);
    if (cost === null || min === null || max === null) return [];
    return [
      {
        minWeightG: Math.max(1, min),
        maxWeightG: Math.max(1, max),
        costCents: cost,
        leadTimeHours:
          typeof quote.lead_time === 'number' && quote.lead_time >= 0
            ? Math.round(quote.lead_time)
            : null,
      },
    ];
  });
  const firstMile = raw.functionalities?.first_mile ?? null;
  return {
    code: raw.code,
    name: (raw.product?.name || raw.name || raw.code).slice(0, 120),
    carrierCode: raw.carrier.code,
    carrierName: raw.carrier.name || raw.carrier.code,
    contractId: raw.contract?.id ?? null,
    firstMile: firstMile && FIRST_MILES.has(firstMile) ? firstMile : null,
    lastMile: raw.functionalities?.last_mile ?? null,
    dangerousGoods: raw.functionalities?.dangerous_goods ?? null,
    servicePointRequired: raw.requirements?.is_service_point_required === true,
    quotes,
  };
}

/**
 * Opciones de la cuenta para un paquete de `weightG` gramos entre dos
 * direcciones, con su cotización (POST /shipping-options).
 */
export async function fetchShippingOptions(
  config: SendcloudConfig,
  input: {
    from: { postalCode: string; city?: string };
    to: { postalCode: string; city?: string; addressLine1?: string };
    weightG: number;
    dimensions?: Dimensions | null;
    shippingOptionCode?: string;
  },
): Promise<SendcloudOption[]> {
  const { data } = await sendcloudJson<{ data?: unknown }>(
    config,
    '/shipping-options',
    {
      method: 'POST',
      body: {
        from_address: {
          country_code: 'ES',
          postal_code: input.from.postalCode,
          ...(input.from.city && { city: input.from.city }),
        },
        to_address: {
          country_code: 'ES',
          postal_code: input.to.postalCode,
          ...(input.to.city && { city: input.to.city }),
          ...(input.to.addressLine1 && {
            address_line_1: input.to.addressLine1,
          }),
        },
        parcels: [
          {
            weight: { value: kilosText(input.weightG), unit: 'kg' },
            ...dimensions(input.dimensions),
          },
        ],
        ...(input.shippingOptionCode && {
          shipping_option_code: input.shippingOptionCode,
        }),
        calculate_quotes: true,
      },
    },
  );
  const list = z.array(z.unknown()).safeParse(data?.data ?? []);
  if (!list.success) return [];
  return list.data.flatMap((item) => {
    const parsed = optionSchema.safeParse(item);
    return parsed.success ? [toOption(parsed.data)] : [];
  });
}

// ---------------------------------------------------------------------------
// Envíos y etiquetas
// ---------------------------------------------------------------------------

const announced = z.object({
  data: z.object({
    id: z.string().min(1).max(100),
    carrier: z
      .object({ code: z.string(), name: z.string() })
      .nullable()
      .optional(),
    parcels: z
      .array(
        z.object({
          id: z.union([z.number().int(), z.string()]),
          tracking_number: z.string().nullable().optional(),
          tracking_url: z.string().nullable().optional(),
        }),
      )
      .min(1),
  }),
});

export type AnnouncedShipment = {
  shipmentId: string;
  parcelId: string;
  trackingNumber: string | null;
  trackingUrl: string | null;
  carrierCode: string | null;
  carrierName: string | null;
};

/**
 * Crea el envío y compra la etiqueta (POST /shipments/announce). Con
 * `externalReference` único por intento: repetirlo responde 409 y no compra
 * otra etiqueta.
 */
export async function announceShipment(
  config: SendcloudConfig,
  input: {
    from: Address;
    to: Address;
    shippingOptionCode: string;
    contractId: number | null;
    orderNumber: string;
    externalReference: string;
    totalOrderCents: number;
    weightG: number;
    dimensions?: Dimensions | null;
    items: {
      description: string;
      quantity: number;
      unitWeightG: number;
      unitPriceCents: number;
      sku?: string | null;
    }[];
  },
): Promise<AnnouncedShipment> {
  const euros = (cents: number) => (cents / 100).toFixed(2);
  const { data } = await sendcloudJson(config, '/shipments/announce', {
    method: 'POST',
    body: {
      label_details: { mime_type: 'application/pdf', dpi: 72 },
      from_address: address(input.from),
      to_address: address(input.to),
      ship_with: {
        type: 'shipping_option_code',
        properties: {
          shipping_option_code: input.shippingOptionCode,
          ...(input.contractId !== null && { contract_id: input.contractId }),
        },
      },
      order_number: input.orderNumber,
      external_reference_id: input.externalReference,
      total_order_price: {
        value: euros(input.totalOrderCents),
        currency: 'EUR',
      },
      parcels: [
        {
          weight: { value: kilosText(input.weightG), unit: 'kg' },
          ...dimensions(input.dimensions),
          parcel_items: input.items.map((item) => ({
            description: item.description.slice(0, 100),
            quantity: item.quantity,
            weight: { value: kilosText(item.unitWeightG), unit: 'kg' },
            price: { value: euros(item.unitPriceCents), currency: 'EUR' },
            ...(item.sku && { sku: item.sku }),
          })),
        },
      ],
    },
  });
  const parsed = announced.safeParse(data);
  if (!parsed.success)
    throw new SendcloudError(
      502,
      'Sendcloud no devolvió la etiqueta esperada.',
    );
  const parcel = parsed.data.data.parcels[0]!;
  const url = parcel.tracking_url?.trim() ?? '';
  return {
    shipmentId: parsed.data.data.id,
    parcelId: String(parcel.id),
    trackingNumber: parcel.tracking_number?.trim().slice(0, 120) || null,
    trackingUrl: url.startsWith('https://') ? url.slice(0, 1000) : null,
    carrierCode: parsed.data.data.carrier?.code ?? null,
    carrierName: parsed.data.data.carrier?.name ?? null,
  };
}

/** Cancela un envío anunciado (POST /shipments/{id}/cancel), si el transportista lo admite. */
export async function cancelShipment(
  config: SendcloudConfig,
  shipmentId: string,
): Promise<void> {
  await sendcloudJson(
    config,
    `/shipments/${encodeURIComponent(shipmentId)}/cancel`,
    {
      method: 'POST',
    },
  );
}

/** Etiqueta en PDF de un paquete (A6 para impresora de etiquetas o A4). */
export async function downloadLabel(
  config: SendcloudConfig,
  parcelId: string,
  paperSize: 'A4' | 'A6',
): Promise<ArrayBuffer> {
  return sendcloudBytes(
    config,
    `/parcels/${encodeURIComponent(parcelId)}/documents/label?paper_size=${paperSize}`,
    'application/pdf',
  );
}

// ---------------------------------------------------------------------------
// Recogidas y puntos del transportista
// ---------------------------------------------------------------------------

const pickupCreated = z.object({
  data: z.object({
    id: z.union([z.number().int(), z.string()]),
    status: z.string().nullable().optional(),
  }),
});

/** Pide una recogida puntual en la tienda (POST /pickups). */
export async function createPickup(
  config: SendcloudConfig,
  input: {
    carrierCode: string;
    contractId: number | null;
    address: Address;
    startAt: string;
    endAt: string;
    parcels: number;
    totalWeightG: number;
    reference: string;
    instructions?: string | null;
  },
): Promise<{ id: string; status: string | null }> {
  const total = { value: kilosText(input.totalWeightG), unit: 'kg' };
  const { data } = await sendcloudJson(config, '/pickups', {
    method: 'POST',
    body: {
      carrier_code: input.carrierCode,
      ...(input.contractId !== null && { contract_id: input.contractId }),
      address: address(input.address),
      time_slots: [{ start_at: input.startAt, end_at: input.endAt }],
      items: [
        {
          quantity: input.parcels,
          container_type: 'parcel',
          total_weight: total,
        },
      ],
      quantity: input.parcels,
      total_weight: total,
      reference: input.reference.slice(0, 100),
      ...(input.instructions && {
        special_instructions: input.instructions.slice(0, 200),
      }),
    },
  });
  const parsed = pickupCreated.safeParse(data);
  if (!parsed.success)
    throw new SendcloudError(502, 'Sendcloud no confirmó la recogida.');
  return {
    id: String(parsed.data.data.id),
    status: parsed.data.data.status ?? null,
  };
}

const openingTime = z.object({ start_time: z.string(), end_time: z.string() });
const servicePoint = z.object({
  id: z.union([z.number().int(), z.string()]),
  name: z.string(),
  carrier: z.object({ code: z.string(), name: z.string() }).passthrough(),
  carrier_service_point_id: z.string().nullable().optional(),
  general_shop_type: z.string().nullable().optional(),
  address: z.object({
    street: z.string().nullable().optional(),
    house_number: z.string().nullable().optional(),
    postal_code: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
  }),
  opening_times: z
    .record(z.string(), z.array(openingTime).nullable())
    .nullable()
    .optional(),
  distance: z.number().nullable().optional(),
});

export type ServicePoint = {
  id: string;
  carrierPointId: string | null;
  name: string;
  carrierName: string;
  kind: string | null;
  address: string;
  distanceM: number | null;
  /** Horario de hoy («09:00–14:00, 17:00–20:00»), o null si cierra. */
  today: string | null;
};

const WEEKDAYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

/**
 * Puntos del transportista cerca de la tienda (GET /service-points), para
 * dejar los paquetes en lugar de pedir una recogida.
 */
export async function listServicePoints(
  config: SendcloudConfig,
  input: {
    carrierCode: string;
    postalCode: string;
    city: string;
    street?: string;
    limit?: number;
  },
  now: Date = new Date(),
): Promise<ServicePoint[]> {
  const query = new URLSearchParams({
    country_code: 'ES',
    carrier_code: input.carrierCode,
    address_postal_code: input.postalCode,
    address_city: input.city,
    ...(input.street && { address_street: input.street }),
    radius: '5000',
    limit: String(input.limit ?? 8),
  });
  const { data } = await sendcloudJson<{ data?: { results?: unknown } }>(
    config,
    `/service-points?${query.toString()}`,
  );
  const results = z.array(z.unknown()).safeParse(data?.data?.results ?? []);
  if (!results.success) return [];
  const weekday =
    WEEKDAYS[
      new Date(
        now.toLocaleString('en-US', { timeZone: 'Europe/Madrid' }),
      ).getDay()
    ]!;
  return results.data.flatMap((item): ServicePoint[] => {
    const parsed = servicePoint.safeParse(item);
    if (!parsed.success) return [];
    const p = parsed.data;
    const hours = p.opening_times?.[weekday];
    return [
      {
        id: String(p.id),
        carrierPointId: p.carrier_service_point_id ?? null,
        name: p.name.slice(0, 120),
        carrierName: p.carrier.name,
        kind: p.general_shop_type ?? null,
        address: [
          [p.address.street, p.address.house_number].filter(Boolean).join(' '),
          [p.address.postal_code, p.address.city].filter(Boolean).join(' '),
        ]
          .filter(Boolean)
          .join(', ')
          .slice(0, 200),
        distanceM: p.distance ?? null,
        today:
          hours && hours.length > 0
            ? hours.map((h) => `${h.start_time}–${h.end_time}`).join(', ')
            : null,
      },
    ];
  });
}
