'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { parseEuros } from '@/lib/money';
import type { ActionState } from '@/modules/admin';
import { describeDbError, fail, ok } from '@/modules/admin';
import { requirePermission } from '@/modules/auth/server';
import {
  BILLING_STATUSES,
  CONTROL_AREAS,
  CONTROL_ERRORS,
  COST_CATEGORIES,
  COST_FREQUENCIES,
  DELIVERY_STATUSES,
  TASK_OWNERS,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from '../domain/labels';

/*
 * Tareas, costes y entregas del control. Cada acción exige business.control
 * (con MFA) en servidor; las funciones SQL lo vuelven a comprobar.
 */

const CONTROL = '/admin/control';

function refresh() {
  revalidatePath(CONTROL, 'layout');
}

function describe(error: { message?: string; code?: string }): string {
  return (
    (error.message && CONTROL_ERRORS[error.message]) || describeDbError(error)
  );
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null);

const optionalDate = z
  .string()
  .trim()
  .transform((value) => value || null)
  .pipe(z.iso.date('La fecha no es válida.').nullable());

const optionalId = z.union([z.uuid(), z.literal('')]);

/** Importe en euros («80», «80,50») → céntimos; vacío → null. */
const optionalEuros = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (!value) return null;
    const cents = parseEuros(value);
    if (cents === null) {
      ctx.addIssue({ code: 'custom', message: 'El importe no es válido.' });
      return z.NEVER;
    }
    return cents;
  });

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

// ---------------------------------------------------------------------------
// Tareas
// ---------------------------------------------------------------------------

const taskInput = z.object({
  id: optionalId,
  title: z.string().trim().min(1, 'El título es obligatorio.').max(200),
  area: z.enum(CONTROL_AREAS),
  status: z.enum(TASK_STATUSES),
  priority: z.enum(TASK_PRIORITIES),
  owner: z.enum(TASK_OWNERS),
  dueOn: optionalDate,
  notes: optionalText(2000),
});

export async function saveTask(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requirePermission('business.control');
  const parsed = taskInput.safeParse({
    id: text(formData, 'id'),
    title: text(formData, 'title'),
    area: text(formData, 'area'),
    status: text(formData, 'status'),
    priority: text(formData, 'priority'),
    owner: text(formData, 'owner'),
    dueOn: text(formData, 'dueOn'),
    notes: text(formData, 'notes'),
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? 'Revisa los datos.');
  }
  const t = parsed.data;
  const { error } = await supabase.rpc('admin_control_save_task', {
    // La función acepta null (alta); el tipo generado no lo refleja.
    p_id: (t.id || null) as string,
    p_title: t.title,
    p_area: t.area,
    p_status: t.status,
    p_priority: t.priority,
    p_owner: t.owner,
    p_due_on: t.dueOn ?? undefined,
    p_notes: t.notes ?? undefined,
  });
  if (error) return fail(describe(error));
  refresh();
  if (t.id) return ok('Tarea guardada.');
  redirect(`${CONTROL}/tareas`);
}

const taskStatusInput = z.object({
  id: z.uuid(),
  status: z.enum(TASK_STATUSES),
});

export async function setTaskStatus(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requirePermission('business.control');
  const parsed = taskStatusInput.safeParse({
    id: text(formData, 'id'),
    status: text(formData, 'status'),
  });
  if (!parsed.success) return fail('No se pudo cambiar la tarea.');
  const { error } = await supabase.rpc('admin_control_set_task_status', {
    p_id: parsed.data.id,
    p_status: parsed.data.status,
  });
  if (error) return fail(describe(error));
  refresh();
  return ok(
    parsed.data.status === 'done' ? 'Tarea hecha.' : 'Tarea reabierta.',
  );
}

export async function deleteTask(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requirePermission('business.control');
  const id = z.uuid().safeParse(text(formData, 'id'));
  if (!id.success) return fail('No se pudo borrar la tarea.');
  const { error } = await supabase.rpc('admin_control_delete_task', {
    p_id: id.data,
  });
  if (error) return fail(describe(error));
  refresh();
  redirect(`${CONTROL}/tareas`);
}

// ---------------------------------------------------------------------------
// Costes
// ---------------------------------------------------------------------------

