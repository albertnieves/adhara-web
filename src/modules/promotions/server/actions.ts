'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { ActionState } from '@/modules/admin';
import { describeDbError, fail, ok } from '@/modules/admin';
import { isAllowed } from '@/modules/auth';
import { requirePermission } from '@/modules/auth/server';
import { discountBatchInput, discountCodeInput } from '../domain';

/*
 * Panel → Web → Códigos de descuento (DECISIONS §151). promotions.manage
 * (con MFA) aquí y otra vez en admin_save_discount_code, que valida los
 * importes y deja la auditoría. Un código nuevo lleva a su ficha.
 */

const MESSAGES: Record<string, string> = {
  code_taken: 'Ya hay un código con ese texto. Elige otro.',
  code_immutable:
    'El texto del código no cambia después de crearlo: los pedidos lo guardan tal cual. Crea otro si lo necesitas.',
  invalid_discount:
    'Revisa el descuento: del 1 % al 90 % o de 1 € a 1.000 €, y el final después del inicio.',
  not_found: 'Ese código ya no existe.',
};

export async function saveDiscountCode(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { supabase } = await requirePermission('promotions.manage');
  const text = (name: string) => String(form.get(name) ?? '');
  const parsed = discountCodeInput.safeParse({
    id: text('id'),
    code: text('code'),
    description: text('description'),
    kind: text('kind'),
    value: text('value'),
    minItems: text('minItems'),
    startsAt: text('startsAt'),
    endsAt: text('endsAt'),
    maxUses: text('maxUses'),
    oncePerEmail: form.get('oncePerEmail') === 'on',
    excludeSaleItems: form.get('excludeSaleItems') === 'on',
    active: form.get('active') === 'on',
  });
  if (!parsed.success)
    return fail(parsed.error.issues[0]?.message ?? 'Revisa los datos.');
  const input = parsed.data;
  // Los tipos generados no admiten null en los parámetros opcionales; la
  // función los trata como «sin límite» o «sin fecha».
  const { data, error } = await supabase.rpc('admin_save_discount_code', {
    p_id: input.id as string,
    p_code: input.code,
    p_description: input.description as string,
    p_kind: input.kind,
    p_percent_bp: input.percentBp as number,
    p_amount_cents: input.amountCents as number,
    p_min_items_cents: input.minItemsCents as number,
    p_starts_at: input.startsAt as string,
    p_ends_at: input.endsAt as string,
    p_max_uses: input.maxUses as number,
    p_once_per_email: input.oncePerEmail,
    p_exclude_sale_items: input.excludeSaleItems,
    p_active: input.active,
  });
  if (error) return fail(MESSAGES[error.message] ?? describeDbError(error));
  revalidatePath('/admin/descuentos');
  if (!input.id) redirect(`/admin/descuentos/${data.id}?creado=1`);
  revalidatePath(`/admin/descuentos/${input.id}`);
  return ok(`${input.code}: cambios guardados.`);
}

const BATCH_MESSAGES: Record<string, string> = {
  no_recipients:
    'No hay nadie suscrito al Club ahora mismo: no hay a quién dar códigos.',
  invalid_batch_size: 'De 1 a 5.000 códigos por lote.',
  invalid_batch: 'Revisa el nombre y el prefijo (de 2 a 10 letras o números).',
  invalid_discount:
    'Revisa el descuento: del 1 % al 90 % o de 1 € a 1.000 €, y el final después del inicio.',
  forbidden:
    'Para dar un código a cada suscriptor hace falta también el permiso de clientes.',
  not_found: 'Ese lote ya no existe.',
};

/**
 * Crea un lote de códigos únicos (DECISIONS §185) y lleva a su ficha. Uno
 * para cada suscriptor activo exige además customers.view (lo vuelve a
 * comprobar la base).
 */
export async function createDiscountBatch(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const staff = await requirePermission('promotions.manage');
  const text = (name: string) => String(form.get(name) ?? '');
  const parsed = discountBatchInput.safeParse({
    name: text('name'),
    prefix: text('prefix'),
    kind: text('kind'),
    value: text('value'),
    minItems: text('minItems'),
    startsAt: text('startsAt'),
    endsAt: text('endsAt'),
    excludeSaleItems: form.get('excludeSaleItems') === 'on',
    audience: text('audience'),
    count: text('count'),
  });
  if (!parsed.success)
    return fail(parsed.error.issues[0]?.message ?? 'Revisa los datos.');
  const input = parsed.data;
  if (
    input.audience === 'subscribers' &&
    !isAllowed({ role: staff.role, aal: 'aal2' }, 'customers.view')
  )
    return fail(BATCH_MESSAGES.forbidden!);
  // Los tipos generados no admiten null en los parámetros opcionales; la
  // función los trata como «sin mínimo», «sin fecha» o «sin número».
  const { data, error } = await staff.supabase.rpc(
    'admin_create_discount_batch',
    {
      p_name: input.name,
      p_prefix: input.prefix,
      p_kind: input.kind,
      p_percent_bp: input.percentBp as number,
      p_amount_cents: input.amountCents as number,
      p_min_items_cents: input.minItemsCents as number,
      p_starts_at: input.startsAt as string,
      p_ends_at: input.endsAt as string,
      p_exclude_sale_items: input.excludeSaleItems,
      p_audience: input.audience,
      p_count: input.count as number,
    },
  );
  if (error)
    return fail(BATCH_MESSAGES[error.message] ?? describeDbError(error));
  revalidatePath('/admin/descuentos');
  redirect(`/admin/descuentos/lotes/${data.id}?creado=1`);
}

/** Enciende o apaga todos los códigos de un lote. */
export async function setDiscountBatchActive(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { supabase } = await requirePermission('promotions.manage');
  const id = String(form.get('id') ?? '');
  const active = form.get('active') === 'true';
  const { data, error } = await supabase.rpc(
    'admin_set_discount_batch_active',
    { p_batch_id: id, p_active: active },
  );
  if (error)
    return fail(BATCH_MESSAGES[error.message] ?? describeDbError(error));
  revalidatePath('/admin/descuentos');
  revalidatePath(`/admin/descuentos/lotes/${id}`);
  return ok(
    active
      ? `Lote encendido: ${data} ${data === 1 ? 'código vuelve' : 'códigos vuelven'} a valer.`
      : `Lote apagado: ${data} ${data === 1 ? 'código deja' : 'códigos dejan'} de valer.`,
  );
}
