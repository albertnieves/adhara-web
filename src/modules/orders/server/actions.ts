'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { z } from 'zod';
import type { ActionState } from '@/modules/admin';
import { fail, ok } from '@/modules/admin';
import { isAllowed } from '@/modules/auth';
import { requirePermission } from '@/modules/auth/server';
import { sendOrderEmails } from '@/modules/mail/server';
import { ORDER_STATUS_LABELS, orderNumberLabel } from '../domain/labels';
import type { OrderStatus } from '../domain/status';
import { ORDER_STATUSES, ORDER_TRANSITIONS } from '../domain/status';
import { describeOrderError } from './errors';

/*
 * Cambio de estado de un pedido web desde la ficha. Exige orders.view para
 * abrir la acción y el permiso del paso (orders.fulfill u orders.refund); la
 * función SQL lo vuelve a comprobar con MFA, aplica la revisión optimista y el
 * efecto de inventario en la misma transacción. Los reembolsos no pasan.
 */

const transitionInput = z.object({
  orderId: z.uuid(),
  revision: z.coerce.number().int().min(1),
  to: z.enum(ORDER_STATUSES),
  tracking: z
    .string()
    .trim()
    .max(120, 'El número de seguimiento es demasiado largo.')
    .transform((value) => value || null),
});

export async function changeWebOrderStatus(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const staff = await requirePermission('orders.view');
  const parsed = transitionInput.safeParse({
    orderId: formData.get('orderId'),
    revision: formData.get('revision'),
    to: formData.get('to'),
    tracking: formData.get('tracking') ?? '',
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? 'Acción no válida.');
  }
  const t = parsed.data;
  const permitted = ORDER_TRANSITIONS.some(
    (rule) =>
      rule.to === t.to &&
      rule.by !== 'system' &&
      !rule.refund &&
      isAllowed({ role: staff.role, aal: 'aal2' }, rule.by),
  );
  if (!permitted) return fail('No tienes permiso para este paso.');
  const { data, error } = await staff.supabase.rpc('admin_transition_order', {
    p_order_id: t.orderId,
    p_to: t.to,
    p_revision: t.revision,
    p_tracking_reference: t.tracking ?? undefined,
  });
  if (error) return fail(describeOrderError(error));
  // Pagado, listo para recoger o enviado encolan un correo al cliente (P06):
  // sale después de responder; si falla, lo reintenta la tarea programada.
  if (['paid', 'ready_for_pickup', 'shipped'].includes(t.to))
    after(() => sendOrderEmails(5).then(() => undefined));
  revalidatePath('/admin/pedidos', 'layout');
  revalidatePath('/admin');
  return ok(
    `${orderNumberLabel(data.number)}: ${ORDER_STATUS_LABELS[
      data.status as OrderStatus
    ].toLowerCase()}.`,
  );
}
