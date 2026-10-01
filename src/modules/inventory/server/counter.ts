'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { describeDbError } from '@/modules/admin';
import { requirePermission } from '@/modules/auth/server';
import {
  COUNTER_KINDS,
  COUNTER_KIND_LABELS,
  MAX_LINE_QUANTITY,
  MAX_TICKET_LINES,
  MAX_TICKET_REF,
} from '../domain/counter';

/*
 * Venta o devolución de mostrador. La función SQL la aplica todo o nada, con
 * bloqueo de los niveles, y la clave de petición hace que un doble toque o un
 * reintento tras un corte de red registren una sola venta.
 */

export type CounterResult =
  | { status: 'ok'; saleId: number; message: string }
  | { status: 'error'; message: string; variantId?: string };

const input = z.object({
  locationId: z.uuid(),
  kind: z.enum(COUNTER_KINDS),
  requestId: z.uuid(),
  ticketRef: z.string().trim().max(MAX_TICKET_REF),
  lines: z
    .array(
      z.object({
        variantId: z.uuid(),
        quantity: z.number().int().min(1).max(MAX_LINE_QUANTITY),
      }),
    )
    .min(1)
    .max(MAX_TICKET_LINES),
});

export async function recordCounterTicket(
  payload: z.input<typeof input>,
): Promise<CounterResult> {
  const { supabase } = await requirePermission('inventory.sell_in_store');
  const parsed = input.safeParse(payload);
  if (!parsed.success) {
    return { status: 'error', message: 'Revisa las líneas del ticket.' };
  }
  const t = parsed.data;
  if (new Set(t.lines.map((l) => l.variantId)).size !== t.lines.length) {
    return {
      status: 'error',
      message: 'Hay un formato repetido en el ticket.',
    };
  }
  const { data, error } = await supabase.rpc('admin_record_store_sale', {
    p_location_id: t.locationId,
    p_kind: t.kind,
    p_items: t.lines.map((l) => ({
      variant_id: l.variantId,
      quantity: l.quantity,
    })),
    p_request_id: t.requestId,
    p_ticket_ref: t.ticketRef || undefined,
  });
  if (error) {
    if (error.message === 'insufficient_stock') {
      return {
        status: 'error',
        message:
          'No hay unidades disponibles suficientes de un perfume: no se ha descontado nada.',
        variantId: error.details ?? undefined,
      };
    }
    return { status: 'error', message: describeDbError(error) };
  }
  // Inventario, movimientos y la disponibilidad que ve la tienda.
  revalidatePath('/admin', 'layout');
  revalidatePath('/', 'layout');
  const units = data.units;
  return {
    status: 'ok',
    saleId: data.id,
    message: `${COUNTER_KIND_LABELS[t.kind]} registrada: ${units} ${units === 1 ? 'unidad' : 'unidades'}${data.ticket_ref ? ` · ticket ${data.ticket_ref}` : ''}.`,
  };
}
