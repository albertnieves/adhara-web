'use client';

import {
  Checkbox,
  Field,
  Fieldset,
  Input,
  SubmitButton,
  Textarea,
} from '@/components/ui';
import { FormMessage, useAdminAction } from '@/modules/admin';
import {
  NOTES,
  NOTE_GROUPS,
  SCENT_FAMILIES,
  SCENT_FAMILY_NAMES,
  SEASONS,
  SEASON_NAMES,
  TIMES_OF_DAY,
  TIME_OF_DAY_NAMES,
} from '../domain/scent';
import type { NoteGroup } from '../domain/scent';
import { saveScentProfile } from '../server/actions';

export type ScentProfileValues = {
  top_notes: string[];
  heart_notes: string[];
  base_notes: string[];
  key_notes: string[];
  families: string[];
  seasons: string[];
  times_of_day: string[];
  source_url: string;
  source_note: string | null;
};

const GROUP_NAMES: Record<NoteGroup, string> = {
  citrus: 'Cítricos',
  fruity: 'Frutales',
  floral: 'Florales',
  aromatic: 'Aromáticas y verdes',
  spicy: 'Especias',
  gourmand: 'Gourmand y licores',
  woody: 'Maderas',
  amber: 'Ámbar, resinas y bálsamos',
  leather: 'Cuero y tabaco',
  musky: 'Almizcles',
  aquatic: 'Marinas y luminosas',
};

const TIERS = [
  { name: 'top', label: 'Salida', key: 'top_notes' },
  { name: 'heart', label: 'Corazón', key: 'heart_notes' },
  { name: 'base', label: 'Fondo', key: 'base_notes' },
  {
    name: 'key',
    label: 'Notas sin pirámide',
    key: 'key_notes',
    hint: 'Solo si la fuente no las separa en salida, corazón y fondo.',
  },
] as const;

/**
 * Perfil olfativo del catálogo olfativo: notas por piso como claves del
 * vocabulario, familias, estaciones y momento, siempre con su fuente.
 */
export function ScentProfileEditor({
  productId,
  value,
}: {
  productId: string;
  value: ScentProfileValues | null;
}) {
  const { state, pending, onSubmit } = useAdminAction(saveScentProfile);
  return (
    <form onSubmit={onSubmit} className="grid gap-6">
      <input type="hidden" name="productId" value={productId} />
      <div className="grid gap-4 md:grid-cols-2">
        {TIERS.map((tier) => (
          <Field
            key={tier.name}
            label={tier.label}
            hint={'hint' in tier ? tier.hint : 'Claves separadas por comas.'}
          >
            <Textarea
              name={tier.name}
              rows={2}
              defaultValue={value?.[tier.key].join(', ') ?? ''}
            />
          </Field>
        ))}
      </div>
      <details className="text-sm">
        <summary className="min-h-11 cursor-pointer py-3">
          Notas disponibles ({Object.keys(NOTES).length})
        </summary>
        <dl className="text-fg-muted grid gap-4 pt-2 md:grid-cols-2">
          {NOTE_GROUPS.map((group) => (
            <div key={group}>
              <dt className="text-fg font-semibold">{GROUP_NAMES[group]}</dt>
              <dd className="mt-1 text-xs leading-relaxed">
                {Object.entries(NOTES)
                  .filter(([, note]) => note.group === group)
                  .map(([key, note]) => `${key} (${note.es})`)
                  .join(' · ')}
              </dd>
            </div>
          ))}
        </dl>
      </details>
      <Fieldset legend="Familias olfativas">
        <div className="grid grid-cols-2 gap-x-6 sm:grid-cols-3 lg:grid-cols-4">
          {SCENT_FAMILIES.map((family) => (
            <Checkbox
              key={family}
              name="families"
              value={family}
              label={SCENT_FAMILY_NAMES[family]}
              defaultChecked={value?.families.includes(family)}
            />
          ))}
        </div>
      </Fieldset>
      <div className="grid gap-6 md:grid-cols-2">
        <Fieldset legend="Estaciones (según la fuente)">
          <div className="grid grid-cols-2 gap-x-6">
            {SEASONS.map((season) => (
              <Checkbox
                key={season}
                name="seasons"
                value={season}
                label={SEASON_NAMES[season]}
                defaultChecked={value?.seasons.includes(season)}
              />
            ))}
          </div>
        </Fieldset>
        <Fieldset legend="Momento (según la fuente)">
          <div className="grid grid-cols-2 gap-x-6">
            {TIMES_OF_DAY.map((time) => (
              <Checkbox
                key={time}
                name="times"
                value={time}
                label={TIME_OF_DAY_NAMES[time]}
                defaultChecked={value?.times_of_day.includes(time)}
              />
            ))}
          </div>
        </Fieldset>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label="Fuente (URL https)"
          hint="Ficha oficial de la marca o de su distribuidor oficial."
        >
          <Input
            type="url"
            name="sourceUrl"
            required
            maxLength={500}
            defaultValue={value?.source_url ?? ''}
          />
        </Field>
        <Field label="Nota sobre la fuente" hint="Opcional.">
          <Input
            name="sourceNote"
            maxLength={500}
            defaultValue={value?.source_note ?? ''}
          />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pending={pending} name="intent" value="save">
          Guardar perfil
        </SubmitButton>
        {value && (
          <SubmitButton
            pending={pending}
            name="intent"
            value="delete"
            variant="danger"
            pendingLabel="Eliminando…"
          >
            Eliminar perfil
          </SubmitButton>
        )}
        <FormMessage state={state} />
      </div>
    </form>
  );
}
