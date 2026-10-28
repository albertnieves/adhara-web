import 'server-only';
import type { StaffContext } from '@/modules/auth/server';
import type { ShippingZone } from '@/modules/checkout/domain/shipping';
import { SHIPPING_ZONES } from '@/modules/checkout/domain/shipping';
import type { ShipmentStatus } from '../domain/status';

/*
 * Lecturas del panel con la sesión de quien mira. La RLS deja leer ajustes,
 * servicios, envíos y recogidas con orders.view; los costes solo llegan por
 * admin_shipping_services y admin_shipment_costs, con pricing.view_cost.
 */

type Supabase = StaffContext['supabase'];

function must<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export type ShippingSettings = {
  senderName: string;
  senderContact: string | null;
  addressLine1: string;
  houseNumber: string | null;
  addressLine2: string | null;
  postalCode: string;
  city: string;
  phone: string;
  email: string;
  packagingWeightG: number;
  maxWeightG: number;
  parcel: { lengthCm: number; widthCm: number; heightCm: number } | null;
  /** «10:00». */
  pickupStart: string;
  pickupEnd: string;
  vatBp: number;
  updatedAt: string;
};

export async function getShippingSettings(
  supabase: Supabase,
): Promise<ShippingSettings | null> {
  const row = must(
    await supabase.from('shipping_settings').select('*').maybeSingle(),
  );
  if (!row) return null;
  return {
    senderName: row.sender_name,
    senderContact: row.sender_contact,
    addressLine1: row.address_line1,
    houseNumber: row.house_number,
    addressLine2: row.address_line2,
    postalCode: row.postal_code,
    city: row.city,
    phone: row.phone,
    email: row.email,
    packagingWeightG: row.packaging_weight_g,
    maxWeightG: row.max_weight_g,
    parcel:
      row.parcel_length_cm && row.parcel_width_cm && row.parcel_height_cm
        ? {
            lengthCm: row.parcel_length_cm,
            widthCm: row.parcel_width_cm,
            heightCm: row.parcel_height_cm,
          }
        : null,
    pickupStart: row.pickup_start.slice(0, 5),
    pickupEnd: row.pickup_end.slice(0, 5),
    vatBp: row.shipping_vat_bps,
    updatedAt: row.updated_at,
  };
}

export type AdminShippingZone = {
  zone: ShippingZone;
  freeFromCents: number | null;
  active: boolean;
};

export async function listShippingZones(
  supabase: Supabase,
): Promise<AdminShippingZone[]> {
  const rows =
    must(
      await supabase
        .from('shipping_rates')
        .select('zone, free_from_cents, active'),
    ) ?? [];
  return SHIPPING_ZONES.map((zone) => {
    const row = rows.find((r) => r.zone === zone);
    return {
      zone,
      freeFromCents: row?.free_from_cents ?? null,
      active: row?.active ?? false,
    };
  });
}

export type AdminServiceRate = {
  zone: ShippingZone;
  minWeightG: number;
  maxWeightG: number;
  leadTimeHours: number | null;
  /** null sin pricing.view_cost. */
  costCents: number | null;
  priceCents: number | null;
};

export type AdminShippingService = {
  id: string;
  provider: 'sendcloud' | 'manual';
  code: string;
  carrierCode: string;
  carrierName: string;
  name: string;
  label: string;
  contractId: number | null;
  firstMile: string | null;
  dangerousGoods: boolean | null;
  transitDays: number | null;
  surchargeCents: number;
  freeEligible: boolean;
  zones: ShippingZone[];
  active: boolean;
  position: number;
  trackingUrlTemplate: string | null;
  pickupPhone: string | null;
  syncedAt: string | null;
  rates: AdminServiceRate[];
};

type ServiceRow = {
  id: string;
  provider: 'sendcloud' | 'manual';
  code: string;
  carrier_code: string;
  carrier_name: string;
  name: string;
  label: string;
  contract_id: number | null;
  first_mile: string | null;
  dangerous_goods: boolean | null;
  transit_days: number | null;
  surcharge_cents: number;
  free_eligible: boolean;
  zones: ShippingZone[];
  active: boolean;
  position: number;
  tracking_url_template: string | null;
  pickup_phone: string | null;
  synced_at: string | null;
  rates: {
    zone: ShippingZone;
    min_weight_g: number;
    max_weight_g: number;
    lead_time_hours: number | null;
    cost_cents: number | null;
    price_cents: number | null;
  }[];
};

/** Servicios con sus tramos (settings.manage; importes con pricing.view_cost). */
export async function listShippingServices(
  supabase: Supabase,
): Promise<AdminShippingService[]> {
  const data = must(
    await supabase.rpc('admin_shipping_services'),
  ) as unknown as ServiceRow[];
  return (data ?? []).map((s) => ({
    id: s.id,
    provider: s.provider,
    code: s.code,
    carrierCode: s.carrier_code,
    carrierName: s.carrier_name,
    name: s.name,
    label: s.label,
    contractId: s.contract_id,
    firstMile: s.first_mile,
    dangerousGoods: s.dangerous_goods,
    transitDays: s.transit_days,
    surchargeCents: s.surcharge_cents,
    freeEligible: s.free_eligible,
    zones: s.zones,
    active: s.active,
    position: s.position,
    trackingUrlTemplate: s.tracking_url_template,
    pickupPhone: s.pickup_phone,
    syncedAt: s.synced_at,
    rates: s.rates.map((r) => ({
      zone: r.zone,
      minWeightG: r.min_weight_g,
      maxWeightG: r.max_weight_g,
      leadTimeHours: r.lead_time_hours,
      costCents: r.cost_cents,
      priceCents: r.price_cents,
    })),
  }));
}

