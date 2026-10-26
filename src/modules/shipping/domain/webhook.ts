import { z } from 'zod';
import type { ShipmentStatus } from './status';
import { sendcloudStatus } from './status';

/*
 * Aviso «parcel_status_changed» de Sendcloud (después de comprobar su firma).
 * Solo se usa lo necesario: el paquete, su estado, la hora y el seguimiento.
 * Nada de la dirección ni del destinatario llega a la base.
 */

const payload = z.object({
  action: z.string(),
  timestamp: z.number().optional(),
  carrier_status_change_timestamp: z.number().nullable().optional(),
  parcel: z
    .object({
      id: z.union([z.number().int(), z.string().regex(/^\d{1,20}$/)]),
      tracking_number: z.string().max(200).nullable().optional(),
      tracking_url: z.string().max(2000).nullable().optional(),
      status: z
        .object({
          id: z.number().int().nullable().optional(),
          message: z.string().max(300).nullable().optional(),
        })
        .optional(),
    })
    .optional(),
});

export type ParcelEvent = {
  parcelId: string;
  status: ShipmentStatus;
  providerStatusId: number | null;
  message: string;
  at: string;
  trackingNumber: string | null;
  trackingUrl: string | null;
};

/** Segundos o milisegundos desde 1970 → ISO; ahora si no hay hora. */
function instant(value: number | null | undefined, now: Date): string {
  if (!value || !Number.isFinite(value) || value <= 0) return now.toISOString();
  const ms = value > 1e12 ? value : value * 1000;
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? now.toISOString() : date.toISOString();
}

/**
 * Cuerpo del aviso → evento para web_shipment_event; null si no es un cambio
 * de estado que importe (otra acción, un estado que no cambia nada).
 */
export function parseParcelEvent(
  body: unknown,
  now: Date = new Date(),
): ParcelEvent | null {
  const parsed = payload.safeParse(body);
  if (!parsed.success || parsed.data.action !== 'parcel_status_changed')
    return null;
  const parcel = parsed.data.parcel;
  if (!parcel) return null;
  const id = parcel.status?.id ?? null;
  const message = parcel.status?.message ?? '';
  const status = sendcloudStatus(id, message);
  if (!status) return null;
  const url = parcel.tracking_url?.trim() ?? '';
  return {
    parcelId: String(parcel.id),
    status,
    providerStatusId: id,
    message: message.slice(0, 300),
    at: instant(
      parsed.data.carrier_status_change_timestamp ?? parsed.data.timestamp,
      now,
    ),
    trackingNumber: parcel.tracking_number?.trim().slice(0, 120) || null,
    trackingUrl: url.startsWith('https://') ? url.slice(0, 1000) : null,
  };
}
