'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { parseEuros } from '@/lib/money';
import type { ActionState } from '@/modules/admin';
import { fail, ok } from '@/modules/admin';
import { isAllowed } from '@/modules/auth';
import { requirePermission } from '@/modules/auth/server';
import { getDefaultLocation } from '@/modules/inventory/server';
import { ORDER_ACTION_LABELS, ORDER_STATUS_LABELS } from '../domain/labels';
import type { PurchaseOrderStatus } from '../domain/orders';
import {
  PURCHASE_ORDER_ACTIONS,
  isPurchaseOrderStatus,
} from '../domain/orders';
import { describePurchasingError } from './errors';

/*
 * Proveedores y pedidos de compra. Cada acción exige purchasing.manage (con
 * MFA) en servidor; las funciones SQL lo vuelven a comprobar y aplican la
 * revisión optimista, los estados y la recepción en una sola transacción.
 */

const COMPRAS = '/admin/compras';

function refreshPurchasing(orderId?: string) {
  revalidatePath(COMPRAS, 'layout');
  revalidatePath('/admin/reposicion');
  if (orderId) revalidatePath(`${COMPRAS}/${orderId}`);
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null);

const optionalDays = z
  .string()
  .trim()
  .transform((value) => (value ? Number(value) : null))
  .pipe(z.number().int().min(0).max(365).nullable());

const optionalDate = z
  .string()
  .trim()
  .transform((value) => value || null)
  .pipe(z.iso.date().nullable());

// ---------------------------------------------------------------------------
// Proveedores
// ---------------------------------------------------------------------------

const supplierInput = z.object({
  id: z.union([z.uuid(), z.literal('')]),
  name: z.string().trim().min(1, 'El nombre es obligatorio.').max(120),
  contactName: optionalText(120),
  email: z
    .string()
    .trim()
    .max(200)
    .transform((value) => value || null)
    .pipe(z.email('El email no es válido.').nullable()),
  phone: optionalText(40),
  leadTimeDays: optionalDays,
  notes: optionalText(1000),
  active: z.boolean(),
});

export async function saveSupplier(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requirePermission('purchasing.manage');
  const parsed = supplierInput.safeParse({
    id: formData.get('id') ?? '',
    name: formData.get('name') ?? '',
    contactName: formData.get('contactName') ?? '',
    email: formData.get('email') ?? '',
    phone: formData.get('phone') ?? '',
    leadTimeDays: formData.get('leadTimeDays') ?? '',
    notes: formData.get('notes') ?? '',
    active: formData.get('active') === 'on',
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? 'Revisa los datos.');
  }
  const s = parsed.data;
  const { data, error } = await supabase.rpc('admin_save_supplier', {
    // La función acepta null (alta); el tipo generado no lo refleja.
    p_id: (s.id || null) as string,
    p_name: s.name,
    p_contact_name: s.contactName ?? undefined,
    p_email: s.email ?? undefined,
    p_phone: s.phone ?? undefined,
    p_lead_time_days: s.leadTimeDays ?? undefined,
    p_notes: s.notes ?? undefined,
    p_active: s.active,
  });
  if (error) return fail(describePurchasingError(error));
  refreshPurchasing();
  if (!s.id) redirect(`${COMPRAS}/proveedores/${data}`);
  return ok('Proveedor guardado.');
}

const termsInput = z.object({
  supplierId: z.uuid(),
  variantId: z.uuid(),
  supplierSku: optionalText(80),
  packSize: z.coerce.number().int().min(1).max(10000),
  leadTimeDays: optionalDays,
  preferred: z.boolean(),
});

export async function saveSupplierTerms(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requirePermission('purchasing.manage');
  const parsed = termsInput.safeParse({
    supplierId: formData.get('supplierId'),
    variantId: formData.get('variantId'),
    supplierSku: formData.get('supplierSku') ?? '',
    packSize: formData.get('packSize') || 1,
    leadTimeDays: formData.get('leadTimeDays') ?? '',
    preferred: formData.get('preferred') === 'on',
  });
  if (!parsed.success) {
    return fail(
      'Revisa el múltiplo de compra (entero de 1 en adelante) y el plazo.',
    );
  }
  const t = parsed.data;
  const { error } = await supabase.rpc('admin_save_supplier_variant', {
    p_supplier_id: t.supplierId,
    p_variant_id: t.variantId,
    p_supplier_sku: t.supplierSku ?? undefined,
    p_pack_size: t.packSize,
    p_lead_time_days: t.leadTimeDays ?? undefined,
    p_preferred: t.preferred,
  });
  if (error) return fail(describePurchasingError(error));
  refreshPurchasing();
  return ok('Condiciones guardadas.');
}

