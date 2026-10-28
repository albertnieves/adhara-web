'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { z } from 'zod';
import { parseEuros } from '@/lib/money';
import type { ActionState } from '@/modules/admin';
import { describeDbError, fail, ok } from '@/modules/admin';
import { isAllowed } from '@/modules/auth';
import { requirePermission } from '@/modules/auth/server';
import {
  SHIPPING_ZONE_LABELS,
  SHIPPING_ZONES,
} from '@/modules/checkout/domain/shipping';
import { sendOrderEmails } from '@/modules/mail/server';
import { bracketFor, bracketsFromLimits } from '../domain/brackets';
import { SHIPPING_ERRORS } from '../domain/labels';
import { madridInstant } from '../domain/pickup';
import { shippingPrice } from '../domain/price';
import {
  getShippingSettings,
  listShippingServices,
  listShippingZones,
} from './admin';
import type { ServicePoint } from './sendcloud/api';
import {
  announceShipment,
  cancelShipment,
  createPickup,
  fetchShippingOptions,
  listServicePoints,
} from './sendcloud/api';
import { SendcloudError } from './sendcloud/client';
import { sendcloudConfig } from './sendcloud/config';
import { collectServiceRates } from './sync';

/*
 * Acciones de los envíos (DECISIONS §171–176). Cada una pide el permiso en el
 * servidor y la función SQL lo vuelve a comprobar con MFA: configuración con
 * settings.manage, pesos con catalog.edit y la ficha del pedido con
 * orders.fulfill (y customers.view para la dirección de la etiqueta). Las
 * claves de la plataforma solo se usan aquí, nunca en el navegador.
 */

type DbError = { message?: string; code?: string } | null | undefined;

function describe(error: DbError): string {
  const known = error?.message ? SHIPPING_ERRORS[error.message] : undefined;
  return known ?? describeDbError(error);
}

function platformError(error: unknown): string {
  if (error instanceof SendcloudError) return `Sendcloud: ${error.message}`;
  console.error('[envios]', error);
  return 'No se pudo hablar con la plataforma de envíos. Inténtalo de nuevo.';
}

function refresh() {
  revalidatePath('/admin/envios', 'layout');
  revalidatePath('/admin/pedidos', 'layout');
}

const text = (max: number) => z.string().trim().max(max);
const grams = z.coerce.number().int().min(1).max(100000);

// ---------------------------------------------------------------------------
// Envíos → Transportistas y tarifas, Remitente y zonas (settings.manage)
// ---------------------------------------------------------------------------

const settingsInput = z.object({
  senderName: text(80).min(1, 'Indica el nombre del remitente.'),
  senderContact: text(80),
  addressLine1: text(200).min(1, 'Indica la dirección de la tienda.'),
  houseNumber: text(20),
  addressLine2: text(200),
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{5}$/, 'El código postal tiene cinco cifras.'),
  city: text(120).min(1, 'Indica la población.'),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9 +().-]{6,30}$/, 'El teléfono no es válido.'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email('El email no es válido.')),
  packagingWeightG: z.coerce
    .number({ message: 'Indica el peso del embalaje en gramos.' })
    .int('El embalaje va en gramos enteros.')
    .min(0)
    .max(5000, 'El embalaje no pasa de 5.000 g.'),
  maxWeightG: z.coerce
    .number()
    .int()
    .min(500)
    .max(30000, 'El máximo va de 500 a 30.000 g.'),
  parcelLength: z.string().trim(),
  parcelWidth: z.string().trim(),
  parcelHeight: z.string().trim(),
  pickupStart: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Indica la hora de inicio de las recogidas.'),
  pickupEnd: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Indica la hora de fin de las recogidas.'),
  vatPercent: z.string().trim(),
});

function cm(value: string): number | null {
  if (!value) return null;
  const n = Number(value.replace(',', '.'));
  return Number.isInteger(n) && n >= 1 && n <= 200 ? n : Number.NaN;
}

