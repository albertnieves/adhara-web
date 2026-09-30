'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { ActionState } from '@/modules/admin';
import { describeDbError, fail, ok } from '@/modules/admin';
import { requirePermission, requireStaff } from '@/modules/auth/server';
import { isAllowed } from '@/modules/auth';
import { MOVEMENT_LABELS } from '../domain/labels';
import type { MovementType } from '../domain/movements';
import {
  MOVEMENT_PERMISSIONS,
  MOVEMENT_TYPES,
  applyMovement,
  isSignedMovement,
} from '../domain/movements';

/*
 * Movimientos desde el panel. La función SQL aplica las mismas reglas dentro
 * de la transacción con bloqueo de fila; aquí se valida antes para dar un
 * mensaje claro y se comprueba el permiso del tipo.
 */

function refresh() {
  // Inventario, inicio, movimientos y la ficha de cada perfume del panel.
  revalidatePath('/admin', 'layout');
  // La tienda muestra disponible / últimas unidades / agotado.
  revalidatePath('/', 'layout');
}

const movementInput = z.object({
  variantId: z.uuid(),
  locationId: z.uuid(),
  type: z.enum(MOVEMENT_TYPES),
  quantity: z.coerce.number().int(),
  reason: z.string().trim().max(300),
  reference: z.string().trim().max(120),
  onHand: z.coerce.number().int().min(0),
  reserved: z.coerce.number().int().min(0),
});

export async function recordMovement(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const staff = await requireStaff();
  const parsed = movementInput.safeParse({
    variantId: formData.get('variantId'),
    locationId: formData.get('locationId'),
    type: formData.get('type'),
    quantity: formData.get('quantity'),
    reason: formData.get('reason') ?? '',
    reference: formData.get('reference') ?? '',
    onHand: formData.get('onHand') ?? 0,
    reserved: formData.get('reserved') ?? 0,
  });
  if (!parsed.success) return fail('Revisa la cantidad.');
  const m = parsed.data;
  const type: MovementType = m.type;
  const permission = MOVEMENT_PERMISSIONS[type];
  if (
    !permission ||
    !isAllowed({ role: staff.role, aal: 'aal2' }, permission)
  ) {
    return fail('No tienes permiso para este movimiento.');
  }
  // Validación previa con el nivel mostrado; la definitiva es la de SQL.
  const quantity = isSignedMovement(type) ? m.quantity : Math.abs(m.quantity);
  const preview = applyMovement(
    { onHand: m.onHand, reserved: m.reserved },
    { type, quantity, reason: m.reason },
  );
  // Solo errores que no dependen del nivel (que puede haber cambiado).
  if (
    !preview.ok &&
    (preview.error === 'invalid_quantity' ||
      preview.error === 'reason_required')
  ) {
    return fail(describeDbError({ message: preview.error }));
  }
  const { data, error } = await staff.supabase.rpc(
    'admin_record_inventory_movement',
    {
      p_variant_id: m.variantId,
      p_location_id: m.locationId,
      p_type: type,
      p_quantity: quantity,
      p_reason: m.reason || undefined,
      p_reference: m.reference || undefined,
    },
  );
  if (error) return fail(describeDbError(error));
  refresh();
  return ok(
    `${MOVEMENT_LABELS[type]} registrada. Quedan ${data.on_hand_after} uds.`,
  );
}

const stocktakeInput = z.object({
  variantId: z.uuid(),
  locationId: z.uuid(),
  counted: z.coerce.number().int().min(0),
  reason: z.string().trim().max(300),
});

export async function recordStocktake(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requirePermission('inventory.stocktake');
  const parsed = stocktakeInput.safeParse({
    variantId: formData.get('variantId'),
    locationId: formData.get('locationId'),
    counted: formData.get('counted'),
    reason: formData.get('reason') ?? '',
  });
  if (!parsed.success) return fail('El recuento debe ser un número entero.');
  const s = parsed.data;
  const { data, error } = await supabase.rpc('admin_record_stocktake', {
    p_variant_id: s.variantId,
    p_location_id: s.locationId,
    p_counted: s.counted,
    p_reason: s.reason || undefined,
  });
  if (error) return fail(describeDbError(error));
  refresh();
  // Sin diferencia la función no crea movimiento.
  if (!data || data.id == null)
    return ok('Recuento correcto: coincide con el stock.');
  return ok(
    `Recuento registrado: ${data.quantity > 0 ? '+' : ''}${data.quantity} uds. Quedan ${data.on_hand_after}.`,
  );
}

const reorderInput = z.object({
  variantId: z.uuid(),
  locationId: z.uuid(),
  reorderPoint: z
    .string()
    .trim()
    .transform((v) => (v ? Number(v) : null))
    .pipe(z.number().int().min(0).max(100000).nullable()),
});

export async function setReorderPoint(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requirePermission('inventory.adjust');
  const parsed = reorderInput.safeParse({
    variantId: formData.get('variantId'),
    locationId: formData.get('locationId'),
    reorderPoint: formData.get('reorderPoint') ?? '',
  });
  if (!parsed.success) return fail('El punto de pedido debe ser un número.');
  const { error } = await supabase.rpc('admin_set_reorder_point', {
    p_variant_id: parsed.data.variantId,
    p_location_id: parsed.data.locationId,
    // La función acepta null (sin alerta); el tipo generado no lo refleja.
    p_reorder_point: parsed.data.reorderPoint as number,
  });
  if (error) return fail(describeDbError(error));
  refresh();
  return ok('Punto de pedido guardado.');
}
