'use client';

import { FormMessage, useAdminAction } from '@/modules/admin';
import type { StockWatchSettings } from '../domain/watch-snapshot';
import { WATCH_SETTING_LIMITS } from '../domain/watch-snapshot';
import { saveWatchSettings } from '../server/watch-actions';
import { Field, Input, SubmitButton } from '@/components/ui';

const FIELDS: {
  key: keyof StockWatchSettings;
  label: string;
  hint: string;
}[] = [
  {
    key: 'salesWindowDays',
    label: 'Días de ventas analizados',
    hint: 'Para calcular cuánto se vende al día.',
  },
  {
    key: 'targetCoverDays',
    label: 'Cobertura objetivo',
    hint: 'Días de venta que debe cubrir cada pedido.',
  },
  {
    key: 'safetyDays',
    label: 'Colchón sobre el plazo',
    hint: 'Días extra por si el proveedor se retrasa.',
  },
  {
    key: 'deadStockDays',
    label: 'Días sin ventas',
    hint: 'A partir de ahí, stock inmovilizado.',
  },
];

export function WatchSettingsForm({
  settings,
  editable,
}: {
  settings: StockWatchSettings;
  editable: boolean;
}) {
  const { state, pending, onSubmit } = useAdminAction(saveWatchSettings);
  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4"
    >
      {FIELDS.map((field) => (
        <Field key={field.key} label={field.label} hint={field.hint}>
          <Input
            name={field.key}
            type="number"
            inputMode="numeric"
            required
            disabled={!editable}
            min={WATCH_SETTING_LIMITS[field.key].min}
            max={WATCH_SETTING_LIMITS[field.key].max}
            defaultValue={settings[field.key]}
            className="tabular-nums"
          />
        </Field>
      ))}
      {editable && (
        <div className="flex flex-wrap items-center gap-4 sm:col-span-2 xl:col-span-4">
          <SubmitButton pending={pending} variant="outline">
            Guardar parámetros
          </SubmitButton>
          <FormMessage state={state} />
        </div>
      )}
    </form>
  );
}