export async function saveShippingSettings(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { supabase } = await requirePermission('settings.manage');
  const field = (name: string) => String(form.get(name) ?? '');
  const parsed = settingsInput.safeParse({
    senderName: field('senderName'),
    senderContact: field('senderContact'),
    addressLine1: field('addressLine1'),
    houseNumber: field('houseNumber'),
    addressLine2: field('addressLine2'),
    postalCode: field('postalCode'),
    city: field('city'),
    phone: field('phone'),
    email: field('email'),
    packagingWeightG: field('packagingWeightG'),
    maxWeightG: field('maxWeightG') || '10000',
    parcelLength: field('parcelLength'),
    parcelWidth: field('parcelWidth'),
    parcelHeight: field('parcelHeight'),
    pickupStart: field('pickupStart'),
    pickupEnd: field('pickupEnd'),
    vatPercent: field('vatPercent') || '21',
  });
  if (!parsed.success)
    return fail(parsed.error.issues[0]?.message ?? 'Revisa los datos.');
  const s = parsed.data;
  const sizes = [cm(s.parcelLength), cm(s.parcelWidth), cm(s.parcelHeight)];
  if (
    sizes.some((v) => Number.isNaN(v)) ||
    (sizes.some((v) => v === null) && sizes.some((v) => v !== null))
  )
    return fail(
      'Las medidas de la caja van en centímetros enteros, las tres o ninguna.',
    );
  const vat = Number(s.vatPercent.replace(',', '.'));
  if (!Number.isFinite(vat) || vat < 0 || vat > 30)
    return fail('El IVA del envío va de 0 a 30 %.');
  const { error } = await supabase.rpc('admin_save_shipping_settings', {
    p_settings: {
      sender_name: s.senderName,
      sender_contact: s.senderContact || null,
      address_line1: s.addressLine1,
      house_number: s.houseNumber || null,
      address_line2: s.addressLine2 || null,
      postal_code: s.postalCode,
      city: s.city,
      phone: s.phone,
      email: s.email,
      packaging_weight_g: s.packagingWeightG,
      max_weight_g: s.maxWeightG,
      parcel_length_cm: sizes[0],
      parcel_width_cm: sizes[1],
      parcel_height_cm: sizes[2],
      pickup_start: s.pickupStart,
      pickup_end: s.pickupEnd,
      shipping_vat_bps: Math.round(vat * 100),
    },
  });
  if (error) return fail(describe(error));
  refresh();
  return ok('Ajustes de envío guardados.');
}

const zoneInput = z.object({
  zone: z.enum(SHIPPING_ZONES),
  freeFrom: z.string().trim(),
  active: z.boolean(),
});

export async function saveShippingZone(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { supabase } = await requirePermission('settings.manage');
  const parsed = zoneInput.safeParse({
    zone: form.get('zone'),
    freeFrom: form.get('freeFrom') ?? '',
    active: form.get('active') === 'on',
  });
  if (!parsed.success) return fail('Revisa los datos de la zona.');
  const freeFrom = parsed.data.freeFrom
    ? parseEuros(parsed.data.freeFrom)
    : null;
  if (parsed.data.freeFrom && (freeFrom === null || freeFrom < 1))
    return fail(
      'El importe para el envío gratis no es válido (por ejemplo, 60).',
    );
  const { error } = await supabase.rpc('admin_save_shipping_zone', {
    p_zone: parsed.data.zone,
    // La función acepta null (sin envío gratis); el tipo generado no lo refleja.
    p_free_from_cents: freeFrom as number,
    p_active: parsed.data.active,
  });
  if (error) return fail(describe(error));
  refresh();
  return ok(
    `${SHIPPING_ZONE_LABELS[parsed.data.zone]}: ${parsed.data.active ? 'envío activo' : 'envío apagado'}.`,
  );
}

/** «Actualizar tarifas»: servicios y tramos de la plataforma con su coste real. */
const toggleInput = z.object({
  id: z.uuid(),
  active: z.enum(['on', 'off']),
});

/**
 * «Encender» o «Apagar» en la lista de servicios: lo guarda con los mismos
 * valores que tiene y solo cambia si se ofrece. La base exige tramos en cada
 * zona para encenderlo y lo deja en la auditoría (admin_save_shipping_service).
 */
export async function toggleShippingService(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { supabase } = await requirePermission('settings.manage');
  const parsed = toggleInput.safeParse({
    id: form.get('id'),
    active: form.get('active'),
  });
  if (!parsed.success) return fail('Ese servicio ya no existe.');
  const active = parsed.data.active === 'on';
  const service = (await listShippingServices(supabase)).find(
    (s) => s.id === parsed.data.id,
  );
  if (!service) return fail('Ese servicio ya no existe.');
  if (service.active !== active) {
    const { error } = await supabase.rpc('admin_save_shipping_service', {
      p_id: service.id,
      p_service: {
        carrier_name: service.carrierName,
        name: service.name,
        transit_days: service.transitDays,
        surcharge_cents: service.surchargeCents,
        free_eligible: service.freeEligible,
        active,
        zones: service.zones,
        position: service.position,
        tracking_url_template: service.trackingUrlTemplate,
        pickup_phone: service.pickupPhone,
      },
    });
    if (error) return fail(describe(error));
  }
  refresh();
  if (!active)
    return ok(`${service.label}: apagado. La tienda ya no lo ofrece.`);
  // Encendido, pero la tienda solo lo enseña en las zonas con envío.
  const zones = await listShippingZones(supabase);
  const closed = service.zones.filter(
    (zone) => !zones.find((z) => z.zone === zone)?.active,
  );
  return ok(
    closed.length > 0
      ? `${service.label}: encendido. Para que salga al pagar, marca «Ofrecer el envío» en ${closed
          .map((zone) => SHIPPING_ZONE_LABELS[zone])
          .join(' y ')}.`
      : `${service.label}: encendido. Ya sale al pagar si los formatos de la cesta están pesados.`,
  );
}

