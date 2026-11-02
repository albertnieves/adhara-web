'use client';

import { useState } from 'react';
import {
  Checkbox,
  Field,
  Fieldset,
  Input,
  Radio,
  SubmitButton,
} from '@/components/ui';
import { FormMessage, useAdminAction } from '@/modules/admin';
import type { DiscountBatchAudience, DiscountKind } from '../domain';
import { DISCOUNT_BATCH_MAX } from '../domain';
import { createDiscountBatch, setDiscountBatchActive } from '../server/actions';

/**
 * Nuevo lote de códigos únicos (DECISIONS §185): las condiciones de un
 * código y a quién va. `subscribers` es null sin permiso de clientes (solo
 * se puede pedir un número de códigos).
 */
export function DiscountBatchForm({
  subscribers,
}: {
  subscribers: number | null;
}) {
  const { state, pending, onSubmit } = useAdminAction(createDiscountBatch);
  const [kind, setKind] = useState<DiscountKind>('percent');
  const [audience, setAudience] = useState<DiscountBatchAudience>(
    subscribers ? 'subscribers' : 'count',
  );
  const [prefix, setPrefix] = useState('CLUB');

  return (
    <form onSubmit={onSubmit} className="max-w-3xl space-y-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Campaña"
          hint="Para el equipo: «Bienvenida al Club, noviembre». No sale en la tienda."
        >
          <Input name="name" required maxLength={120} />
        </Field>
        <Field
          label="Prefijo"
          hint={`De 2 a 10 letras o números. Cada código será ${prefix || 'CLUB'}-XXXXXXXX.`}
        >
          <Input
            name="prefix"
            required
            value={prefix}
            onChange={(event) =>
              setPrefix(
                event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''),
              )
            }
            maxLength={10}
            autoComplete="off"
            spellCheck={false}
            className="font-mono uppercase"
          />
        </Field>
      </div>

      <Fieldset legend="Para quién">
        <div className="space-y-2">
          <Radio
            name="audience"
            value="subscribers"
            checked={audience === 'subscribers'}
            onChange={() => setAudience('subscribers')}
            disabled={!subscribers}
            label={
              subscribers === null
                ? 'Uno para cada suscriptor del Club (hace falta el permiso de clientes)'
                : subscribers === 0
                  ? 'Uno para cada suscriptor del Club (ahora no hay ninguno)'
                  : `Uno para cada suscriptor activo del Club (${subscribers.toLocaleString('es-ES')})`
            }
            hint="Para importarlos en Sender y que cada uno reciba el suyo."
          />
          <Radio
            name="audience"
            value="count"
            checked={audience === 'count'}
            onChange={() => setAudience('count')}
            label="Un número de códigos, sin destinatario"
            hint="Para repartirlos en la tienda, en un evento o en un sorteo."
          />
        </div>
        {audience === 'count' && (
          <Field
            label="Cuántos"
            hint={`De 1 a ${DISCOUNT_BATCH_MAX.toLocaleString('es-ES')}.`}
            className="mt-4 max-w-xs"
          >
            <Input name="count" required inputMode="numeric" />
          </Field>
        )}
      </Fieldset>

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
          <Input name="value" required inputMode="decimal" />
        </Field>
        <Field
          label="Compra mínima (€, opcional)"
          hint="Artículos con IVA, antes del descuento. Vacío: sin mínimo."
        >
          <Input name="minItems" inputMode="decimal" />
        </Field>
        <Field label="Desde (opcional)" hint="Hora de Madrid. Vacío: ya.">
          <Input type="datetime-local" name="startsAt" />
        </Field>
        <Field
          label="Hasta (opcional)"
          hint="Hora de Madrid. Recomendado: que la campaña caduque."
        >
          <Input type="datetime-local" name="endsAt" />
        </Field>
      </div>

      <Fieldset legend="Condiciones">
        <p className="text-fg-muted mb-3 text-sm">
          Cada código vale para un solo pedido.
        </p>
        <Checkbox
          name="excludeSaleItems"
          label="No aplicar a perfumes rebajados"
          hint="Los formatos con precio tachado no cuentan para el descuento."
        />
      </Fieldset>

      <div className="space-y-4">
        <SubmitButton pending={pending} pendingLabel="Creando los códigos…">
          Crear el lote
        </SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

/** Apaga o enciende todos los códigos de un lote. */
export function DiscountBatchToggle({
  id,
  active,
}: {
  id: string;
  active: boolean;
}) {
  const { state, pending, onSubmit } = useAdminAction(setDiscountBatchActive);
  return (
    <form
      onSubmit={(event) => {
        if (
          active &&
          !window.confirm(
            '¿Apagar el lote? Ninguno de sus códigos valdrá hasta que lo vuelvas a encender.',
          )
        ) {
          event.preventDefault();
          return;
        }
        onSubmit(event);
      }}
      className="space-y-3"
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="active" value={active ? 'false' : 'true'} />
      <SubmitButton
        variant={active ? 'danger' : 'outline'}
        pending={pending}
        pendingLabel="…"
      >
        {active ? 'Apagar el lote' : 'Encender el lote'}
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
