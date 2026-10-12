'use client';

import { FormMessage, useAdminAction } from '@/modules/admin';
import { Checkbox, Field, Input, SubmitButton } from '@/components/ui';
import { saveShippingRate } from '../server/admin-actions';

/** Tarifa de una zona: precio, envío gratis opcional y si se ofrece. */
export function ShippingRateForm({
  zone,
  price,
  freeFrom,
  active,
}: {
  zone: string;
  /** En euros, para el campo («4,95»). */
  price: string;
  freeFrom: string;
  active: boolean;
}) {
  const { state, pending, onSubmit } = useAdminAction(saveShippingRate);
  return (
    <form
      onSubmit={onSubmit}
      className="grid items-end gap-4 sm:grid-cols-2 xl:grid-cols-[10rem_14rem_auto_auto]"
    >
      <input type="hidden" name="zone" value={zone} />
      <Field label="Precio (€, con IVA)">
        <Input name="price" inputMode="decimal" defaultValue={price} required />
      </Field>
      <Field label="Gratis desde (€)" hint="Vacío: nunca gratis.">
        <Input name="freeFrom" inputMode="decimal" defaultValue={freeFrom} />
      </Field>
      <Checkbox
        name="active"
        defaultChecked={active}
        label="Ofrecer el envío"
      />
      <SubmitButton pending={pending} variant="outline">
        Guardar
      </SubmitButton>
      <div className="sm:col-span-2 xl:col-span-4">
        <FormMessage state={state} />
      </div>
    </form>
  );
}
