'use client';

import {
  Field,
  FormMessage,
  SubmitButton,
  useAdminAction,
} from '@/modules/admin';
import { saveSupplier } from '../server/actions';
import type { Supplier } from '../server/admin';

/** Alta o edición de un proveedor (datos de contacto y plazo habitual). */
export function SupplierForm({ supplier }: { supplier?: Supplier }) {
  const { state, pending, onSubmit } = useAdminAction(saveSupplier);
  return (
    <form onSubmit={onSubmit} className="grid gap-5 sm:grid-cols-2">
      <input type="hidden" name="id" value={supplier?.id ?? ''} />
      <Field label="Nombre">
        <input
          name="name"
          required
          maxLength={120}
          defaultValue={supplier?.name}
          className="input"
        />
      </Field>
      <Field label="Persona de contacto">
        <input
          name="contactName"
          maxLength={120}
          defaultValue={supplier?.contactName ?? ''}
          className="input"
        />
      </Field>
      <Field label="Email">
        <input
          name="email"
          type="email"
          maxLength={200}
          defaultValue={supplier?.email ?? ''}
          className="input"
        />
      </Field>
      <Field label="Teléfono">
        <input
          name="phone"
          type="tel"
          maxLength={40}
          defaultValue={supplier?.phone ?? ''}
          className="input"
        />
      </Field>
      <Field
        label="Plazo habitual (días)"
        hint="Desde que se pide hasta que llega. Vacío: desconocido."
      >
        <input
          name="leadTimeDays"
          type="number"
          inputMode="numeric"
          min={0}
          max={365}
          defaultValue={supplier?.leadTimeDays ?? ''}
          className="input tabular-nums"
        />
      </Field>
      <label className="flex items-center gap-3 self-end pb-3 text-sm">
        <input
          type="checkbox"
          name="active"
          defaultChecked={supplier?.active ?? true}
          className="h-5 w-5"
        />
        Activo (se le pueden hacer pedidos)
      </label>
      <Field label="Notas" className="sm:col-span-2">
        <textarea
          name="notes"
          rows={3}
          maxLength={1000}
          defaultValue={supplier?.notes ?? ''}
          className="input"
        />
      </Field>
      <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
        <SubmitButton pending={pending}>
          {supplier ? 'Guardar proveedor' : 'Crear proveedor'}
        </SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