export async function syncSendcloudServices(): Promise<ActionState> {
  const { supabase } = await requirePermission('settings.manage');
  const config = sendcloudConfig();
  if (!config)
    return fail(
      'Falta conectar Sendcloud (claves de la integración en Vercel).',
    );
  const settings = await getShippingSettings(supabase);
  if (!settings)
    return fail(
      'Guarda antes el remitente: las tarifas se cotizan desde la tienda.',
    );
  let services;
  try {
    services = await collectServiceRates(
      config,
      { postalCode: settings.postalCode, city: settings.city },
      settings.maxWeightG,
    );
  } catch (error) {
    return fail(platformError(error));
  }
  const { data, error } = await supabase.rpc('admin_shipping_sync', {
    p_provider: 'sendcloud',
    p_services: services,
  });
  if (error) return fail(describe(error));
  const result = data as { created: number; updated: number; disabled: number };
  refresh();
  return ok(
    `Tarifas actualizadas: ${services.length} servicios con precio (${result.created} nuevos, que entran apagados; ${result.disabled} apagados porque la plataforma ya no los ofrece).`,
  );
}

const serviceInput = z.object({
  id: z.union([z.uuid(), z.literal('')]),
  carrierName: text(80),
  name: text(120).min(1, 'Indica el nombre que verá el cliente.'),
  transitDays: z.string().trim(),
  surcharge: z.string().trim(),
  freeEligible: z.boolean(),
  active: z.boolean(),
  zones: z.array(z.enum(SHIPPING_ZONES)),
  position: z.string().trim(),
  trackingUrlTemplate: text(500),
  pickupPhone: text(30),
});

export async function saveShippingService(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { supabase } = await requirePermission('settings.manage');
  const parsed = serviceInput.safeParse({
    id: form.get('id') ?? '',
    carrierName: form.get('carrierName') ?? '',
    name: form.get('name') ?? '',
    transitDays: form.get('transitDays') ?? '',
    surcharge: form.get('surcharge') ?? '',
    freeEligible: form.get('freeEligible') === 'on',
    active: form.get('active') === 'on',
    zones: form.getAll('zones'),
    position: form.get('position') ?? '',
    trackingUrlTemplate: form.get('trackingUrlTemplate') ?? '',
    pickupPhone: form.get('pickupPhone') ?? '',
  });
  if (!parsed.success)
    return fail(parsed.error.issues[0]?.message ?? 'Revisa el servicio.');
  const s = parsed.data;
  if (!s.id && !s.carrierName) return fail('Indica el transportista.');
  const days = s.transitDays ? Number(s.transitDays) : null;
  if (days !== null && (!Number.isInteger(days) || days < 1 || days > 30))
    return fail('El plazo va en días laborables, de 1 a 30.');
  const surcharge = s.surcharge ? parseEuros(s.surcharge) : 0;
  if (surcharge === null || surcharge > 10000)
    return fail('El recargo no es válido (por ejemplo, 0,50).');
  if (
    s.trackingUrlTemplate &&
    (!s.trackingUrlTemplate.startsWith('https://') ||
      !s.trackingUrlTemplate.includes('{tracking}'))
  )
    return fail(
      'El enlace de seguimiento empieza por https:// y lleva {tracking} donde va el número.',
    );
  if (s.pickupPhone && !/^[0-9 +().-]{6,30}$/.test(s.pickupPhone))
    return fail('El teléfono de recogidas no es válido.');
  const { error } = await supabase.rpc('admin_save_shipping_service', {
    p_id: (s.id || null) as string,
    p_service: {
      carrier_name: s.carrierName || null,
      name: s.name,
      transit_days: days,
      surcharge_cents: surcharge,
      free_eligible: s.freeEligible,
      active: s.active,
      zones: s.zones,
      position: s.position ? Number(s.position) || 0 : undefined,
      tracking_url_template: s.trackingUrlTemplate || null,
      pickup_phone: s.pickupPhone || null,
    },
  });
  if (error) return fail(describe(error));
  refresh();
  return ok(
    s.id
      ? `Servicio guardado${s.active ? ' y activo' : ''}.`
      : 'Servicio creado. Añade sus tramos de peso para poder activarlo.',
  );
}

