'use client';

import { useState } from 'react';
import {
  Checkbox,
  Field,
  Fieldset,
  Input,
  SubmitButton,
} from '@/components/ui';
import { FormMessage, useAdminAction } from '@/modules/admin';
import { parseEuros } from '@/lib/money';
import type { ShippingPromotionZone } from '../domain';
import {
  SHIPPING_PROMOTION_ZONES,
  shippingPromotionStoreText,
} from '../domain';
import { saveShippingPromotion } from '../server/actions';

/** Valores del formulario, ya como texto de los campos. */
export type ShippingPromotionFormValues = {
  id: string | null;
  name: string;
  /** «30,00»; '' para todos los pedidos. */
  minItems: string;
  zones: ShippingPromotionZone[];
  /** «2026-11-27T00:00», hora de Madrid. */
  startsAt: string;
  endsAt: string;
  active: boolean;
};

export const NEW_SHIPPING_PROMOTION: ShippingPromotionFormValues = {
  id: null,
  name: '',
  minItems: '',
  zones: [...SHIPPING_PROMOTION_ZONES],
  startsAt: '',
  endsAt: '',
  active: true,
};

const ZONE_LABELS: Record<ShippingPromotionZone, string> = {
  peninsula: 'Península',
  baleares: 'Baleares',
};

/**
 * Alta o cambio de un envío gratis temporal (DECISIONS §189). Las reglas las
 * vuelve a comprobar la base; los pedidos hechos conservan su envío.
 */
export function ShippingPromotionForm({
  values,
}: {
  values: ShippingPromotionFormValues;
}) {
  const { state, pending, onSubmit } = useAdminAction(saveShippingPromotion);
  const editing = values.id !== null;
  const [minItems, setMinItems] = useState(values.minItems);
  const [zones, setZones] = useState<ShippingPromotionZone[]>(values.zones);
  const minimum = minItems.trim() ? parseEuros(minItems) : 0;
  const preview =
    minimum === null || zones.length === 0
      ? null
      : shippingPromotionStoreText({ minItemsCents: minimum, zones });

  function toggleZone(zone: ShippingPromotionZone, on: boolean) {
    setZones((current) =>
      SHIPPING_PROMOTION_ZONES.filter((z) =>
        z === zone ? on : current.includes(z),
      ),
    );
  }

  return (
    <form onSubmit={onSubmit} className="max-w-3xl space-y-8">
      <input type="hidden" name="id" value={values.id ?? ''} />

      <Field
        label="Nombre"
        hint="Para el equipo («Envío gratis de Navidad»). La tienda no lo enseña: lo describe con sus condiciones."
      >
        <Input name="name" required maxLength={80} defaultValue={values.name} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Desde (€ en artículos, opcional)"
          hint="Lo que se paga por los artículos, con IVA y ya con el descuento. Vacío: todos los pedidos."
        >
          <Input
            name="minItems"
            inputMode="decimal"
            value={minItems}
            onChange={(event) => setMinItems(event.target.value)}
          />
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
          label="Termina"
          hint="Hora de Madrid. Obligatorio: el envío gratis permanente está en Envíos → Remitente y zonas."
        >
          <Input
            type="datetime-local"
            name="endsAt"
            required
            defaultValue={values.endsAt}
          />
        </Field>
      </div>

      <Fieldset
        legend="Zonas"
        hint="Solo vale donde se ofrece el envío y con los servicios que cuentan para el envío gratis."
      >
        <div className="grid gap-x-8 sm:grid-cols-2">
          {SHIPPING_PROMOTION_ZONES.map((zone) => (
            <Checkbox
              key={zone}
              name="zones"
              value={zone}
              checked={zones.includes(zone)}
              onChange={(event) => toggleZone(zone, event.target.checked)}
              label={ZONE_LABELS[zone]}
            />
          ))}
        </div>
      </Fieldset>

      <Fieldset legend="Estado">
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
          {preview ?? 'Elige al menos una zona y escribe un importe válido.'}
        </p>
        <p className="text-fg-muted mt-2 text-xs">
          Se suma a un código o a una promoción de descuento. Con el envío
          gratis de la zona, vale el mínimo más bajo.
        </p>
      </div>

      <div className="space-y-4">
        <SubmitButton pending={pending}>
          {editing ? 'Guardar cambios' : 'Crear envío gratis'}
        </SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
