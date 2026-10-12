'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { parseEuros } from '@/lib/money';
import { createOrdersClient } from '@/lib/supabase/privileged';
import type { ActionState } from '@/modules/admin';
import { fail, ok } from '@/modules/admin';
import { requirePermission } from '@/modules/auth/server';
import { redsysConfig } from '@/modules/payments/server/config';
import type { RefundOutcome } from '@/modules/payments/server/refund';
import { redsysRefund } from '@/modules/payments/server/refund';
import { orderNumberLabel } from '../domain/labels';
import { describeOrderError } from './errors';

/*
 * Devoluciones desde la ficha (P06, DECISIONS §139). El personal con
 * orders.refund y MFA pide la devolución (admin_request_refund, con su
 * sesión); el servidor la manda al banco por la API REST de Redsys y registra
 * su respuesta firmada (web_order_refund_result, con la clave privilegiada,
 * §131). Lo que pulsa el personal nunca da el dinero por devuelto.
 */

const refundInput = z.object({
  orderId: z.uuid(),
  paymentId: z.coerce.number().int().positive(),
  to: z
    .enum(['cancelled', 'refunded', 'partially_refunded', ''])
    .transform((value) => value || null),
  amountCents: z.coerce.number().int().positive().optional(),
  amount: z.string().trim().optional(),
  revision: z.coerce.number().int().min(1),
  requestId: z.uuid(),
});

type Requested = {
  refund_id: string;
  number: number;
  reference: string;
  amount_cents: number;
  status: string;
};

/** Manda una devolución ya pedida al banco y guarda lo que responde. */
async function sendToBank(requested: Requested): Promise<ActionState> {
  const config = redsysConfig();
  const orders = createOrdersClient();
  if (!config || !orders)
    return fail('El TPV no está configurado: la devolución no se ha enviado.');
  let outcome: RefundOutcome;
  try {
    outcome = await redsysRefund(config, {
      reference: requested.reference,
      amountCents: requested.amount_cents,
    });
  } catch {
    outcome = { status: 'unknown', code: 'error' };
  }
  const { error } = await orders.rpc('web_order_refund_result', {
    p_refund_id: requested.refund_id,
    p_status: outcome.status,
    ...(outcome.status === 'unknown'
      ? { p_error: outcome.code }
      : { p_response_code: outcome.code }),
  });
  revalidatePath('/admin/pedidos', 'layout');
  revalidatePath('/admin');
  if (error) {
    console.error('[devoluciones] no se pudo guardar la respuesta', error.code);
    return fail(
      'El banco respondió pero no se pudo guardar. Comprueba la devolución en el portal de Redsys antes de repetirla.',
    );
  }
  const label = orderNumberLabel(requested.number);
  if (outcome.status === 'succeeded')
    return ok(`${label}: el banco ha aceptado la devolución.`);
  if (outcome.status === 'failed')
    return fail(
      `${label}: el banco ha rechazado la devolución (código ${outcome.code}). No se ha devuelto nada.`,
    );
  return fail(
    `${label}: el banco no ha dado una respuesta clara. Comprueba en el portal de Redsys si la devolución se hizo antes de volver a enviarla.`,
  );
}

export async function requestRefund(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const staff = await requirePermission('orders.refund');
  if (!redsysConfig())
    return fail(
      'El TPV no está configurado: las devoluciones se hacen en el portal del banco.',
    );
  const parsed = refundInput.safeParse({
    orderId: formData.get('orderId'),
    paymentId: formData.get('paymentId'),
    to: formData.get('to') ?? '',
    amountCents: formData.get('amountCents') || undefined,
    amount: formData.get('amount') ?? undefined,
    revision: formData.get('revision'),
    requestId: formData.get('requestId'),
  });
  if (!parsed.success) return fail('Devolución no válida. Recarga la página.');
  const input = parsed.data;
  const amountCents =
    input.amountCents ?? (input.amount ? parseEuros(input.amount) : null);
  if (!amountCents || amountCents <= 0)
    return fail('Escribe el importe que quieres devolver.');
  const { data, error } = await staff.supabase.rpc('admin_request_refund', {
    p_order_id: input.orderId,
    p_payment_id: input.paymentId,
    // La base acepta null (cobro de más); el tipo generado no.
    p_to: input.to as string,
    p_amount_cents: amountCents,
    p_request_id: input.requestId,
    p_revision: input.revision,
  });
  if (error) return fail(describeOrderError(error));
  const requested = data as Requested;
  // Un doble clic devuelve la misma solicitud: solo se manda si sigue abierta.
  if (requested.status !== 'requested') {
    revalidatePath('/admin/pedidos', 'layout');
    return ok(
      `${orderNumberLabel(requested.number)}: esa devolución ya tenía respuesta.`,
    );
  }
  return sendToBank(requested);
}

/** Vuelve a enviar una devolución que quedó sin respuesta clara. */
export async function retryRefund(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const staff = await requirePermission('orders.refund');
  if (!redsysConfig())
    return fail(
      'El TPV no está configurado: las devoluciones se hacen en el portal del banco.',
    );
  const id = z.uuid().safeParse(formData.get('refundId'));
  if (!id.success) return fail('Devolución no válida. Recarga la página.');
  const { data, error } = await staff.supabase.rpc('admin_retry_refund', {
    p_refund_id: id.data,
  });
  if (error) return fail(describeOrderError(error));
  return sendToBank(data as Requested);
}