/** Servicio (sin tramos) para la ficha del pedido: transportista y teléfono. */
export type ServiceSummary = {
  id: string;
  provider: 'sendcloud' | 'manual';
  code: string;
  carrierCode: string;
  carrierName: string;
  name: string;
  contractId: number | null;
  firstMile: string | null;
  pickupPhone: string | null;
  trackingUrlTemplate: string | null;
  active: boolean;
};

export async function listServiceSummaries(
  supabase: Supabase,
): Promise<ServiceSummary[]> {
  const rows =
    must(
      await supabase
        .from('shipping_services')
        .select(
          'id, provider, code, carrier_code, carrier_name, name, contract_id, first_mile, pickup_phone, tracking_url_template, active',
        )
        .order('active', { ascending: false })
        .order('carrier_name')
        .order('name'),
    ) ?? [];
  return rows.map((r) => ({
    id: r.id,
    provider: r.provider as 'sendcloud' | 'manual',
    code: r.code,
    carrierCode: r.carrier_code,
    carrierName: r.carrier_name,
    name: r.name,
    contractId: r.contract_id,
    firstMile: r.first_mile,
    pickupPhone: r.pickup_phone,
    trackingUrlTemplate: r.tracking_url_template,
    active: r.active,
  }));
}

export type ShipmentView = {
  id: string;
  serviceId: string | null;
  provider: 'sendcloud' | 'manual';
  carrierCode: string;
  carrierName: string;
  serviceName: string;
  status: ShipmentStatus;
  providerShipmentId: string | null;
  providerParcelId: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  weightG: number;
  handover: 'pickup' | 'dropoff' | null;
  handoverAt: string | null;
  dropoffPoint: { name?: string; address?: string } | null;
  pickup: {
    id: string;
    status: string;
    windowStart: string;
    windowEnd: string;
    providerPickupId: string | null;
  } | null;
  statusMessage: string | null;
  statusAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  cancelledAt: string | null;
  /** null sin pricing.view_cost o sin coste apuntado. */
  costCents: number | null;
  events: {
    id: number;
    status: ShipmentStatus;
    source: string;
    message: string | null;
    at: string;
  }[];
};

const SHIPMENT_SELECT =
  '*, shipment_pickups(id, status, window_start, window_end, provider_pickup_id), shipment_events(id, status, source, message, at)';

type ShipmentRow = {
  id: string;
  service_id: string | null;
  provider: string;
  carrier_code: string;
  carrier_name: string;
  service_name: string;
  status: string;
  provider_shipment_id: string | null;
  provider_parcel_id: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  weight_g: number;
  handover: string | null;
  handover_at: string | null;
  dropoff_point: unknown;
  status_message: string | null;
  status_at: string | null;
  delivered_at: string | null;
  created_at: string;
  cancelled_at: string | null;
  shipment_pickups: {
    id: string;
    status: string;
    window_start: string;
    window_end: string;
    provider_pickup_id: string | null;
  } | null;
  shipment_events: {
    id: number;
    status: string;
    source: string;
    message: string | null;
    at: string;
  }[];
};

function toShipment(
  row: ShipmentRow,
  costs: Map<string, number>,
): ShipmentView {
  const point =
    row.dropoff_point && typeof row.dropoff_point === 'object'
      ? (row.dropoff_point as { name?: string; address?: string })
      : null;
  return {
    id: row.id,
    serviceId: row.service_id,
    provider: row.provider as 'sendcloud' | 'manual',
    carrierCode: row.carrier_code,
    carrierName: row.carrier_name,
    serviceName: row.service_name,
    status: row.status as ShipmentStatus,
    providerShipmentId: row.provider_shipment_id,
    providerParcelId: row.provider_parcel_id,
    trackingNumber: row.tracking_number,
    trackingUrl: row.tracking_url,
    weightG: row.weight_g,
    handover: row.handover as 'pickup' | 'dropoff' | null,
    handoverAt: row.handover_at,
    dropoffPoint: point,
    pickup: row.shipment_pickups
      ? {
          id: row.shipment_pickups.id,
          status: row.shipment_pickups.status,
          windowStart: row.shipment_pickups.window_start,
          windowEnd: row.shipment_pickups.window_end,
          providerPickupId: row.shipment_pickups.provider_pickup_id,
        }
      : null,
    statusMessage: row.status_message,
    statusAt: row.status_at,
    deliveredAt: row.delivered_at,
    createdAt: row.created_at,
    cancelledAt: row.cancelled_at,
    costCents: costs.get(row.id) ?? null,
    events: [...row.shipment_events]
      .sort((a, b) => a.at.localeCompare(b.at) || a.id - b.id)
      .map((e) => ({
        id: e.id,
        status: e.status as ShipmentStatus,
        source: e.source,
        message: e.message,
        at: e.at,
      })),
  };
}

