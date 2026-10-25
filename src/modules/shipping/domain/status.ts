/*
 * Estados de un envío (los mismos que el check de public.shipments) y cómo se
 * traducen los avisos de la plataforma. Sendcloud manda en el aviso firmado un
 * estado con id y mensaje (los de su lista de estados de seguimiento); se
 * clasifica por el mensaje y, para los pocos ids documentados, por el id.
 */

export const SHIPMENT_STATUSES = [
  'label_created',
  'in_transit',
  'out_for_delivery',
  'at_pickup_point',
  'delivered',
  'exception',
  'returned',
  'cancelled',
] as const;
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

export function isShipmentStatus(value: unknown): value is ShipmentStatus {
  return (SHIPMENT_STATUSES as readonly unknown[]).includes(value);
}

/** Mensajes de estado de Sendcloud (en minúsculas) → estado del envío. */
const BY_MESSAGE: Readonly<Record<string, ShipmentStatus>> = {
  'ready to send': 'label_created',
  announced: 'label_created',
  'being announced': 'label_created',
  'announced: not collected': 'label_created',
  'no label': 'label_created',
  'en route to sorting center': 'in_transit',
  'at sorting centre': 'in_transit',
  'at sorting center': 'in_transit',
  'being sorted': 'in_transit',
  sorted: 'in_transit',
  'not sorted': 'in_transit',
  'shipment picked up by driver': 'in_transit',
  'parcel en route': 'in_transit',
  'at customs': 'in_transit',
  'delivery delayed': 'in_transit',
  'delivery date changed': 'in_transit',
  'delivery method changed': 'in_transit',
  'delivery address changed': 'in_transit',
  'driver en route': 'out_for_delivery',
  'awaiting customer pickup': 'at_pickup_point',
  delivered: 'delivered',
  'shipment collected by customer': 'delivered',
  'announcement failed': 'exception',
  'address invalid': 'exception',
  'error collecting': 'exception',
  exception: 'exception',
  'unable to deliver': 'exception',
  'refused by recipient': 'exception',
  'delivery attempt failed': 'exception',
  'returned to sender': 'returned',
  cancelled: 'cancelled',
  'cancelled upstream': 'cancelled',
};

/** Ids de estado que la documentación da con su significado. */
const BY_ID: Readonly<Record<number, ShipmentStatus>> = {
  3: 'in_transit',
  4: 'in_transit',
  5: 'in_transit',
  6: 'in_transit',
  11: 'delivered',
  1000: 'label_created',
  2000: 'cancelled',
};

/**
 * Estado del envío para un aviso de Sendcloud, o null si no cambia nada que
 * importe (una petición de cancelación en curso, un estado desconocido).
 */
export function sendcloudStatus(
  id: number | null,
  message: string | null,
): ShipmentStatus | null {
  const text = (message ?? '').trim().toLowerCase();
  return BY_MESSAGE[text] ?? (id !== null ? (BY_ID[id] ?? null) : null);
}

/** Estados en los que el paquete ya está en manos del transportista. */
export const HANDED_OVER: ReadonlySet<ShipmentStatus> = new Set([
  'in_transit',
  'out_for_delivery',
  'at_pickup_point',
  'delivered',
  'exception',
  'returned',
]);
