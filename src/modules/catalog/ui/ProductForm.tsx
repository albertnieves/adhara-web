'use client';

import { useState } from 'react';
import type { ActionState } from '@/modules/admin';
import {
  Field,
  FormMessage,
  SubmitButton,
  useAdminAction,
} from '@/modules/admin';
import { UNBOXING_SCENES } from '@/modules/unboxing';
import {
  AUDIENCES,
  CONCENTRATIONS,
  CONCENTRATION_NAMES,
} from '../domain/product';

const AUDIENCE_LABELS: Record<string, string> = {
  women: 'Mujer',
  men: 'Hombre',
  unisex: 'Unisex',
};

export type ProductFormValues = {
  id?: string;
  updatedAt?: string;
  name: string;
  brandId: string;
  concentration: string | null;
  audience: string | null;
  unboxingScene: string | null;
  sourceRef: string | null;
  featured: boolean;
  position: number;
};

export function ProductForm({
  action,
  brands,
  values,
  submitLabel,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  brands: { id: string; name: string }[];
  values: ProductFormValues;
  submitLabel: string;
}) {
  const { state, pending, onSubmit } = useAdminAction(action);
  const [newBrand, setNewBrand] = useState(brands.length === 0);
  return (
    <form onSubmit={onSubmit} className="grid gap-6 md:grid-cols-2">
      <input type="hidden" name="expected" value={values.updatedAt ?? ''} />
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <Field label="Nombre" className="md:col-span-2">
        <input
          name="name"
          required
          maxLength={120}
          defaultValue={values.name}
          className="input font-display text-xl"
        />
      </Field>
      <Field label="Marca">
        {newBrand ? (
          <input
            name="newBrand"
            placeholder="Nombre de la nueva marca"
            maxLength={80}
            className="input"
            required
          />
        ) : (
          <select
            name="brandId"
            defaultValue={values.brandId}
            className="input"
            required
          >
            <option value="">Elige una marca</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </select>
        )}
        {brands.length > 0 && (
          <button
            type="button"
            onClick={() => setNewBrand((v) => !v)}
            className="link-underline text-smoke self-start text-xs"
          >
            {newBrand ? 'Elegir una marca existente' : '+ Nueva marca'}
          </button>
        )}
      </Field>
      <Field label="Concentración">
        <select
          name="concentration"
          defaultValue={values.concentration ?? ''}
          className="input"
        >
          <option value="">Sin indicar</option>
          {CONCENTRATIONS.map((c) => (
            <option key={c} value={c}>
              {CONCENTRATION_NAMES[c]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Para">
        <select
          name="audience"
          defaultValue={values.audience ?? ''}
          className="input"
        >
          <option value="">Sin indicar</option>
          {AUDIENCES.map((a) => (
            <option key={a} value={a}>
              {AUDIENCE_LABELS[a]}
            </option>
          ))}
        </select>
      </Field>
      <Field
        label="Escena 3D de unboxing"
        hint="Solo los perfumes del piloto tienen escena por ahora."
      >
        <select
          name="unboxingScene"
          defaultValue={values.unboxingScene ?? ''}
          className="input"
        >
          <option value="">Sin escena (imagen)</option>
          {UNBOXING_SCENES.map((scene) => (
            <option key={scene} value={scene}>
              {scene}
            </option>
          ))}
        </select>
      </Field>
      <Field
        label="Procedencia de los datos"
        hint="Por ejemplo: «CATALOGO global 2026, p. 12». No se muestra en la tienda."
        className="md:col-span-2"
      >
        <textarea
          name="sourceRef"
          rows={2}
          maxLength={500}
          defaultValue={values.sourceRef ?? ''}
          className="input"
        />
      </Field>
      <Field label="Orden en la colección" hint="Menor primero.">
        <input
          name="position"
          type="number"
          min={0}
          defaultValue={values.position}
          className="input"
        />
      </Field>
      <label className="flex items-center gap-3 self-end pb-3 text-sm">
        <input
          name="featured"
          type="checkbox"
          defaultChecked={values.featured}
          className="accent-ink size-4"
        />
        Destacado en la portada
      </label>
      <div className="flex flex-col gap-4 md:col-span-2">
        <FormMessage state={state} />
        <div>
          <SubmitButton pending={pending}>{submitLabel}</SubmitButton>
        </div>
      </div>
    </form>
  );
}