/** Etiquetas de un pedido, la viva primero; con su coste si se puede ver. */
export async function getOrderShipments(
  supabase: Supabase,
  orderId: string,
  options: { withCosts: boolean },
): Promise<ShipmentView[]> {
  const rows = must(
    await supabase
      .from('shipments')
      .select(SHIPMENT_SELECT)
      .eq('order_id', orderId)
      .order('created_at', { ascending: false }),
  ) as unknown as ShipmentRow[];
  const costs = new Map<string, number>();
  if (options.withCosts && rows.length > 0) {
    const data = must(
      await supabase.rpc('admin_shipment_costs', { p_order_id: orderId }),
    );
    for (const row of data ?? []) costs.set(row.shipment_id, row.cost_cents);
  }
  return rows
    .map((row) => toShipment(row, costs))
    .sort((a, b) =>
      (a.status === 'cancelled') === (b.status === 'cancelled')
        ? b.createdAt.localeCompare(a.createdAt)
        : a.status === 'cancelled'
          ? 1
          : -1,
    );
}

export type BoardOrder = {
  id: string;
  number: number;
  status: string;
  /** El servicio que eligió el cliente (para saber su transportista). */
  serviceId: string | null;
  serviceLabel: string | null;
  weightG: number | null;
  paidAt: string | null;
};

export type BoardShipment = ShipmentView & {
  orderId: string;
  orderNumber: number;
  orderStatus: string;
};

/**
 * Envíos → Seguimiento: pedidos pagados sin etiqueta y etiquetas vivas o
 * recientes (30 días), con su recogida.
 */
export async function getShippingBoard(supabase: Supabase): Promise<{
  withoutLabel: BoardOrder[];
  shipments: BoardShipment[];
}> {
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const [orders, shipments] = await Promise.all([
    supabase
      .from('orders')
      .select(
        'id, number, status, shipping_service_id, shipping_service_label, shipping_weight_g, paid_at, shipments(status)',
      )
      .eq('fulfillment', 'shipping')
      .in('status', ['paid', 'processing'])
      .order('paid_at', { ascending: true }),
    supabase
      .from('shipments')
      .select(`${SHIPMENT_SELECT}, orders!inner(id, number, status)`)
      .neq('status', 'cancelled')
      .or(`status.not.in.(delivered,returned),created_at.gte.${since}`)
      .order('created_at', { ascending: false })
      .limit(300),
  ]);
  const orderRows = must(orders) ?? [];
  const shipmentRows = must(shipments) as unknown as (ShipmentRow & {
    orders: { id: string; number: number; status: string };
  })[];
  return {
    withoutLabel: orderRows
      .filter((o) => !o.shipments.some((s) => s.status !== 'cancelled'))
      .map((o) => ({
        id: o.id,
        number: o.number,
        status: o.status,
        serviceId: o.shipping_service_id,
        serviceLabel: o.shipping_service_label,
        weightG: o.shipping_weight_g,
        paidAt: o.paid_at,
      })),
    shipments: shipmentRows.map((row) => ({
      ...toShipment(row, new Map()),
      orderId: row.orders.id,
      orderNumber: row.orders.number,
      orderStatus: row.orders.status,
    })),
  };
}

export type VariantWeight = {
  variantId: string;
  brandName: string;
  productName: string;
  productStatus: string;
  sizeMl: number | null;
  label: string | null;
  sku: string | null;
  weightG: number | null;
};

/** Formatos activos con su peso de envío, para pesarlos (catalog.edit). */
export async function listVariantWeights(
  supabase: Supabase,
): Promise<VariantWeight[]> {
  const rows = must(
    await supabase
      .from('product_variants')
      .select(
        'id, size_ml, label, sku, shipping_weight_g, active, product:products!inner(name, status, brand:brands!inner(name))',
      )
      .eq('active', true)
      .neq('product.status', 'archived')
      .limit(2000),
  ) as unknown as {
    id: string;
    size_ml: number | null;
    label: string | null;
    sku: string | null;
    shipping_weight_g: number | null;
    product: { name: string; status: string; brand: { name: string } };
  }[];
  return rows
    .map((r) => ({
      variantId: r.id,
      brandName: r.product.brand.name,
      productName: r.product.name,
      productStatus: r.product.status,
      sizeMl: r.size_ml,
      label: r.label,
      sku: r.sku,
      weightG: r.shipping_weight_g,
    }))
    .sort(
      (a, b) =>
        Number(b.productStatus === 'published') -
          Number(a.productStatus === 'published') ||
        a.brandName.localeCompare(b.brandName, 'es') ||
        a.productName.localeCompare(b.productName, 'es') ||
        (a.sizeMl ?? 0) - (b.sizeMl ?? 0),
    );
}