const removeTermsInput = z.object({
  supplierId: z.uuid(),
  variantId: z.uuid(),
});

export async function removeSupplierTerms(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requirePermission('purchasing.manage');
  const parsed = removeTermsInput.safeParse({
    supplierId: formData.get('supplierId'),
    variantId: formData.get('variantId'),
  });
  if (!parsed.success) return fail('Formato no válido.');
  const { error } = await supabase.rpc('admin_remove_supplier_variant', {
    p_supplier_id: parsed.data.supplierId,
    p_variant_id: parsed.data.variantId,
  });
  if (error) return fail(describePurchasingError(error));
  refreshPurchasing();
  return ok('Formato quitado del proveedor.');
}

const assignInput = z.object({
  supplierId: z.uuid(),
  brandId: z.union([z.uuid(), z.literal('all')]),
  preferred: z.boolean(),
});

export async function assignSupplierBrand(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requirePermission('purchasing.manage');
  const parsed = assignInput.safeParse({
    supplierId: formData.get('supplierId'),
    brandId: formData.get('brandId'),
    preferred: formData.get('preferred') === 'on',
  });
  if (!parsed.success) return fail('Elige una marca o todo el catálogo.');
  const { data, error } = await supabase.rpc('admin_assign_supplier_brand', {
    p_supplier_id: parsed.data.supplierId,
    p_brand_id: parsed.data.brandId === 'all' ? undefined : parsed.data.brandId,
    p_preferred: parsed.data.preferred,
  });
  if (error) return fail(describePurchasingError(error));
  refreshPurchasing();
  return ok(
    data === 0
      ? 'Todos esos formatos ya estaban asignados a este proveedor.'
      : `${data} ${data === 1 ? 'formato asignado' : 'formatos asignados'}. Ajusta referencias y múltiplos si hace falta.`,
  );
}

// ---------------------------------------------------------------------------
// Pedidos
// ---------------------------------------------------------------------------

const newOrderInput = z.object({
  supplierId: z.uuid('Elige un proveedor.'),
  expectedOn: optionalDate,
  notes: optionalText(1000),
});

export async function createPurchaseOrder(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requirePermission('purchasing.manage');
  const parsed = newOrderInput.safeParse({
    supplierId: formData.get('supplierId'),
    expectedOn: formData.get('expectedOn') ?? '',
    notes: formData.get('notes') ?? '',
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? 'Revisa los datos.');
  }
  const location = await getDefaultLocation(supabase);
  if (!location) return fail('No hay ninguna ubicación activa.');
  const { data, error } = await supabase.rpc('admin_create_purchase_order', {
    p_supplier_id: parsed.data.supplierId,
    p_location_id: location.id,
    p_expected_on: parsed.data.expectedOn ?? undefined,
    p_notes: parsed.data.notes ?? undefined,
  });
  if (error) return fail(describePurchasingError(error));
  refreshPurchasing();
  redirect(`${COMPRAS}/${data}`);
}

const headerInput = z.object({
  orderId: z.uuid(),
  revision: z.coerce.number().int().min(0),
  expectedOn: optionalDate,
  supplierReference: optionalText(80),
  notes: optionalText(1000),
});

export async function updatePurchaseOrder(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requirePermission('purchasing.manage');
  const parsed = headerInput.safeParse({
    orderId: formData.get('orderId'),
    revision: formData.get('revision'),
    expectedOn: formData.get('expectedOn') ?? '',
    supplierReference: formData.get('supplierReference') ?? '',
    notes: formData.get('notes') ?? '',
  });
  if (!parsed.success) return fail('Revisa la fecha y los textos.');
  const h = parsed.data;
  const { error } = await supabase.rpc('admin_update_purchase_order', {
    p_order_id: h.orderId,
    p_revision: h.revision,
    p_expected_on: h.expectedOn ?? undefined,
    p_supplier_reference: h.supplierReference ?? undefined,
    p_notes: h.notes ?? undefined,
  });
  if (error) return fail(describePurchasingError(error));
  refreshPurchasing(h.orderId);
  return ok('Datos del pedido guardados.');
}