export async function saveServiceRates(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { supabase, role } = await requirePermission('settings.manage');
  if (!isAllowed({ role, aal: 'aal2' }, 'pricing.view_cost'))
    return fail('Los tramos son costes: hace falta el permiso de costes.');
  const id = z.uuid().safeParse(form.get('serviceId'));
  const zone = z.enum(SHIPPING_ZONES).safeParse(form.get('zone'));
  if (!id.success || !zone.success) return fail('Acción no válida.');
  const limits = form.getAll('upTo').map((v) => String(v).trim());
  const costs = form.getAll('cost').map((v) => String(v).trim());
  const rows: { upToG: number; costCents: number }[] = [];
  for (const [index, limit] of limits.entries()) {
    const cost = costs[index] ?? '';
    if (!limit && !cost) continue;
    const upTo = Number(limit);
    const cents = parseEuros(cost);
    if (!Number.isInteger(upTo) || cents === null)
      return fail(
        `Revisa el tramo ${index + 1}: peso en gramos y coste en euros (por ejemplo, 1000 y 4,20).`,
      );
    rows.push({ upToG: upTo, costCents: cents });
  }
  const brackets = bracketsFromLimits(rows);
  if (!brackets.ok) return fail(brackets.reason);
  const { error } = await supabase.rpc('admin_save_shipping_service_rates', {
    p_service_id: id.data,
    p_zone: zone.data,
    p_rates: brackets.rates.map((r) => ({
      min_weight_g: r.minWeightG,
      max_weight_g: r.maxWeightG,
      cost_cents: r.costCents,
    })),
  });
  if (error) return fail(describe(error));
  refresh();
  return ok(
    `${SHIPPING_ZONE_LABELS[zone.data]}: ${brackets.rates.length} tramos guardados.`,
  );
}

// ---------------------------------------------------------------------------
// Envíos → Pesos de los formatos (catalog.edit)
// ---------------------------------------------------------------------------

export async function saveVariantWeights(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { supabase } = await requirePermission('catalog.edit');
  const items: { variant_id: string; weight_g: number | null }[] = [];
  for (const [key, value] of form.entries()) {
    const match = /^weight:([0-9a-f-]{36})$/.exec(key);
    if (!match || !z.uuid().safeParse(match[1]).success) continue;
    const raw = String(value).trim();
    if (raw === String(form.get(`previous:${match[1]}`) ?? '').trim()) continue;
    if (!raw) {
      items.push({ variant_id: match[1]!, weight_g: null });
      continue;
    }
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1 || n > 30000)
      return fail('Cada peso va en gramos enteros, entre 1 y 30.000.');
    items.push({ variant_id: match[1]!, weight_g: n });
  }
  if (items.length === 0) return ok('No había cambios.');
  if (items.length > 500)
    return fail('Guarda como mucho 500 pesos de una vez.');
  const { data, error } = await supabase.rpc('admin_save_variant_weights', {
    p_items: items,
  });
  if (error) return fail(describe(error));
  revalidatePath('/admin/envios/pesos');
  return ok(`${data} ${data === 1 ? 'peso guardado' : 'pesos guardados'}.`);
}

// ---------------------------------------------------------------------------
// Ficha del pedido (orders.fulfill)
// ---------------------------------------------------------------------------

type OrderForLabel = {
  id: string;
  number: number;
  status: string;
  fulfillment: string;
  totalCents: number;
  weightG: number | null;
  serviceId: string | null;
  contact: {
    fullName: string;
    email: string;
    phone: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    postalCode: string | null;
    city: string | null;
  };
  lines: {
    description: string;
    quantity: number;
    unitWeightG: number;
    unitPriceCents: number;
    sku: string | null;
  }[];
};

async function loadOrderForLabel(
  supabase: Awaited<ReturnType<typeof requirePermission>>['supabase'],
  orderId: string,
): Promise<OrderForLabel | null> {
  const [order, contact, lines] = await Promise.all([
    supabase
      .from('orders')
      .select(
        'id, number, status, fulfillment, total_cents, shipping_weight_g, shipping_service_id',
      )
      .eq('id', orderId)
      .maybeSingle(),
    supabase
      .from('order_contacts')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle(),
    supabase
      .from('order_lines')
      .select(
        'variant_id, brand_name, product_name, size_ml, variant_label, quantity, unit_price_cents, sku',
      )
      .eq('order_id', orderId),
  ]);
  if (
    order.error ||
    contact.error ||
    lines.error ||
    !order.data ||
    !contact.data
  )
    return null;
  const ids = (lines.data ?? []).map((l) => l.variant_id);
  const weights = new Map<string, number>();
  if (ids.length > 0) {
    const { data } = await supabase
      .from('product_variants')
      .select('id, shipping_weight_g')
      .in('id', ids);
    for (const v of data ?? [])
      if (v.shipping_weight_g) weights.set(v.id, v.shipping_weight_g);
  }
  return {
    id: order.data.id,
    number: order.data.number,
    status: order.data.status,
    fulfillment: order.data.fulfillment,
    totalCents: order.data.total_cents,
    weightG: order.data.shipping_weight_g,
    serviceId: order.data.shipping_service_id,
    contact: {
      fullName: contact.data.full_name,
      email: contact.data.email,
      phone: contact.data.phone,
      addressLine1: contact.data.address_line1,
      addressLine2: contact.data.address_line2,
      postalCode: contact.data.postal_code,
      city: contact.data.city,
    },
    lines: (lines.data ?? []).map((l) => ({
      description: [
        l.brand_name,
        l.product_name,
        l.variant_label ?? (l.size_ml ? `${l.size_ml} ml` : null),
      ]
        .filter(Boolean)
        .join(' '),
      quantity: l.quantity,
      unitWeightG: weights.get(l.variant_id) ?? 1,
      unitPriceCents: l.unit_price_cents,
      sku: l.sku,
    })),
  };
}

