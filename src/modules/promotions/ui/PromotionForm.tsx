'use client';

import { useState } from 'react';
import {
  Checkbox,
  Field,
  Fieldset,
  Input,
  Radio,
  Select,
  SubmitButton,
} from '@/components/ui';
import { FormMessage, useAdminAction } from '@/modules/admin';
import { formatEuros, parseEuros } from '@/lib/money';
import type { DiscountKind } from '../domain';
import { formatDiscountValue, parsePercent } from '../domain';
import { savePromotion } from '../server/actions';

/** Valores del formulario, ya como texto de los campos. */
export type PromotionFormValues = {
  id: string | null;
  name: string;
  kind: DiscountKind;
  /** «10» (%) o «5,00» (€). */
  value: string;
  minItems: string;
  /** '' para todas las casas. */
  brandId: string;
  excludeSaleItems: boolean;
  /** «2026-11-27T00:00», hora de Madrid. */
  startsAt: string;
  endsAt: string;
  active: boolean;
};

export const NEW_PROMOTION: PromotionFormValues = {
  id: null,
  name: '',
  kind: 'percent',
  value: '',
  minItems: '',
  brandId: '',
  excludeSaleItems: false,
  startsAt: '',
  endsAt: '',
  active: true,
};

/**
 * Cómo la describe la tienda en español (messages/es.json → promotion.offer y
 * promotion.offerBrand); null mientras falte el descuento o el mínimo.
 */
function storeText(
  kind: DiscountKind,
  value: string,
  minItems: string,
  brand: string | null,
  excludeSale: boolean,
): string | null {
  const percentBp = kind === 'percent' ? parsePercent(value) : null;
  const amountCents = kind === 'amount' ? parseEuros(value) : null;
  const minimum = parseEuros(minItems);
  if ((percentBp === null && amountCents === null) || minimum === null)
    return null;
  const discount = formatDiscountValue({ kind, percentBp, amountCents });
  const amount = formatEuros(minimum, 'es');
  const text = brand
    ? `${discount} de descuento en ${brand} al llevar ${amount} o más de esa casa.`
    : `${discount} de descuento en pedidos desde ${amount}.`;
  return excludeSale ? `${text} Sin contar los perfumes rebajados.` : text;
}

/**
 * Alta o cambio de una promoción automática (DECISIONS §186). Las reglas las
 * vuelve a comprobar la base; los pedidos hechos conservan su descuento.
 */
export function PromotionForm({
  values,
  brands,
}: {
  values: PromotionFormValues;
  brands: readonly { id: string; name: string }[];
}) {
  const { state, pending, onSubmit } = useAdminAction(savePromotion);
  const editing = values.id !== null;
  const [kind, setKind] = useState<DiscountKind>(values.kind);
  const [value, setValue] = useState(values.value);
  const [minItems, setMinItems] = useState(values.minItems);
  const [brandId, setBrandId] = useState(values.brandId);
  const [excludeSale, setExcludeSale] = useState(values.excludeSaleItems);
  const brand = brands.find((b) => b.id === brandId)?.name ?? null;
  const preview = storeText(kind, value, minItems, brand, excludeSale);

  return (
    <form onSubmit={onSubmit} className="max-w-3xl space-y-8">
      <input type="hidden" name="id" value={values.id ?? ''} />

      <Field
        label="Nombre"
        hint="Para el equipo («Black Friday 2026»). La tienda no lo enseña: describe la promoción con sus condiciones."
      >
        <Input name="name" required maxLength={80} defaultValue={values.name} />
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
              : 'De 1 € a 1.000 €, menos que el importe mínimo.'
          }
        >
          <Input
            name="value"
            required
            inputMode="decimal"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </Field>
        <Field
          label="Desde (€ en artículos)"
          hint="Artículos que cuentan, con IVA y antes del descuento. Es obligatorio: sin condición sería una rebaja, que va con el precio tachado."
        >
          <Input
            name="minItems"
            required
            inputMode="decimal"
            value={minItems}
            onChange={(event) => setMinItems(event.target.value)}
          />
        </Field>
        <Field
          label="Casa"
          hint="Con una casa, solo sus perfumes cuentan para el mínimo y se descuentan."
        >
          <Select
            name="brandId"
            value={brandId}
            onChange={(event) => setBrandId(event.target.value)}
          >
            <option value="">Todas las casas</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>
        <div aria-hidden className="hidden sm:block" />
        <Field label="Empieza (opcional)" hint="Hora de Madrid. Vacío: ya.">
          <Input
            type="datetime-local"
            name="startsAt"
            defaultValue={values.startsAt}
          />
        </Field>
        <Field
          label="Termina (opcional)"
          hint="Hora de Madrid. Vacío: hasta que la apagues."
        >
          <Input
            type="datetime-local"
            name="endsAt"
            defaultValue={values.endsAt}
          />
        </Field>
      </div>

      <Fieldset legend="Condiciones">
        <Checkbox
          name="excludeSaleItems"
          checked={excludeSale}
          onChange={(event) => setExcludeSale(event.target.checked)}
          label="No aplicar a perfumes rebajados"
          hint="Los formatos con precio tachado no cuentan para el mínimo ni se descuentan."
        />
        <Checkbox
          name="active"
          defaultChecked={values.active}
          label="Activa"
          hint="Apagada, la tienda deja de aplicarla al momento."
        />
      </Fieldset>

      <div className="border-border border-l-2 pl-4 text-sm">
        <p className="text-fg-muted text-xs">Así la verá el cliente</p>
        <p className="mt-1" aria-live="polite">
          {preview ?? 'Escribe el descuento y desde cuánto vale.'}
        </p>
        <p className="text-fg-muted mt-2 text-xs">
          No se suma a un código: si el cliente escribe uno, se aplica el que
          más descuenta.
        </p>
      </div>

      <div className="space-y-4">
        <SubmitButton pending={pending}>
          {editing ? 'Guardar cambios' : 'Crear promoción'}
        </SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