export type LinesPayload = {
  orderId: string;
  revision: number;
  lines: { variantId: string; quantity: number; unitCost?: string }[];
};

const linesInput = z.object({
  orderId: z.uuid(),
  revision: z.number().int().min(0),
  lines: z
    .array(
      z.object({
        variantId: z.uuid(),
        quantity: z.number().int().min(1).max(100000),
        unitCost: z.string().trim().max(20).optional(),
      }),
    )
    .max(500),
});

type LineItem = {
  variant_id: string;
  quantity: number;
  unit_cost_net_cents?: number | null;
};

/** Guarda todas las líneas de un borrador (llamada desde el editor). */
export async function savePurchaseOrderLines(
  payload: LinesPayload,
): Promise<ActionState> {
  const staff = await requirePermission('purchasing.manage');
  const parsed = linesInput.safeParse(payload);
  if (!parsed.success)
    return fail('Revisa las cantidades (enteros de 1 en adelante).');
  const canCost = isAllowed(
    { role: staff.role, aal: 'aal2' },
    'pricing.view_cost',
  );
  const items: LineItem[] = [];
  for (const line of parsed.data.lines) {
    const item: LineItem = {
      variant_id: line.variantId,
      quantity: line.quantity,
    };
    // Solo quien ve costes los envía; vacío = sin coste para esa línea.
    if (canCost && line.unitCost !== undefined) {
      if (line.unitCost === '') {
        item.unit_cost_net_cents = null;
      } else {
        const cents = parseEuros(line.unitCost);
        if (cents === null) return fail(`Coste no válido: «${line.unitCost}».`);
        item.unit_cost_net_cents = cents;
      }
    }
    items.push(item);
  }
  if (new Set(items.map((i) => i.variant_id)).size !== items.length) {
    return fail('Hay un formato repetido en el pedido.');
  }
  const { error } = await staff.supabase.rpc('admin_set_purchase_order_lines', {
    p_order_id: parsed.data.orderId,
    p_revision: parsed.data.revision,
    p_lines: items,
  });
  if (error) return fail(describePurchasingError(error));
  refreshPurchasing(parsed.data.orderId);
  return ok('Líneas guardadas.');
}

const transitionInput = z.object({
  orderId: z.uuid(),
  revision: z.coerce.number().int().min(0),
  action: z.enum([...PURCHASE_ORDER_ACTIONS, 'delete']),
});

export async function changePurchaseOrderStatus(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requirePermission('purchasing.manage');
  const parsed = transitionInput.safeParse({
    orderId: formData.get('orderId'),
    revision: formData.get('revision'),
    action: formData.get('action'),
  });
  if (!parsed.success) return fail('Acción no válida.');
  const t = parsed.data;
  if (t.action === 'delete') {
    const { error } = await supabase.rpc('admin_delete_purchase_order', {
      p_order_id: t.orderId,
      p_revision: t.revision,
    });
    if (error) return fail(describePurchasingError(error));
    refreshPurchasing();
    redirect(COMPRAS);
  }
  const { data, error } = await supabase.rpc(
    'admin_transition_purchase_order',
    {
      p_order_id: t.orderId,
      p_revision: t.revision,
      p_action: t.action,
    },
  );
  if (error) return fail(describePurchasingError(error));
  refreshPurchasing(t.orderId);
  const status = data as PurchaseOrderStatus;
  return ok(
    `${ORDER_ACTION_LABELS[t.action]}: el pedido queda ${
      isPurchaseOrderStatus(status)
        ? ORDER_STATUS_LABELS[status].toLowerCase()
        : status
    }.`,
  );
}

const receiveInput = z.object({
  orderId: z.uuid(),
  requestId: z.uuid(),
  reference: optionalText(120),
  recordCosts: z.boolean(),
});