export type LiveQuote =
  | {
      status: 'ok';
      options: {
        code: string;
        carrierCode: string;
        carrierName: string;
        name: string;
        contractId: number | null;
        leadTimeHours: number | null;
        /** Sin IVA; null sin permiso de costes. */
        costCents: number | null;
        /** Con el IVA del envío; null sin permiso de costes. */
        costWithVatCents: number | null;
        firstMile: string | null;
        dangerousGoods: boolean | null;
      }[];
    }
  | { status: 'error'; message: string };

/**
 * «Ver tarifas reales»: lo que cobra ahora la plataforma por este paquete a
 * esta dirección, con todos los servicios de la cuenta.
 */
export async function quoteOrderShipping(
  orderId: string,
  weightG: number,
): Promise<LiveQuote> {
  const staff = await requirePermission('orders.fulfill');
  const session = { role: staff.role, aal: 'aal2' as const };
  if (!isAllowed(session, 'customers.view'))
    return {
      status: 'error',
      message: 'Hace falta el permiso de clientes para la dirección.',
    };
  if (!z.uuid().safeParse(orderId).success || !grams.safeParse(weightG).success)
    return { status: 'error', message: 'Revisa el peso del paquete.' };
  const config = sendcloudConfig();
  if (!config)
    return { status: 'error', message: 'Sendcloud no está conectado.' };
  const [order, settings] = await Promise.all([
    loadOrderForLabel(staff.supabase, orderId),
    getShippingSettings(staff.supabase),
  ]);
  if (!order || !order.contact.postalCode)
    return {
      status: 'error',
      message: 'No se encontró la dirección del pedido.',
    };
  if (!settings)
    return {
      status: 'error',
      message: 'Faltan los ajustes de envío (remitente).',
    };
  const withCosts = isAllowed(session, 'pricing.view_cost');
  try {
    const options = await fetchShippingOptions(config, {
      from: { postalCode: settings.postalCode, city: settings.city },
      to: {
        postalCode: order.contact.postalCode,
        city: order.contact.city ?? undefined,
        addressLine1: order.contact.addressLine1 ?? undefined,
      },
      weightG,
      dimensions: settings.parcel,
    });
    return {
      status: 'ok',
      options: options
        .filter(
          (o) =>
            !o.servicePointRequired &&
            (o.lastMile === null || o.lastMile === 'home_delivery'),
        )
        .flatMap((o) => {
          const quote = bracketFor(o.quotes, weightG);
          if (!quote) return [];
          return [
            {
              code: o.code,
              carrierCode: o.carrierCode,
              carrierName: o.carrierName,
              name: o.name,
              contractId: o.contractId,
              leadTimeHours: quote.leadTimeHours,
              costCents: withCosts ? quote.costCents : null,
              costWithVatCents: withCosts
                ? shippingPrice(quote.costCents, settings.vatBp, 0)
                : null,
              firstMile: o.firstMile,
              dangerousGoods: o.dangerousGoods,
            },
          ];
        })
        .sort((a, b) => (a.costCents ?? 0) - (b.costCents ?? 0)),
    };
  } catch (error) {
    return { status: 'error', message: platformError(error) };
  }
}

const labelInput = z.object({
  orderId: z.uuid(),
  code: z.string().trim().min(1).max(200),
  weightG: grams,
});

/**
 * «Crear etiqueta» con un servicio de la plataforma: la compra en Sendcloud
 * y la apunta con su coste. Si no se puede apuntar, se cancela en la
 * plataforma para no pagar una etiqueta sin pedido.
 */