const costInput = z
  .object({
    id: optionalId,
    concept: z.string().trim().min(1, 'El concepto es obligatorio.').max(120),
    area: z.enum(CONTROL_AREAS),
    category: z.enum(COST_CATEGORIES),
    amount: optionalEuros.pipe(
      z
        .number({ error: 'El importe es obligatorio.' })
        .int()
        .min(0)
        .max(100_000_000, 'El importe es demasiado alto.'),
    ),
    frequency: z.enum(COST_FREQUENCIES),
    startsOn: z.iso.date('La fecha de inicio es obligatoria.'),
    endsOn: optionalDate,
    notes: optionalText(1000),
  })
  .refine((c) => c.endsOn === null || c.endsOn >= c.startsOn, {
    message: 'La fecha de fin no puede ser anterior al inicio.',
  });

export async function saveCost(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requirePermission('business.control');
  const parsed = costInput.safeParse({
    id: text(formData, 'id'),
    concept: text(formData, 'concept'),
    area: text(formData, 'area'),
    category: text(formData, 'category'),
    amount: text(formData, 'amount'),
    frequency: text(formData, 'frequency'),
    startsOn: text(formData, 'startsOn'),
    endsOn: text(formData, 'endsOn'),
    notes: text(formData, 'notes'),
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? 'Revisa los datos.');
  }
  const c = parsed.data;
  const { error } = await supabase.rpc('admin_control_save_cost', {
    p_id: (c.id || null) as string,
    p_concept: c.concept,
    p_area: c.area,
    p_category: c.category,
    p_amount_net_cents: c.amount,
    p_frequency: c.frequency,
    p_starts_on: c.startsOn,
    p_ends_on: c.endsOn ?? undefined,
    p_notes: c.notes ?? undefined,
  });
  if (error) return fail(describe(error));
  refresh();
  if (c.id) return ok('Coste guardado.');
  redirect(`${CONTROL}/costes`);
}

export async function deleteCost(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requirePermission('business.control');
  const id = z.uuid().safeParse(text(formData, 'id'));
  if (!id.success) return fail('No se pudo borrar el coste.');
  const { error } = await supabase.rpc('admin_control_delete_cost', {
    p_id: id.data,
  });
  if (error) return fail(describe(error));
  refresh();
  redirect(`${CONTROL}/costes`);
}

// ---------------------------------------------------------------------------
// Entregas
// ---------------------------------------------------------------------------

const deliveryInput = z.object({
  id: optionalId,
  title: z.string().trim().min(1, 'El título es obligatorio.').max(200),
  description: optionalText(2000),
  status: z.enum(DELIVERY_STATUSES),
  dueOn: optionalDate,
  deliveredOn: optionalDate,
  reference: optionalText(300),
  amount: optionalEuros.pipe(
    z
      .number()
      .int()
      .min(0)
      .max(100_000_000, 'El importe es demasiado alto.')
      .nullable(),
  ),
  billingStatus: z
    .union([z.enum(BILLING_STATUSES), z.literal('')])
    .transform((value) => value || null),
});

export async function saveDelivery(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requirePermission('business.control');
  const parsed = deliveryInput.safeParse({
    id: text(formData, 'id'),
    title: text(formData, 'title'),
    description: text(formData, 'description'),
    status: text(formData, 'status'),
    dueOn: text(formData, 'dueOn'),
    deliveredOn: text(formData, 'deliveredOn'),
    reference: text(formData, 'reference'),
    amount: text(formData, 'amount'),
    billingStatus: text(formData, 'billingStatus'),
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? 'Revisa los datos.');
  }
  const d = parsed.data;
  const { error } = await supabase.rpc('admin_control_save_delivery', {
    p_id: (d.id || null) as string,
    p_title: d.title,
    p_status: d.status,
    p_description: d.description ?? undefined,
    p_due_on: d.dueOn ?? undefined,
    p_delivered_on: d.deliveredOn ?? undefined,
    p_reference: d.reference ?? undefined,
    p_amount_net_cents: d.amount ?? undefined,
    p_billing_status: d.billingStatus ?? undefined,
  });
  if (error) return fail(describe(error));
  refresh();
  if (d.id) return ok('Entrega guardada.');
  redirect(`${CONTROL}/entregas`);
}

export async function deleteDelivery(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requirePermission('business.control');
  const id = z.uuid().safeParse(text(formData, 'id'));
  if (!id.success) return fail('No se pudo borrar la entrega.');
  const { error } = await supabase.rpc('admin_control_delete_delivery', {
    p_id: id.data,
  });
  if (error) return fail(describe(error));
  refresh();
  redirect(`${CONTROL}/entregas`);
}
