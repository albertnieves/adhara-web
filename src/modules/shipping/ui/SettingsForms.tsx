'use client';

import { useState } from 'react';
import { FormMessage, useAdminAction } from '@/modules/admin';
import {
  Button,
  Checkbox,
  Field,
  Fieldset,
  Input,
  SubmitButton,
} from '@/components/ui';
import {
  saveServiceRates,
  saveShippingService,
  saveShippingSettings,
  saveShippingZone,
  syncSendcloudServices,
} from '../server/actions';

/* Panel → Configuración → Envíos (settings.manage). */

export type SettingsFormValues = {
  senderName: string;
  senderContact: string;
  addressLine1: string;
  houseNumber: string;
  addressLine2: string;
  postalCode: string;
  city: string;
  phone: string;
  email: string;
  packagingWeightG: string;
  maxWeightG: string;
  parcelLength: string;
  parcelWidth: string;
  parcelHeight: string;
  pickupStart: string;
  pickupEnd: string;
  vatPercent: string;
};

/** Remitente de las etiquetas, embalaje, medidas de la caja y recogidas. */
export function ShippingSettingsForm({
  values,
}: {
  values: SettingsFormValues;
}) {
  const { state, pending, onSubmit } = useAdminAction(saveShippingSettings);
  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Fieldset legend="Remitente (sale en las etiquetas y es la dirección de las recogidas)">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre del remitente">
            <Input
              name="senderName"
              defaultValue={values.senderName}
              maxLength={80}
              required
            />
          </Field>
          <Field label="Persona de contacto" hint="Opcional.">
            <Input
              name="senderContact"
              defaultValue={values.senderContact}
              maxLength={80}
            />
          </Field>
          <Field label="Calle">
            <Input
              name="addressLine1"
              defaultValue={values.addressLine1}
              maxLength={200}
              required
            />
          </Field>
          <div className="grid grid-cols-[8rem_1fr] gap-4">
            <Field label="Número">
              <Input
                name="houseNumber"
                defaultValue={values.houseNumber}
                maxLength={20}
              />
            </Field>
            <Field label="Piso, local…" hint="Opcional.">
              <Input
                name="addressLine2"
                defaultValue={values.addressLine2}
                maxLength={200}
              />
            </Field>
          </div>
          <div className="grid grid-cols-[8rem_1fr] gap-4">
            <Field label="Código postal">
              <Input
                name="postalCode"
                defaultValue={values.postalCode}
                inputMode="numeric"
                maxLength={5}
                required
              />
            </Field>
            <Field label="Población">
              <Input
                name="city"
                defaultValue={values.city}
                maxLength={120}
                required
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Teléfono">
              <Input
                name="phone"
                type="tel"
                defaultValue={values.phone}
                maxLength={30}
                required
              />
            </Field>
            <Field label="Email">
              <Input
                name="email"
                type="email"
                defaultValue={values.email}
                maxLength={254}
                required
              />
            </Field>
          </div>
        </div>
      </Fieldset>
      <Fieldset legend="Peso y caja">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Field
            label="Embalaje (g)"
            hint="Caja y relleno de un paquete; se suma al peso de los perfumes."
          >
            <Input
              name="packagingWeightG"
              inputMode="numeric"
              defaultValue={values.packagingWeightG}
              required
            />
          </Field>
          <Field
            label="Peso máximo (g)"
            hint="Más que esto no se ofrece con envío."
          >
            <Input
              name="maxWeightG"
              inputMode="numeric"
              defaultValue={values.maxWeightG}
            />
          </Field>
          <Field label="Largo (cm)" hint="Caja habitual, opcional.">
            <Input
              name="parcelLength"
              inputMode="numeric"
              defaultValue={values.parcelLength}
            />
          </Field>
          <Field label="Ancho (cm)">
            <Input
              name="parcelWidth"
              inputMode="numeric"
              defaultValue={values.parcelWidth}
            />
          </Field>
          <Field label="Alto (cm)">
            <Input
              name="parcelHeight"
              inputMode="numeric"
              defaultValue={values.parcelHeight}
            />
          </Field>
        </div>
      </Fieldset>
      <Fieldset legend="Recogidas y precio">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Recogidas desde">
            <Input
              name="pickupStart"
              type="time"
              defaultValue={values.pickupStart}
              required
            />
          </Field>
          <Field label="Hasta">
            <Input
              name="pickupEnd"
              type="time"
              defaultValue={values.pickupEnd}
              required
            />
          </Field>
          <Field
            label="IVA del envío (%)"
            hint="Se suma al coste del transportista (sin IVA) para el precio al cliente."
          >
            <Input
              name="vatPercent"
              inputMode="decimal"
              defaultValue={values.vatPercent}
            />
          </Field>
        </div>
      </Fieldset>
      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton pending={pending}>Guardar ajustes</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

/** Una zona: «Ofrecer el envío» y desde cuánto es gratis. */
export function ShippingZoneForm({
  zone,
  freeFrom,
  active,
}: {
  zone: string;
  freeFrom: string;
  active: boolean;
}) {
  const { state, pending, onSubmit } = useAdminAction(saveShippingZone);
  return (
    <form
      onSubmit={onSubmit}
      className="grid items-end gap-4 sm:grid-cols-[14rem_auto_auto]"
    >
      <input type="hidden" name="zone" value={zone} />
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
      <div className="sm:col-span-3">
        <FormMessage state={state} />
      </div>
    </form>
  );
}

/** «Actualizar tarifas» desde la plataforma. */
export function SyncServicesButton({ disabled }: { disabled: boolean }) {
  const { state, pending, onSubmit } = useAdminAction(syncSendcloudServices);
  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-4">
      <SubmitButton
        pending={pending}
        pendingLabel="Cotizando en Sendcloud…"
        disabled={disabled}
      >
        Actualizar tarifas desde Sendcloud
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export type ServiceFormValues = {
  id: string;
  provider: 'sendcloud' | 'manual';
  carrierName: string;
  name: string;
  transitDays: string;
  surcharge: string;
  freeEligible: boolean;
  active: boolean;
  zones: string[];
  position: string;
  trackingUrlTemplate: string;
  pickupPhone: string;
};

const ZONE_CHOICES = [
  { value: 'peninsula', label: 'Península' },
  { value: 'baleares', label: 'Illes Balears' },
];

/** Alta de un servicio manual (sin id) o cambio de un servicio. */
export function ServiceForm({ values }: { values: ServiceFormValues }) {
  const { state, pending, onSubmit } = useAdminAction(saveShippingService);
  const manual = values.provider === 'manual';
  const creating = !values.id;
  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <input type="hidden" name="id" value={values.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        {manual && (
          <Field
            label="Transportista"
            hint={creating ? 'Por ejemplo, Correos o SEUR.' : undefined}
          >
            <Input
              name="carrierName"
              defaultValue={values.carrierName}
              maxLength={80}
              required
            />
          </Field>
        )}
        <Field
          label="Nombre que ve el cliente"
          hint="Sin repetir el transportista si ya lo lleva."
        >
          <Input
            name="name"
            defaultValue={values.name}
            maxLength={120}
            required
          />
        </Field>
        <Field
          label="Plazo (días laborables)"
          hint="Se enseña al elegir el envío."
        >
          <Input
            name="transitDays"
            inputMode="numeric"
            defaultValue={values.transitDays}
          />
        </Field>
        <Field
          label="Recargo (€, con IVA)"
          hint="Se suma al precio de cada tramo. Vacío: nada."
        >
          <Input
            name="surcharge"
            inputMode="decimal"
            defaultValue={values.surcharge}
          />
        </Field>
        {manual && (
          <Field
            label="Enlace de seguimiento"
            hint="https://… con {tracking} donde va el número. Opcional."
          >
            <Input
              name="trackingUrlTemplate"
              defaultValue={values.trackingUrlTemplate}
              maxLength={500}
            />
          </Field>
        )}
        <Field
          label="Teléfono de recogidas"
          hint="Para llamar si no se pueden pedir por la plataforma. Opcional."
        >
          <Input
            name="pickupPhone"
            type="tel"
            defaultValue={values.pickupPhone}
            maxLength={30}
          />
        </Field>
        <Field
          label="Orden"
          hint="Los de menos número salen antes a igual precio."
        >
          <Input
            name="position"
            inputMode="numeric"
            defaultValue={values.position}
          />
        </Field>
      </div>
      <Fieldset legend="Zonas en las que se ofrece">
        <div className="flex flex-wrap gap-x-8">
          {ZONE_CHOICES.map((zone) => (
            <Checkbox
              key={zone.value}
              name="zones"
              value={zone.value}
              defaultChecked={values.zones.includes(zone.value)}
              label={zone.label}
            />
          ))}
        </div>
      </Fieldset>
      <div className="flex flex-col gap-1">
        <Checkbox
          name="freeEligible"
          defaultChecked={values.freeEligible}
          label="Cuenta para el envío gratis de la zona"
          hint="Desmárcalo en los urgentes: se cobran aunque el pedido llegue al mínimo."
        />
        {!creating && (
          <Checkbox
            name="active"
            defaultChecked={values.active}
            label="Ofrecer este servicio en la tienda"
            hint="Necesita tramos de peso en cada zona marcada."
          />
        )}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton pending={pending}>
          {creating ? 'Crear servicio' : 'Guardar servicio'}
        </SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

type RateRow = { key: number; upTo: string; cost: string };

/**
 * Tramos escritos a mano de un servicio manual en una zona: «hasta» en gramos
 * y el coste sin IVA. Cada tramo empieza donde acaba el anterior.
 */
export function ServiceRatesForm({
  serviceId,
  zone,
  rows,
}: {
  serviceId: string;
  zone: string;
  rows: { upTo: string; cost: string }[];
}) {
  const { state, pending, onSubmit } = useAdminAction(saveServiceRates);
  const [lines, setLines] = useState<RateRow[]>(() =>
    (rows.length > 0 ? rows : [{ upTo: '', cost: '' }]).map((row, key) => ({
      key,
      ...row,
    })),
  );
  const add = () =>
    setLines((current) => [
      ...current,
      { key: Date.now(), upTo: '', cost: '' },
    ]);
  const remove = (key: number) =>
    setLines((current) => current.filter((line) => line.key !== key));
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="serviceId" value={serviceId} />
      <input type="hidden" name="zone" value={zone} />
      <ol className="space-y-3">
        {lines.map((line, index) => (
          <li
            key={line.key}
            className="grid items-end gap-3 sm:grid-cols-[10rem_10rem_auto]"
          >
            <Field label={`Tramo ${index + 1}: hasta (g)`}>
              <Input name="upTo" inputMode="numeric" defaultValue={line.upTo} />
            </Field>
            <Field label="Coste sin IVA (€)">
              <Input name="cost" inputMode="decimal" defaultValue={line.cost} />
            </Field>
            {lines.length > 1 && (
              <Button
                type="button"
                variant="subtle"
                size="sm"
                onClick={() => remove(line.key)}
              >
                Quitar
              </Button>
            )}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-4">
        <Button type="button" variant="outline" onClick={add}>
          Añadir tramo
        </Button>
        <SubmitButton pending={pending}>Guardar tramos</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
