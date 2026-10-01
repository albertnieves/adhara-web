'use client';

import Link from 'next/link';
import {
  Field,
  FormMessage,
  SubmitButton,
  useAdminAction,
} from '@/modules/admin';
import { ORDER_ACTION_LABELS } from '../domain/labels';
import type { PurchaseOrderAction } from '../domain/orders';
import {
  changePurchaseOrderStatus,
  createPurchaseOrder,
  updatePurchaseOrder,
} from '../server/actions';

/** Nuevo borrador de pedido: proveedor, fecha prevista y notas. */
export function NewOrderForm({
  suppliers,
}: {
  suppliers: { id: string; name: string; leadTimeDays: number | null }[];
}) {
  const { state, pending, onSubmit } = useAdminAction(createPurchaseOrder);
  if (suppliers.length === 0) {
    return (
      <p className="text-smoke text-sm">
        Primero da de alta un proveedor en{' '}
        <Link href="/admin/compras/proveedores" className="underline">
          Proveedores
        </Link>
        .
      </p>
    );
  }
  return (
    <form
      onSubmit={onSubmit}
      className="grid items-end gap-4 sm:grid-cols-2 xl:grid-cols-[1fr_12rem_1fr_auto]"
    >
      <Field label="Proveedor">
        <select name="supplierId" required defaultValue="" className="input">
          <option value="" disabled>
            Elige un proveedor
          </option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.leadTimeDays !== null ? ` · ${s.leadTimeDays} días` : ''}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Llegada prevista">
        <input name="expectedOn" type="date" className="input" />
      </Field>
      <Field label="Notas">
        <input name="notes" maxLength={1000} className="input" />
      </Field>
      <SubmitButton pending={pending}>Crear borrador</SubmitButton>
      <div className="sm:col-span-2 xl:col-span-4">
        <FormMessage state={state} />
      </div>
    </form>
  );
}

/** Datos del pedido que pueden cambiar mientras está abierto. */
export function OrderHeaderForm({
  orderId,
  revision,
  expectedOn,
  supplierReference,
  notes,
}: {
  orderId: string;
  revision: number;
  expectedOn: string | null;
  supplierReference: string | null;
  notes: string | null;
}) {
  const { state, pending, onSubmit } = useAdminAction(updatePurchaseOrder);
  return (
    <form
      onSubmit={onSubmit}
      className="grid items-end gap-4 sm:grid-cols-2 xl:grid-cols-[12rem_1fr_1fr_auto]"
    >
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="revision" value={revision} />
      <Field label="Llegada prevista">
        <input
          name="expectedOn"
          type="date"
          defaultValue={expectedOn ?? ''}
          className="input"
        />
      </Field>
      <Field
        label="Ref. del proveedor"
        hint="Su número de pedido o confirmación."
      >
        <input
          name="supplierReference"
          maxLength={80}
          defaultValue={supplierReference ?? ''}
          className="input"
        />
      </Field>
      <Field label="Notas">
        <input
          name="notes"
          maxLength={1000}
          defaultValue={notes ?? ''}
          className="input"
        />
      </Field>
      <SubmitButton pending={pending} variant="ghost">
        Guardar
      </SubmitButton>
      <div className="sm:col-span-2 xl:col-span-4">
        <FormMessage state={state} />
      </div>
    </form>
  );
}

const CONFIRM: Partial<Record<PurchaseOrderAction | 'delete', string>> = {
  cancel: '¿Cancelar este pedido? No se podrá recibir.',
  close:
    '¿Cerrar el pedido con faltas? Lo que falta dejará de contar como pendiente de recibir.',
  delete: '¿Borrar este borrador?',
};

/** Botones de estado del pedido; cada uno pide confirmación si no es reversible. */
export function OrderStatusActions({
  orderId,
  revision,
  actions,
  canDelete,
}: {
  orderId: string;
  revision: number;
  actions: PurchaseOrderAction[];
  canDelete: boolean;
}) {
  const { state, pending, onSubmit } = useAdminAction(
    changePurchaseOrderStatus,
  );
  const all: (PurchaseOrderAction | 'delete')[] = [
    ...actions,
    ...(canDelete ? (['delete'] as const) : []),
  ];
  if (all.length === 0) return null;
  return (
    <form
      onSubmit={(event) => {
        const submitter = (event.nativeEvent as SubmitEvent)
          .submitter as HTMLButtonElement | null;
        const message = submitter ? CONFIRM[submitter.value as 'delete'] : null;
        if (message && !window.confirm(message)) {
          event.preventDefault();
          return;
        }
        onSubmit(event);
      }}
      className="flex flex-wrap items-center gap-3"
    >
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="revision" value={revision} />
      {all.map((action) => (
        <SubmitButton
          key={action}
          name="action"
          value={action}
          pending={pending}
          pendingLabel="…"
          variant={
            action === 'order'
              ? 'primary'
              : action === 'delete' || action === 'cancel'
                ? 'danger'
                : 'ghost'
          }
        >
          {action === 'delete'
            ? 'Borrar borrador'
            : ORDER_ACTION_LABELS[action]}
        </SubmitButton>
      ))}
      <FormMessage state={state} />
    </form>
  );
}
