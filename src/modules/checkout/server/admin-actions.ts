'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { parseEuros } from '@/lib/money';
import type { ActionState } from '@/modules/admin';
import { describeDbError, fail, ok } from '@/modules/admin';
import { requirePermission } from '@/modules/auth/server';
import { SHIPPING_ZONE_LABELS, SHIPPING_ZONES } from '../domain/shipping';

/*
 * Panel → Configuración → Envíos. settings.manage (con MFA) en el servidor y
 * otra vez en admin_save_shipping_rate. La tienda lee las tarifas activas al
 * enseñar la cesta, así que el cambio se nota en la siguiente visita.
 */

const rateInput = z.object({
  zone: z.enum(SHIPPING_ZONES),
  price: z.string().trim().min(1, 'Indica el precio del envío.'),
  freeFrom: z.string().trim(),
  active: z.boolean(),
});

export async function saveShippingRate(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { supabase } = await requirePermission('settings.manage');
  const parsed = rateInput.safeParse({
    zone: form.get('zone'),
    price: form.get('price') ?? '',
    freeFrom: form.get('freeFrom') ?? '',
    active: form.get('active') === 'on',
  });
  if (!parsed.success)
    return fail(parsed.error.issues[0]?.message ?? 'Revisa los datos.');
  const input = parsed.data;
  const price = parseEuros(input.price);
  const freeFrom = input.freeFrom ? parseEuros(input.freeFrom) : null;
  if (price === null || price > 100000)
    return fail('El precio del envío no es válido (por ejemplo, 4,95).');
  if (input.freeFrom && (freeFrom === null || freeFrom < 1))
    return fail(
      'El importe para el envío gratis no es válido (por ejemplo, 60).',
    );
  const { error } = await supabase.rpc('admin_save_shipping_rate', {
    p_zone: input.zone,
    p_price_cents: price,
    // La función acepta null (sin envío gratis); el tipo generado no lo refleja.
    p_free_from_cents: freeFrom as number,
    p_active: input.active,
  });
  if (error) return fail(describeDbError(error));
  revalidatePath('/admin/configuracion/envios');
  return ok(
    `${SHIPPING_ZONE_LABELS[input.zone]}: ${
      input.active ? 'envío activo' : 'envío apagado'
    }.`,
  );
}
