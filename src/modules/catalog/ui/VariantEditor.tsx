'use client';

import { useState } from 'react';
import { formatEuros } from '@/lib/money';
import {
  Field,
  FormMessage,
  SubmitButton,
  useAdminAction,
} from '@/modules/admin';
import {
  addVariant,
  deleteVariant,
  setVariantPrice,
  updateVariant,
} from '../server/actions';

export type VariantValues = {
  id: string;
  size_ml: number | null;
  label: string | null;
  sku: string | null;
  ean: string | null;
  active: boolean;
  retail_price_cents: number | null;
  compare_at_price_cents: number | null;
};

function centsToInput(cents: number | null) {
  return cents === null ? '' : (cents / 100).toFixed(2).replace('.', ',');
}

function DetailsFields({ variant }: { variant?: VariantValues }) {
  return (
    <>
      <Field label="ml">
        <input
          name="sizeMl"
          type="number"
          min={1}
          max={5000}
          defaultValue={variant?.size_ml ?? ''}
          className="input"
        />
      </Field>
      <Field label="Etiqueta" hint="Opcional: «Set», «Tester»…">
        <input
          name="label"
          maxLength={60}
          defaultValue={variant?.label ?? ''}
          className="input"
        />
      </Field>
      <Field label="SKU">
        <input
          name="sku"
          maxLength={60}
          defaultValue={variant?.sku ?? ''}
          className="input"
        />
      </Field>
      <Field label="EAN">
        <input
          name="ean"
          inputMode="numeric"
          maxLength={14}
          defaultValue={variant?.ean ?? ''}
          className="input"
        />
      </Field>
    </>
  );
}

function PriceForm({
  productId,
  variant,
  canEditPrice,
}: {
  productId: string;
  variant: VariantValues;
  canEditPrice: boolean;
}) {
  const { state, pending, onSubmit } = useAdminAction(setVariantPrice);
  const [price, setPrice] = useState(centsToInput(variant.retail_price_cents));
  const [compareAt, setCompareAt] = useState(
    centsToInput(variant.compare_at_price_cents),
  );
  if (!canEditPrice) {
    return (
      <p className="text-sm">
        PVP:{' '}
        {variant.retail_price_cents === null
          ? 'pendiente'
          : formatEuros(variant.retail_price_cents, 'es')}
      </p>
    );
  }
  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]"
    >
      <input type="hidden" name="id" value={variant.id} />
      <input type="hidden" name="productId" value={productId} />
      <Field label="PVP (IVA incl.)">
        <input
          name="price"
          inputMode="decimal"
          placeholder="49,90"
          required
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          className="input tabular-nums"
        />
      </Field>
      <Field label="Precio anterior" hint="Solo en rebajas (Ómnibus).">
        <input
          name="compareAt"
          inputMode="decimal"
          value={compareAt}
          onChange={(event) => setCompareAt(event.target.value)}
          className="input tabular-nums"
        />
      </Field>
      <div className="self-end pb-0.5">
        <SubmitButton pending={pending}>Guardar PVP</SubmitButton>
      </div>
      {state.status === 'confirm' && state.confirm && (
        <fieldset className="border-gold/50 flex flex-col gap-2 border bg-white/60 p-4 text-sm sm:col-span-3">
          <legend className="px-1 text-xs font-semibold">
            {state.message}
          </legend>
          {state.confirm.map((issue) => (
            <label key={issue.code} className="flex items-center gap-3">
              <input
                type="checkbox"
                name="confirm"
                value={issue.code}
                required
                className="accent-ink size-4"
              />
              {issue.label}
            </label>
          ))}
        </fieldset>
      )}
      {state.status !== 'confirm' && (
        <div className="sm:col-span-3">
          <FormMessage state={state} />
        </div>
      )}
    </form>
  );
}

function VariantCard({
  productId,
  variant,
  canEditPrice,
}: {
  productId: string;
  variant: VariantValues;
  canEditPrice: boolean;
}) {
  const update = useAdminAction(updateVariant);
  const remove = useAdminAction(deleteVariant);
  const title =
    variant.label?.trim() ||
    (variant.size_ml ? `${variant.size_ml} ml` : 'Formato');
  return (
    <div className="panel-card space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-display text-2xl">{title}</h3>
        <span className="text-smoke text-sm tabular-nums">
          {variant.retail_price_cents === null
            ? 'PVP pendiente'
            : formatEuros(variant.retail_price_cents, 'es')}
        </span>
      </div>
      <PriceForm
        productId={productId}
        variant={variant}
        canEditPrice={canEditPrice}
      />
      <details className="group">
        <summary className="text-smoke cursor-pointer text-xs tracking-[0.16em] uppercase">
          Datos del formato
        </summary>
        <form
          onSubmit={update.onSubmit}
          className="mt-4 grid gap-4 sm:grid-cols-4"
        >
          <input type="hidden" name="id" value={variant.id} />
          <input type="hidden" name="productId" value={productId} />
          <DetailsFields variant={variant} />
          <label className="flex items-center gap-3 text-sm sm:col-span-4">
            <input type="hidden" name="activeField" value="1" />
            <input
              type="checkbox"
              name="active"
              value="on"
              defaultChecked={variant.active}
              className="accent-ink size-4"
            />
            Activo (se muestra y se vende)
          </label>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-4">
            <SubmitButton variant="ghost" pending={update.pending}>
              Guardar formato
            </SubmitButton>
            <FormMessage state={update.state} />
          </div>
        </form>
        <form
          onSubmit={(event) => {
            if (!window.confirm('¿Eliminar este formato?')) {
              event.preventDefault();
              return;
            }
            remove.onSubmit(event);
          }}
          className="mt-4 flex items-center gap-3"
        >
          <input type="hidden" name="id" value={variant.id} />
          <input type="hidden" name="productId" value={productId} />
          <SubmitButton
            variant="danger"
            pending={remove.pending}
            pendingLabel="Eliminando…"
          >
            Eliminar formato
          </SubmitButton>
          <FormMessage state={remove.state} />
        </form>
      </details>
    </div>
  );
}

export function VariantEditor({
  productId,
  variants,
  canEditPrice,
}: {
  productId: string;
  variants: VariantValues[];
  canEditPrice: boolean;
}) {
  const add = useAdminAction(addVariant);
  return (
    <div className="space-y-4">
      {variants.map((variant) => (
        <VariantCard
          key={variant.id}
          productId={productId}
          variant={variant}
          canEditPrice={canEditPrice}
        />
      ))}
      <form
        onSubmit={add.onSubmit}
        className="border-line grid gap-4 border border-dashed p-6 sm:grid-cols-4"
      >
        <input type="hidden" name="productId" value={productId} />
        <p className="eyebrow sm:col-span-4">Nuevo formato</p>
        <DetailsFields />
        <div className="flex flex-wrap items-center gap-3 sm:col-span-4">
          <SubmitButton variant="ghost" pending={add.pending}>
            Añadir formato
          </SubmitButton>
          <FormMessage state={add.state} />
        </div>
      </form>
    </div>
  );
}
