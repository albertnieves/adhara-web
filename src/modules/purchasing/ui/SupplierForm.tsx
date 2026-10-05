'use client';

import { FormMessage, useAdminAction } from '@/modules/admin';
import { saveSupplier } from '../server/actions';
import type { Supplier } from '../server/admin';
import {
  Checkbox,
  Field,
  Input,
  SubmitButton,
  Textarea,
} from '@/components/ui';

/** Alta o edición de un proveedor (datos de contacto y plazo habitual). */
export function SupplierForm({ supplier }: { supplier?: Supplier }) {
  const { state, pending, onSubmit } = useAdminAction(saveSupplier);
  return (
    <form onSubmit={onSubmit} className="grid gap-5 sm:grid-cols-2">
      <input type="hidden" name="id" value={supplier?.id ?? ''} />
      <Field label="Nombre">
        <Input
          name="name"
          required
          maxLength={120}
          defaultValue={supplier?.name}
        />
      </Field>
      <Field label="Persona de contacto">
        <Input
          name="contactName"
          maxLength={120}
          defaultValue={supplier?.contactName ?? ''}
        />
      </Field>
      <Field label="Email">
        <Input
          name="email"
          type="email"
          maxLength={200}
          defaultValue={supplier?.email ?? ''}
        />
      </Field>
      <Field label="Teléfono">
        <Input
          name="phone"
          type="tel"
          maxLength={40}
          defaultValue={supplier?.phone ?? ''}
        />
      </Field>
      <Field
        label="Plazo habitual (días)"
        hint="Desde que se pide hasta que llega. Vacío: desconocido."
      >
        <Input
          name="leadTimeDays"
          type="number"
          inputMode="numeric"
          min={0}
          max={365}
          defaultValue={supplier?.leadTimeDays ?? ''}
          className="tabular-nums"
        />
      </Field>
      <Checkbox
        name="active"
        defaultChecked={supplier?.active ?? true}
        label="Activo (se le pueden hacer pedidos)"
        className="self-end"
      />
      <Field label="Notas" className="sm:col-span-2">
        <Textarea
          name="notes"
          rows={3}
          maxLength={1000}
          defaultValue={supplier?.notes ?? ''}
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