export async function createSendcloudLabel(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const staff = await requirePermission('orders.fulfill');
  const session = { role: staff.role, aal: 'aal2' as const };
  if (!isAllowed(session, 'customers.view'))
    return fail(
      'Hace falta el permiso de clientes para la dirección de la etiqueta.',
    );
  const parsed = labelInput.safeParse({
    orderId: form.get('orderId'),
    code: form.get('code'),
    weightG: form.get('weightG'),
  });
  if (!parsed.success) return fail('Revisa el servicio y el peso del paquete.');
  const config = sendcloudConfig();
  if (!config) return fail('Sendcloud no está conectado.');
  const { supabase } = staff;
  const [order, settings, services, previous] = await Promise.all([
    loadOrderForLabel(supabase, parsed.data.orderId),
    getShippingSettings(supabase),
    supabase
      .from('shipping_services')
      .select('id, code, contract_id')
      .eq('provider', 'sendcloud'),
    supabase
      .from('shipments')
      .select('id', { count: 'exact', head: true })
      .eq('order_id', parsed.data.orderId),
  ]);
  if (
    !order ||
    !order.contact.addressLine1 ||
    !order.contact.postalCode ||
    !order.contact.city
  )
    return fail('No se encontró la dirección de envío del pedido.');
  if (
    order.fulfillment !== 'shipping' ||
    !['paid', 'processing'].includes(order.status)
  )
    return fail(SHIPPING_ERRORS.shipment_unavailable!);
  if (!settings) return fail('Faltan los ajustes de envío (remitente).');
  const service =
    (services.data ?? []).find((s) => s.code === parsed.data.code) ?? null;
  const weightG = parsed.data.weightG;
  let cost: number | null = null;
  let contractId = service?.contract_id ?? null;
  let carrier: { code: string; name: string; product: string };
  try {
    const [quoted] = await fetchShippingOptions(config, {
      from: { postalCode: settings.postalCode, city: settings.city },
      to: {
        postalCode: order.contact.postalCode,
        city: order.contact.city,
        addressLine1: order.contact.addressLine1,
      },
      weightG,
      dimensions: settings.parcel,
      shippingOptionCode: parsed.data.code,
    });
    if (!quoted)
      return fail('La plataforma ya no ofrece ese servicio para este paquete.');
    cost = bracketFor(quoted.quotes, weightG)?.costCents ?? null;
    contractId = contractId ?? quoted.contractId;
    carrier = {
      code: quoted.carrierCode,
      name: quoted.carrierName,
      product: quoted.name,
    };
  } catch (error) {
    return fail(platformError(error));
  }
  const reference = `pedido-${order.number}-${(previous.count ?? 0) + 1}`;
  let label;
  try {
    label = await announceShipment(config, {
      from: {
        name: settings.senderContact ?? settings.senderName,
        companyName: settings.senderName,
        addressLine1: settings.addressLine1,
        houseNumber: settings.houseNumber,
        addressLine2: settings.addressLine2,
        postalCode: settings.postalCode,
        city: settings.city,
        country: 'ES',
        email: settings.email,
        phone: settings.phone,
      },
      to: {
        name: order.contact.fullName,
        addressLine1: order.contact.addressLine1,
        addressLine2: order.contact.addressLine2,
        postalCode: order.contact.postalCode,
        city: order.contact.city,
        country: 'ES',
        email: order.contact.email,
        phone: order.contact.phone,
      },
      shippingOptionCode: parsed.data.code,
      contractId,
      orderNumber: String(order.number),
      externalReference: reference,
      totalOrderCents: order.totalCents,
      weightG,
      dimensions: settings.parcel,
      items: order.lines,
    });
  } catch (error) {
    if (error instanceof SendcloudError && error.status === 409)
      return fail(
        'Esta etiqueta ya se pidió a la plataforma: recarga la ficha antes de repetir.',
      );
    return fail(platformError(error));
  }
  const { error } = await supabase.rpc('admin_record_shipment', {
    p_order_id: order.id,
    p_shipment: {
      provider: 'sendcloud',
      service_id: service?.id ?? null,
      carrier_code: label.carrierCode ?? carrier.code,
      carrier_name: label.carrierName ?? carrier.name,
      service_name: carrier.product,
      provider_shipment_id: label.shipmentId,
      provider_parcel_id: label.parcelId,
      external_reference: reference,
      tracking_number: label.trackingNumber,
      tracking_url: label.trackingUrl,
      weight_g: weightG,
      cost_cents: cost,
    },
  });
  if (error) {
    // No se pudo apuntar: no se deja una etiqueta pagada sin pedido.
    await cancelShipment(config, label.shipmentId).catch(() => undefined);
    return fail(
      `${describe(error)} La etiqueta se ha cancelado en la plataforma.`,
    );
  }
  refresh();
  return ok(
    `Etiqueta creada con ${carrier.name}${label.trackingNumber ? ` (seguimiento ${label.trackingNumber})` : ''}. Descárgala e imprímela.`,
  );
}

const manualInput = z.object({
  orderId: z.uuid(),
  serviceId: z.uuid(),
  tracking: text(120),
  cost: z.string().trim(),
  weightG: grams,
});

