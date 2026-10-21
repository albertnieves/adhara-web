'use client';

import { useState } from 'react';
import {
  Button,
  Checkbox,
  Field,
  Fieldset,
  Input,
  Radio,
  SubmitButton,
} from '@/components/ui';
import { FormMessage, useAdminAction } from '@/modules/admin';
import type { DiscountKind } from '../domain';
import { DISCOUNT_CODE_MAX } from '../domain';
import { saveDiscountCode } from '../server/actions';

/** Valores del formulario, ya como texto de los campos. */
export type DiscountCodeFormValues = {
  id: string | null;
  code: string;
  description: string;
  kind: DiscountKind;
  /** «10» (%) o «5,00» (€). */
  value: string;
  minItems: string;
  /** «2026-11-01T09:00», hora de Madrid. */
  startsAt: string;
  endsAt: string;
  maxUses: string;
  oncePerEmail: boolean;
  excludeSaleItems: boolean;
  active: boolean;
};

export const NEW_DISCOUNT_CODE: DiscountCodeFormValues = {
  id: null,
  code: '',
  description: '',
  kind: 'percent',
  value: '',
  minItems: '',
  startsAt: '',
  endsAt: '',
  maxUses: '',
  oncePerEmail: true,
  excludeSaleItems: false,
  active: true,
};

/** Sin letras que se confunden (O/0, I/1/L). */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** «CLUB-7K3Q9M»: difícil de adivinar y fácil de copiar del correo. */
function suggestCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  const suffix = [...bytes]
    .map((byte) => ALPHABET[byte % ALPHABET.length])
    .join('');
  return `CLUB-${suffix}`;
}

/**
 * Alta o cambio de un código (DECISIONS §151). Las reglas las vuelve a
 * comprobar la base; el texto del código no cambia después de crearlo.
 */
export function DiscountCodeForm({
  values,
}: {
  values: DiscountCodeFormValues;
}) {
  const { state, pending, onSubmit } = useAdminAction(saveDiscountCode);
  const editing = values.id !== null;
  const [code, setCode] = useState(values.code);
  const [kind, setKind] = useState<DiscountKind>(values.kind);

  return (
    <form onSubmit={onSubmit} className="max-w-3xl space-y-8">
      <input type="hidden" name="id" value={values.id ?? ''} />

      <div className="space-y-3">
        <Field
          label="Código"
          hint={
            editing
              ? 'No cambia después de crearlo: los pedidos lo guardan tal cual.'
              : 'Letras y números, con guiones entre medias. La tienda lo acepta en mayúsculas o minúsculas.'
          }
        >
          <Input
            name="code"
            required
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            readOnly={editing}
            autoComplete="off"
            spellCheck={false}
            maxLength={DISCOUNT_CODE_MAX}
            className="font-mono uppercase"
          />
        </Field>
        {!editing && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setCode(suggestCode())}
          >
            Sugerir uno
          </Button>
        )}
      </div>

      <Field
        label="Nota interna (opcional)"
        hint="Para el equipo: campaña de Sender, público… No sale en la tienda."
      >
        <Input
          name="description"
          defaultValue={values.description}
          maxLength={200}
        />
      </Field>

      <Fieldset legend="Descuento">
        <div className="grid gap-x-8 sm:grid-cols-2">
          <Radio
            name="kind"
            value="percent"
            checked={kind === 'percent'}
            onChange={() => setKind('percent')}
            label="Porcentaje sobre los artículos"
          />
          <Radio
            name="kind"
            value="amount"
            checked={kind === 'amount'}
            onChange={() => setKind('amount')}
            label="Importe fijo (€, con IVA)"
          />
        </div>
      </Fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={kind === 'percent' ? 'Porcentaje (%)' : 'Importe (€)'}
          hint={
            kind === 'percent'
              ? 'Del 1 al 90; admite decimales (12,5).'
              : 'De 1 € a 1.000 €. El pedido tiene que superar este importe.'
          }
        >
          <Input
            name="value"
            required
            inputMode="decimal"
            defaultValue={values.value}
          />
        </Field>
        <Field
          label="Compra mínima (€, opcional)"
          hint="Artículos con IVA, antes del descuento. Vacío: sin mínimo."
        >
          <Input
            name="minItems"
            inputMode="decimal"
            defaultValue={values.minItems}
          />
        </Field>
        <Field label="Desde (opcional)" hint="Hora de Madrid. Vacío: ya.">
          <Input
            type="datetime-local"
            name="startsAt"
            defaultValue={values.startsAt}
          />
        </Field>
        <Field label="Hasta (opcional)" hint="Hora de Madrid. Vacío: sin fin.">
          <Input
            type="datetime-local"
            name="endsAt"
            defaultValue={values.endsAt}
          />
        </Field>
        <Field
          label="Usos máximos (opcional)"
          hint="Pedidos en total. Un pedido caducado sin pagar o cancelado devuelve su uso."
        >
          <Input
            name="maxUses"
            inputMode="numeric"
            defaultValue={values.maxUses}
          />
        </Field>
      </div>

      <Fieldset legend="Condiciones">
        <Checkbox
          name="oncePerEmail"
          defaultChecked={values.oncePerEmail}
          label="Un uso por email"
          hint="Recomendado en las campañas: cada suscriptor lo usa una vez."
        />
        <Checkbox
          name="excludeSaleItems"
          defaultChecked={values.excludeSaleItems}
          label="No aplicar a perfumes rebajados"
          hint="Los formatos con precio tachado no cuentan para el descuento."
        />
        <Checkbox
          name="active"
          defaultChecked={values.active}
          label="Activo"
          hint="Apagado, la tienda lo rechaza como si no existiera."
        />
      </Fieldset>

      <div className="space-y-4">
        <SubmitButton pending={pending}>
          {editing ? 'Guardar cambios' : 'Crear código'}
        </SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
