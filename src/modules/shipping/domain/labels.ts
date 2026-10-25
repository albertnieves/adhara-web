import type { BadgeTone } from '@/components/ui';
import type { ShipmentStatus } from './status';

/* Textos del panel (solo en español). */

export const SHIPMENT_STATUS_LABELS: Readonly<Record<ShipmentStatus, string>> =
  {
    label_created: 'Etiqueta creada',
    in_transit: 'En camino',
    out_for_delivery: 'En reparto',
    at_pickup_point: 'En un punto de recogida',
    delivered: 'Entregado',
    exception: 'Incidencia',
    returned: 'Devuelto al remitente',
    cancelled: 'Cancelado',
  };

export const SHIPMENT_STATUS_TONES: Readonly<
  Record<ShipmentStatus, BadgeTone>
> = {
  label_created: 'neutral',
  in_transit: 'accent',
  out_for_delivery: 'accent',
  at_pickup_point: 'warning',
  delivered: 'success',
  exception: 'danger',
  returned: 'danger',
  cancelled: 'neutral',
};

export const PROVIDER_LABELS: Readonly<Record<string, string>> = {
  sendcloud: 'Sendcloud',
  manual: 'Contrato propio (sin API)',
};

export const FIRST_MILE_LABELS: Readonly<Record<string, string>> = {
  pickup: 'Lo recoge el transportista',
  dropoff: 'Se deja en un punto',
  pickup_dropoff: 'Recogida o punto de entrega',
  fulfilment: 'Desde un almacén',
};

export const HANDOVER_LABELS: Readonly<Record<string, string>> = {
  pickup: 'Recogida en la tienda',
  dropoff: 'Dejado en un punto de entrega',
};

/** Mensajes de las funciones de envío para el panel. */
export const SHIPPING_ERRORS: Readonly<Record<string, string>> = {
  shipment_exists:
    'Este pedido ya tiene una etiqueta. Cancélala antes de hacer otra.',
  shipment_unavailable:
    'Solo los pedidos pagados con envío llevan etiqueta (no los que esperan el pago o ya salieron).',
  shipment_not_cancellable:
    'Esta etiqueta ya no se puede cancelar: el transportista la tiene o el pedido salió.',
  shipment_not_pending:
    'Esta etiqueta ya no espera la entrega al transportista.',
  refund_in_progress:
    'Hay una devolución sin terminar: hasta que el banco responda, el envío no avanza.',
  pickup_shipments_invalid:
    'Una recogida es para etiquetas del mismo transportista que aún no tienen entrega.',
  invalid_pickup: 'Revisa el día y la franja de la recogida.',
  invalid_point: 'Revisa los datos del punto de entrega.',
  invalid_shipment:
    'Faltan datos de la etiqueta (peso, transportista o seguimiento).',
  invalid_settings:
    'Revisa los datos del remitente, el embalaje y la franja de recogida.',
  invalid_service: 'Revisa los datos del servicio.',
  invalid_rates:
    'Los tramos no valen: en orden, sin solaparse y con costes de 0 € o más.',
  service_without_rates:
    'Un servicio activo necesita tramos de peso en cada zona en la que se ofrece.',
  synced_service: 'Los tramos de Sendcloud se actualizan desde la plataforma.',
  invalid_sync: 'La respuesta de la plataforma no se pudo guardar.',
  invalid_weights: 'Cada peso va en gramos enteros, entre 1 y 30.000.',
  unknown_service: 'Ese servicio ya no existe.',
  unknown_shipment: 'Esa etiqueta ya no existe.',
};

/** «2 días laborables», o null. */
export function transitText(days: number | null): string | null {
  if (!days) return null;
  return days === 1 ? '1 día laborable' : `${days} días laborables`;
}

/** «550 g» o «1,45 kg». */
export function weightText(grams: number): string {
  if (grams < 1000) return `${grams} g`;
  return `${(grams / 1000).toLocaleString('es-ES', { maximumFractionDigits: 2 })} kg`;
}