/** Etiqueta hecha en la web del transportista (contrato sin API). */
export async function recordManualShipment(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const staff = await requirePermission('orders.fulfill');
  const parsed = manualInput.safeParse({
    orderId: form.get('orderId'),
    serviceId: form.get('serviceId'),
    tracking: form.get('tracking') ?? '',
    cost: form.get('cost') ?? '',
    weightG: form.get('weightG'),
  });
  if (!parsed.success)
    return fail('Elige el servicio e indica el peso del paquete.');
  const cost = parsed.data.cost ? parseEuros(parsed.data.cost) : null;
  if (parsed.data.cost && cost === null)
    return fail('El coste no es válido (por ejemplo, 4,20).');
  const { error } = await staff.supabase.rpc('admin_record_shipment', {
    p_order_id: parsed.data.orderId,
    p_shipment: {
      provider: 'manual',
      service_id: parsed.data.serviceId,
      tracking_number: parsed.data.tracking || null,
      weight_g: parsed.data.weightG,
      cost_cents: isAllowed(
        { role: staff.role, aal: 'aal2' },
        'pricing.view_cost',
      )
        ? cost
        : null,
    },
  });
  if (error) return fail(describe(error));
  refresh();
  return ok('Envío apuntado.');
}

export async function cancelShipmentAction(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const staff = await requirePermission('orders.fulfill');
  const id = z.uuid().safeParse(form.get('shipmentId'));
  if (!id.success) return fail('Acción no válida.');
  const { data: shipment } = await staff.supabase
    .from('shipments')
    .select('id, provider, provider_shipment_id, status')
    .eq('id', id.data)
    .maybeSingle();
  if (!shipment) return fail(SHIPPING_ERRORS.unknown_shipment!);
  if (shipment.status !== 'label_created')
    return fail(SHIPPING_ERRORS.shipment_not_cancellable!);
  if (shipment.provider === 'sendcloud' && shipment.provider_shipment_id) {
    const config = sendcloudConfig();
    if (!config)
      return fail('Sendcloud no está conectado: cancélala en su panel.');
    try {
      await cancelShipment(config, shipment.provider_shipment_id);
    } catch (error) {
      // Ya se estaba cancelando: se da por cancelada aquí también.
      if (!(error instanceof SendcloudError && error.status === 409))
        return fail(`${platformError(error)} No se ha cancelado.`);
    }
  }
  const { error } = await staff.supabase.rpc('admin_cancel_shipment', {
    p_shipment_id: id.data,
  });
  if (error) return fail(describe(error));
  refresh();
  return ok('Etiqueta cancelada. Puedes hacer otra.');
}

const pickupInput = z.object({
  mode: z.enum(['api', 'phone']),
  carrierCode: z.string().trim().min(1).max(60),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Elige el día de la recogida.'),
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
  shipmentIds: z
    .array(z.uuid())
    .min(1, 'Elige al menos una etiqueta.')
    .max(200),
  note: text(200),
});

/**
 * «Solicitar recogida en la tienda» para las etiquetas de un transportista:
 * por la API de la plataforma o, si no la admite, apuntada tras llamar.
 */
