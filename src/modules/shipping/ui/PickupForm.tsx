'use client';

import { useState } from 'react';
import { FormMessage } from '@/modules/admin';
import {
  Field,
  Input,
  Radio,
  Select,
  SubmitButton,
  Textarea,
} from '@/components/ui';
import { requestPickup } from '../server/actions';
import { useShippingAction } from './useShippingAction';

const DAY = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});

/**
 * «Solicitar recogida en la tienda» para una o varias etiquetas del mismo
 * transportista: por la plataforma, si la admite, o llamando a su teléfono de
 * recogidas y apuntándola aquí.
 */
export function PickupForm({
  carrierCode,
  carrierName,
  shipmentIds,
  apiAvailable,
  apiLikely,
  phone,
  workingDays,
  start,
  end,
}: {
  carrierCode: string;
  carrierName: string;
  shipmentIds: string[];
  /** La etiqueta es de la plataforma y está conectada. */
  apiAvailable: boolean;
  /** La documentación de la plataforma dice que este transportista las admite. */
  apiLikely: boolean;
  phone: string | null;
  workingDays: string[];
  start: string;
  end: string;
}) {
  const { state, pending, onSubmit } = useShippingAction(requestPickup);
  const [mode, setMode] = useState<'api' | 'phone'>(
    apiAvailable && apiLikely ? 'api' : 'phone',
  );
  const tel = phone?.replace(/[^0-9+]/g, '');
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="carrierCode" value={carrierCode} />
      {shipmentIds.map((id) => (
        <input key={id} type="hidden" name="shipmentIds" value={id} />
      ))}
      <fieldset className="flex flex-col">
        <legend className="sr-only">Cómo se pide la recogida</legend>
        <Radio
          name="mode"
          value="api"
          checked={mode === 'api'}
          onChange={() => setMode('api')}
          disabled={!apiAvailable}
          label="Pedirla por la plataforma"
          hint={
            !apiAvailable
              ? 'Solo con etiquetas de Sendcloud.'
              : apiLikely
                ? `${carrierName} admite recogidas por la plataforma. Mejor con dos días laborables de margen.`
                : `La plataforma quizá no admite recogidas de ${carrierName}; si falla, llama.`
          }
        />
        <Radio
          name="mode"
          value="phone"
          checked={mode === 'phone'}
          onChange={() => setMode('phone')}
          label="La he pedido por teléfono o en su web"
          hint={
            phone ? (
              <>
                Teléfono de recogidas de {carrierName}:{' '}
                <a href={`tel:${tel}`} className="link-underline font-semibold">
                  {phone}
                </a>
                . Ten a mano los bultos, el peso y la franja de abajo.
              </>
            ) : (
              'Añade el teléfono de recogidas del servicio en Envíos → Transportistas y tarifas.'
            )
          }
        />
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,16rem)_8rem_8rem]">
        <Field label="Día">
          <Select name="date" defaultValue={workingDays[0]}>
            {workingDays.map((day) => (
              <option key={day} value={day}>
                {DAY.format(new Date(`${day}T12:00:00Z`))}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Desde">
          <Input name="start" type="time" defaultValue={start} required />
        </Field>
        <Field label="Hasta">
          <Input name="end" type="time" defaultValue={end} required />
        </Field>
      </div>
      <Field label="Indicaciones para el repartidor" hint="Opcional.">
        <Textarea name="note" rows={2} maxLength={200} />
      </Field>
      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton pending={pending} pendingLabel="Pidiendo la recogida…">
          {mode === 'api' ? 'Solicitar recogida' : 'Apuntar la recogida'}
        </SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