/** Recepción de mercancía: campos «qty:<línea>» con las unidades que llegan. */
export async function receivePurchaseOrder(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const staff = await requirePermission('purchasing.manage');
  const parsed = receiveInput.safeParse({
    orderId: formData.get('orderId'),
    requestId: formData.get('requestId'),
    reference: formData.get('reference') ?? '',
    recordCosts: formData.get('recordCosts') === 'on',
  });
  if (!parsed.success) return fail('Recarga la página e inténtalo de nuevo.');
  const items: { line_id: number; quantity: number }[] = [];
  for (const [key, value] of formData.entries()) {
    const match = /^qty:(\d+)$/.exec(key);
    if (!match || typeof value !== 'string' || value.trim() === '') continue;
    const quantity = Number(value);
    if (!Number.isSafeInteger(quantity) || quantity < 0) {
      return fail('Las unidades recibidas deben ser enteros.');
    }
    if (quantity > 0) items.push({ line_id: Number(match[1]), quantity });
  }
  if (items.length === 0) return fail('Indica cuántas unidades han llegado.');
  const r = parsed.data;
  const recordCosts =
    r.recordCosts &&
    isAllowed({ role: staff.role, aal: 'aal2' }, 'pricing.edit_cost');
  const { error } = await staff.supabase.rpc('admin_receive_purchase_order', {
    p_order_id: r.orderId,
    p_request_id: r.requestId,
    p_items: items,
    p_reference: r.reference ?? undefined,
    p_record_costs: recordCosts,
  });
  if (error) return fail(describePurchasingError(error));
  refreshPurchasing(r.orderId);
  // La recepción suma stock: inventario, movimientos y disponibilidad pública.
  revalidatePath('/admin', 'layout');
  revalidatePath('/', 'layout');
  const units = items.reduce((sum, item) => sum + item.quantity, 0);
  return ok(
    `Recepción registrada: ${units} ${units === 1 ? 'unidad' : 'unidades'} en stock.`,
  );
}

// ---------------------------------------------------------------------------
// Propuestas del vigilante → borradores de pedido
// ---------------------------------------------------------------------------

export type ProposalsState = ActionState & {
  created?: { id: string; supplierName: string; lines: number }[];
};

/**
 * Crea un borrador por proveedor con las propuestas marcadas. Campos:
 * «pick:<proveedor>:<formato>» (casilla) y «qty:<proveedor>:<formato>».
 * La persona decide qué y cuánto; aquí solo se valida y se crea el borrador
 * por el mismo caso de uso que un pedido manual.
 */
export async function createOrdersFromProposals(
  _: ProposalsState,
  formData: FormData,
): Promise<ProposalsState> {
  const { supabase } = await requirePermission('purchasing.manage');
  const location = await getDefaultLocation(supabase);
  if (!location) return fail('No hay ninguna ubicación activa.');
  const groups = new Map<string, { variant_id: string; quantity: number }[]>();
  const names = new Map<string, string>();
  for (const [key, value] of formData.entries()) {
    const pick = /^pick:([0-9a-f-]{36}):([0-9a-f-]{36})$/.exec(key);
    if (pick && value === 'on') {
      const supplierId = pick[1]!;
      const variantId = pick[2]!;
      const raw = formData.get(`qty:${supplierId}:${variantId}`);
      const quantity = Number(raw);
      if (
        !Number.isSafeInteger(quantity) ||
        quantity < 1 ||
        quantity > 100000
      ) {
        return fail(
          'Las cantidades a pedir deben ser enteros de 1 en adelante.',
        );
      }
      groups.set(supplierId, [
        ...(groups.get(supplierId) ?? []),
        { variant_id: variantId, quantity },
      ]);
    }
    const name = /^name:([0-9a-f-]{36})$/.exec(key);
    if (name && typeof value === 'string') names.set(name[1]!, value);
  }
  if (groups.size === 0) return fail('Marca al menos una propuesta.');
  const created: NonNullable<ProposalsState['created']> = [];
  for (const [supplierId, lines] of groups) {
    const { data, error } = await supabase.rpc('admin_create_purchase_order', {
      p_supplier_id: supplierId,
      p_location_id: location.id,
      p_lines: lines,
      p_notes: 'Creado desde las propuestas de Reposición.',
    });
    if (error) {
      refreshPurchasing();
      return {
        ...fail(
          `${describePurchasingError(error)}${created.length ? ` Se crearon ${created.length} borradores antes del error.` : ''}`,
        ),
        created,
      };
    }
    created.push({
      id: data,
      supplierName: names.get(supplierId) ?? 'Proveedor',
      lines: lines.length,
    });
  }
  refreshPurchasing();
  return {
    ...ok(
      `${created.length} ${created.length === 1 ? 'borrador creado' : 'borradores creados'}. Revísalos y márcalos como pedidos cuando los envíes.`,
    ),
    created,
  };
}