export async function requestPickup(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const staff = await requirePermission('orders.fulfill');
  const parsed = pickupInput.safeParse({
    mode: form.get('mode'),
    carrierCode: form.get('carrierCode'),
    date: form.get('date'),
    start: form.get('start'),
    end: form.get('end'),
    shipmentIds: form.getAll('shipmentIds'),
    note: form.get('note') ?? '',
  });
  if (!parsed.success)
    return fail(parsed.error.issues[0]?.message ?? 'Revisa la recogida.');
  const p = parsed.data;
  const startAt = madridInstant(p.date, p.start);
  const endAt = madridInstant(p.date, p.end);
  if (!startAt || !endAt || endAt <= startAt)
    return fail('La franja termina después de empezar.');
  if (new Date(startAt).getTime() < Date.now())
    return fail('La recogida tiene que ser en el futuro.');
  const { supabase } = staff;
  const [settings, shipments] = await Promise.all([
    getShippingSettings(supabase),
    supabase
      .from('shipments')
      .select(
        'id, provider, carrier_code, carrier_name, weight_g, parcels, status, handover, service_id, shipping_services(contract_id)',
      )
      .in('id', p.shipmentIds),
  ]);
  if (!settings)
    return fail('Faltan los ajustes de envío (dirección de la tienda).');
  const rows = shipments.data ?? [];
  if (
    rows.length !== p.shipmentIds.length ||
    rows.some(
      (r) =>
        r.carrier_code !== p.carrierCode ||
        r.status !== 'label_created' ||
        r.handover,
    )
  )
    return fail(SHIPPING_ERRORS.pickup_shipments_invalid!);
  const first = rows[0]!;
  const parcels = rows.reduce((sum, r) => sum + r.parcels, 0);
  const totalWeightG = rows.reduce((sum, r) => sum + r.weight_g, 0);
  const provider = rows.every((r) => r.provider === 'sendcloud')
    ? 'sendcloud'
    : 'manual';
  let pickupId: string | null = null;
  if (p.mode === 'api') {
    const config = sendcloudConfig();
    if (!config || provider !== 'sendcloud')
      return fail(
        'La recogida por la plataforma es solo para etiquetas de Sendcloud: llama al transportista y apúntala.',
      );
    try {
      const created = await createPickup(config, {
        carrierCode: p.carrierCode,
        contractId:
          (first.shipping_services as { contract_id: number | null } | null)
            ?.contract_id ?? null,
        address: {
          name: settings.senderContact ?? settings.senderName,
          companyName: settings.senderName,
          addressLine1: settings.addressLine1,
          houseNumber: settings.houseNumber,
          addressLine2: settings.addressLine2,
          postalCode: settings.postalCode,
          city: settings.city,
          country: 'ES',
          email: settings.email,
          phone: settings.phone,
        },
        startAt,
        endAt,
        parcels,
        totalWeightG,
        reference: `recogida-${p.date}`,
        instructions: p.note || null,
      });
      pickupId = created.id;
    } catch (error) {
      return fail(
        `${platformError(error)} Si este transportista no admite recogidas por la plataforma, llama a su teléfono de recogidas y apúntala.`,
      );
    }
  }
  const { error } = await supabase.rpc('admin_record_pickup', {
    p_pickup: {
      provider,
      carrier_code: p.carrierCode,
      carrier_name: first.carrier_name,
      provider_pickup_id: pickupId,
      status: p.mode === 'api' ? 'requested' : 'by_phone',
      window_start: startAt,
      window_end: endAt,
      note: p.note || null,
    },
    p_shipment_ids: p.shipmentIds,
  });
  if (error) return fail(describe(error));
  refresh();
  return ok(
    p.mode === 'api'
      ? `Recogida pedida a ${first.carrier_name} para el ${p.date}, de ${p.start} a ${p.end} (${parcels} ${parcels === 1 ? 'paquete' : 'paquetes'}).`
      : 'Recogida apuntada.',
  );
}

export type DropoffPoints =
  | { status: 'ok'; points: ServicePoint[] }
  | { status: 'error'; message: string };

/** Puntos del transportista de una etiqueta cerca de la tienda. */
export async function findDropoffPoints(
  shipmentId: string,
): Promise<DropoffPoints> {
  const staff = await requirePermission('orders.fulfill');
  if (!z.uuid().safeParse(shipmentId).success)
    return { status: 'error', message: 'Acción no válida.' };
  const config = sendcloudConfig();
  if (!config)
    return {
      status: 'error',
      message:
        'Sendcloud no está conectado: busca el punto en la web del transportista.',
    };
  const [settings, shipment] = await Promise.all([
    getShippingSettings(staff.supabase),
    staff.supabase
      .from('shipments')
      .select('carrier_code')
      .eq('id', shipmentId)
      .maybeSingle(),
  ]);
  if (!settings || !shipment.data)
    return { status: 'error', message: 'Faltan los ajustes de envío.' };
  try {
    const points = await listServicePoints(config, {
      carrierCode: shipment.data.carrier_code,
      postalCode: settings.postalCode,
      city: settings.city,
      street: settings.addressLine1,
    });
    return { status: 'ok', points };
  } catch (error) {
    return { status: 'error', message: platformError(error) };
  }
}

const dropoffInput = z.object({
  shipmentId: z.uuid(),
  pointName: text(120),
  pointAddress: text(200),
  pointId: text(60),
});

/** «Lo he dejado en el punto»: el pedido pasa a «Enviado». */
export async function recordDropoff(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const staff = await requirePermission('orders.fulfill');
  const parsed = dropoffInput.safeParse({
    shipmentId: form.get('shipmentId'),
    pointName: form.get('pointName') ?? '',
    pointAddress: form.get('pointAddress') ?? '',
    pointId: form.get('pointId') ?? '',
  });
  if (!parsed.success) return fail('Acción no válida.');
  const p = parsed.data;
  const { data, error } = await staff.supabase.rpc('admin_record_dropoff', {
    p_shipment_id: p.shipmentId,
    p_point:
      p.pointName || p.pointAddress || p.pointId
        ? {
            name: p.pointName || null,
            address: p.pointAddress || null,
            id: p.pointId || null,
          }
        : (null as unknown as Record<string, never>),
  });
  if (error) return fail(describe(error));
  // «Enviado» encola el correo con el seguimiento: sale después de responder.
  after(() => sendOrderEmails(5).then(() => undefined));
  refresh();
  return ok(
    `Pedido nº ${data.number}: enviado. El cliente recibe el seguimiento por correo.`,
  );
}
