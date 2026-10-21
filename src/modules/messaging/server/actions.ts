'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { z } from 'zod';
import type { ActionState } from '@/modules/admin';
import { describeDbError, fail, ok } from '@/modules/admin';
import { requirePermission } from '@/modules/auth/server';
import { mailConfig } from '@/modules/mail/server';
import { CONVERSATION_STATUSES } from '../domain/conversations';
import {
  CONVERSATION_STATUS_LABELS,
  MESSAGE_ERRORS,
  conversationNumberLabel,
} from '../domain/labels';
import { sendMessageEmails } from './outbox';

/*
 * Acciones de la bandeja (A6.1). Exigen messages.reply (borrar,
 * customers.manage); las funciones SQL lo vuelven a comprobar con MFA y
 * aplican la revisión optimista: un doble clic o una conversación que cambió
 * mientras se escribía no se aplican dos veces.
 */

type DbError = { message?: string; code?: string } | null | undefined;

function describe(error: DbError): string {
  const known = error?.message ? MESSAGE_ERRORS[error.message] : undefined;
  return known ?? describeDbError(error);
}

function refresh(conversationId?: string) {
  revalidatePath('/admin/mensajes', 'layout');
  if (conversationId) revalidatePath(`/admin/mensajes/${conversationId}`);
  revalidatePath('/admin');
}

const target = {
  conversationId: z.uuid(),
  revision: z.coerce.number().int().min(1),
};
const body = z
  .string()
  .trim()
  .min(1, 'Escribe el texto.')
  .max(5000, 'Como mucho, 5000 caracteres.');

const replyInput = z.object({ ...target, body });

export async function replyToConversation(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const staff = await requirePermission('messages.reply');
  const parsed = replyInput.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return fail(parsed.error.issues[0]?.message ?? 'Revisa la respuesta.');
  const { data, error } = await staff.supabase.rpc('admin_reply_conversation', {
    p_conversation_id: parsed.data.conversationId,
    p_body: parsed.data.body,
    p_revision: parsed.data.revision,
  });
  if (error) return fail(describe(error));
  // Sale después de responder; si falla, la reintenta la tarea de correos.
  after(() => sendMessageEmails(5).then(() => undefined));
  refresh(parsed.data.conversationId);
  return ok(
    mailConfig()
      ? `${conversationNumberLabel(data.number)}: respuesta enviada al cliente.`
      : `${conversationNumberLabel(data.number)}: respuesta guardada. El correo aún no está configurado: saldrá cuando lo esté.`,
  );
}

const noteInput = z.object({ conversationId: z.uuid(), body });

export async function addConversationNote(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const staff = await requirePermission('messages.reply');
  const parsed = noteInput.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return fail(parsed.error.issues[0]?.message ?? 'Revisa la nota.');
  const { error } = await staff.supabase.rpc('admin_add_conversation_note', {
    p_conversation_id: parsed.data.conversationId,
    p_body: parsed.data.body,
  });
  if (error) return fail(describe(error));
  refresh(parsed.data.conversationId);
  return ok('Nota interna añadida.');
}

const statusInput = z.object({
  ...target,
  to: z.enum(CONVERSATION_STATUSES),
});

export async function changeConversationStatus(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const staff = await requirePermission('messages.reply');
  const parsed = statusInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return fail('Acción no válida.');
  const { data, error } = await staff.supabase.rpc(
    'admin_set_conversation_status',
    {
      p_conversation_id: parsed.data.conversationId,
      p_status: parsed.data.to,
      p_revision: parsed.data.revision,
    },
  );
  if (error) return fail(describe(error));
  refresh(parsed.data.conversationId);
  return ok(
    `${conversationNumberLabel(data.number)}: ${CONVERSATION_STATUS_LABELS[
      parsed.data.to
    ].toLowerCase()}.`,
  );
}

const assignInput = z.object({
  ...target,
  assignee: z.union([z.uuid(), z.literal('')]),
});

export async function assignConversation(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const staff = await requirePermission('messages.reply');
  const parsed = assignInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return fail('Elige a quién asignarla.');
  const { error } = await staff.supabase.rpc('admin_assign_conversation', {
    p_conversation_id: parsed.data.conversationId,
    p_assignee: (parsed.data.assignee || null) as unknown as string,
    p_revision: parsed.data.revision,
  });
  if (error) return fail(describe(error));
  refresh(parsed.data.conversationId);
  return ok(parsed.data.assignee ? 'Asignada.' : 'Sin asignar.');
}

const orderInput = z.object({
  ...target,
  orderNumber: z
    .string()
    .trim()
    .transform((value) => value.replace(/^(n[º°o.]*|#)\s*/i, ''))
    .refine((value) => value === '' || /^[0-9]{1,12}$/.test(value), {
      message: 'El número de pedido son solo cifras.',
    }),
});

export async function linkConversationOrder(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const staff = await requirePermission('messages.reply');
  const parsed = orderInput.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return fail(parsed.error.issues[0]?.message ?? 'Revisa el número.');
  const number = parsed.data.orderNumber
    ? Number(parsed.data.orderNumber)
    : null;
  const { error } = await staff.supabase.rpc('admin_link_conversation_order', {
    p_conversation_id: parsed.data.conversationId,
    p_order_number: number as unknown as number,
    p_revision: parsed.data.revision,
  });
  if (error) return fail(describe(error));
  refresh(parsed.data.conversationId);
  return ok(number ? `Enlazada al pedido Nº ${number}.` : 'Pedido quitado.');
}

const deleteInput = z.object(target);

export async function deleteConversation(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const staff = await requirePermission('customers.manage');
  const parsed = deleteInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return fail('Acción no válida.');
  const { error } = await staff.supabase.rpc('admin_delete_conversation', {
    p_conversation_id: parsed.data.conversationId,
    p_revision: parsed.data.revision,
  });
  if (error) return fail(describe(error));
  refresh();
  redirect('/admin/mensajes?borrada=1');
}

const templateInput = z.object({
  id: z.union([z.uuid(), z.literal('')]),
  revision: z.union([z.coerce.number().int().min(1), z.literal('')]),
  title: z
    .string()
    .trim()
    .min(1, 'Ponle un título.')
    .max(80, 'El título, como mucho, 80 caracteres.'),
  locale: z.enum(['es', 'ca', 'en']),
  body: body,
  active: z.literal('on').optional(),
});

export async function saveMessageTemplate(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const staff = await requirePermission('messages.reply');
  const parsed = templateInput.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return fail(parsed.error.issues[0]?.message ?? 'Revisa la plantilla.');
  const t = parsed.data;
  const { error } = await staff.supabase.rpc('admin_save_message_template', {
    p_id: (t.id || null) as unknown as string,
    p_title: t.title,
    p_locale: t.locale,
    p_body: t.body,
    p_active: t.active === 'on',
    ...(t.revision !== '' && { p_revision: t.revision }),
  });
  if (error) return fail(describe(error));
  revalidatePath('/admin/mensajes', 'layout');
  redirect('/admin/mensajes/plantillas?guardada=1');
}
