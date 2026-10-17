'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { ActionState } from '@/modules/admin';
import { describeDbError, fail, ok } from '@/modules/admin';
import { requirePermission } from '@/modules/auth/server';
import { discountCodeInput } from '../domain';

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
