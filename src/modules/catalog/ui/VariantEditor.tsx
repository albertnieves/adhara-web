'use client';

import { useState } from 'react';
import { formatEuros, grossToNet, parseEuros } from '@/lib/money';
import {
  Field,
  FormMessage,
  SubmitButton,
  useAdminAction,
} from '@/modules/admin';
import { VAT_GENERAL_BP, computeMargin } from '@/modules/pricing';
import {
  addVariant,
  deleteVariant,
  recordVariantCost,
  setVariantPrice,
  updateVariant,
} from '../server/actions';

export type VariantValues = {
  updated_at: string;
  id: string;
  size_ml: number | null;
  label: string | null;
  sku: string | null;
  ean: string | null;
  active: boolean;
  retail_price_cents: number | null;
  compare_at_price_cents: number | null;
};

/** Coste vigente de un formato; solo llega con pricing.view_cost y MFA. */
export type CostValues = {
  costNetCents: number;
  note: string | null;
  recordedAt: string;
};

function centsToInput(cents: number | null) {
  return cents === null ? '' : (cents / 100).toFixed(2).replace('.', ',');
}

const PERCENT = new Intl.NumberFormat('es-ES', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const RECORDED_AT = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'medium',
  timeZone: 'Europe/Madrid',
});

/** Margen sobre el ingreso neto (PVP sin IVA); null si falta PVP o coste. */
function describeMargin(
  retailGrossCents: number | null,
  costNetCents: number | null,
) {
  if (retailGrossCents === null || retailGrossCents <= 0) return null;
  const margin = computeMargin({
    retailGrossCents,
    vatBp: VAT_GENERAL_BP,
    costNetCents,
  });
  if (margin.kind === 'unknown') return null;
  const amount = formatEuros(margin.marginCents, 'es');
  const percent =
    margin.marginBp === null ? null : PERCENT.format(margin.marginBp / 10_000);
  return {
    amount,
    percent,
    text: percent ? `${amount} · ${percent}` : amount,
    negative: margin.marginCents < 0,
  };
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
  cost,
}: {
  productId: string;
  variant: VariantValues;
  canEditPrice: boolean;
  /** Solo con permiso de costes: muestra el margen mientras se escribe. */
  cost: CostValues | null;
}) {
  const { state, pending, onSubmit } = useAdminAction(setVariantPrice);
  const [price, setPrice] = useState(centsToInput(variant.retail_price_cents));
  const [compareAt, setCompareAt] = useState(
    centsToInput(variant.compare_at_price_cents),
  );
  const proposed = parseEuros(price);
  const liveMargin = cost ? describeMargin(proposed, cost.costNetCents) : null;
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
      <input type="hidden" name="expected" value={variant.updated_at} />
      <input
        type="hidden"
        name="reviewId"
        value={
          state.reviewedInput === `${price}|${compareAt}`
            ? (state.reviewId ?? '')
            : ''
        }
      />
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
        <SubmitButton pending={pending}>
          {state.status === 'confirm' &&
          state.reviewedInput === `${price}|${compareAt}`
            ? 'Aplicar PVP revisado'
            : 'Revisar PVP'}
        </SubmitButton>
      </div>
      {liveMargin && (
        <p
          aria-live="polite"
          className={`text-xs tabular-nums sm:col-span-3 ${liveMargin.negative ? 'text-danger' : 'text-smoke'}`}
        >
          Margen con este PVP: {liveMargin.text}
        </p>
      )}
      {state.status === 'confirm' &&
        state.reviewedInput === `${price}|${compareAt}` &&
        state.confirm && (
          <fieldset className="border-gold/50 bg-surface-raised/60 flex flex-col gap-2 border p-4 text-sm sm:col-span-3">
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
                  className="accent-ink size-5"
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

function CostPanel({
  productId,
  variant,
  cost,
  canEditCost,
}: {
  productId: string;
  variant: VariantValues;
  cost: CostValues | null;
  canEditCost: boolean;
}) {
  const { state, pending, onSubmit } = useAdminAction(recordVariantCost);
  const retail = variant.retail_price_cents;
  const margin = describeMargin(retail, cost?.costNetCents ?? null);
  return (
    <div className="border-line border-t pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="eyebrow">Coste y margen</p>
        <p className="text-fg-muted text-xs">
          Interno · no se muestra en la tienda
        </p>
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-4 text-sm">
        <div>
          <dt className="text-smoke text-xs">Coste neto</dt>
          <dd className="mt-1 tabular-nums">
            {cost ? formatEuros(cost.costNetCents, 'es') : 'Sin registrar'}
          </dd>
        </div>
        <div>
          <dt className="text-smoke text-xs">PVP sin IVA</dt>
          <dd className="mt-1 tabular-nums">
            {retail === null
              ? '—'
              : formatEuros(grossToNet(retail, VAT_GENERAL_BP), 'es')}
          </dd>
        </div>
        <div>
          <dt className="text-smoke text-xs">Margen</dt>
          <dd
            className={`mt-1 tabular-nums ${margin?.negative ? 'text-danger' : ''}`}
          >
            {margin ? (
              <>
                {margin.amount}
                {margin.percent && (
                  <span className="block text-xs opacity-70">
                    {margin.percent}
                  </span>
                )}
              </>
            ) : (
              '—'
            )}
          </dd>
        </div>
      </dl>
      {cost && (
        <p className="text-fg-muted mt-3 text-xs">
          Registrado el {RECORDED_AT.format(new Date(cost.recordedAt))}
          {cost.note ? ` · ${cost.note}` : ''}
        </p>
      )}
      {canEditCost && (
        <form
          key={cost?.recordedAt ?? 'sin-coste'}
          onSubmit={onSubmit}
          className="mt-5 grid gap-4 sm:grid-cols-[1fr_2fr_auto]"
        >
          <input type="hidden" name="id" value={variant.id} />
          <input type="hidden" name="productId" value={productId} />
          <Field label={cost ? 'Nuevo coste neto' : 'Coste neto (sin IVA)'}>
            <input
              name="cost"
              inputMode="decimal"
              placeholder="18,40"
              required
              className="input tabular-nums"
            />
          </Field>
          <Field label="Nota" hint="Opcional: albarán, factura…">
            <input name="note" maxLength={200} className="input" />
          </Field>
          <div className="self-end pb-0.5">
            <SubmitButton variant="ghost" pending={pending}>
              Registrar coste
            </SubmitButton>
          </div>
          <div className="sm:col-span-3">
            <FormMessage state={state} />
          </div>
        </form>
      )}
    </div>
  );
}

function VariantCard({
  productId,
  variant,
  canEditPrice,
  cost,
  canViewCost,
  canEditCost,
}: {
  productId: string;
  variant: VariantValues;
  canEditPrice: boolean;
  cost: CostValues | null;
  canViewCost: boolean;
  canEditCost: boolean;
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
        cost={canViewCost ? cost : null}
      />
      {canViewCost && (
        <CostPanel
          productId={productId}
          variant={variant}
          cost={cost}
          canEditCost={canEditCost}
        />
      )}
      <details className="group">
        <summary className="text-smoke tracking-caps cursor-pointer text-xs uppercase">
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
              className="accent-ink size-5"
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
  costs = {},
  canViewCost = false,
  canEditCost = false,
}: {
  productId: string;
  variants: VariantValues[];
  canEditPrice: boolean;
  /** Costes por formato; vacío si la sesión no tiene pricing.view_cost. */
  costs?: Record<string, CostValues>;
  canViewCost?: boolean;
  canEditCost?: boolean;
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
          cost={costs[variant.id] ?? null}
          canViewCost={canViewCost}
          canEditCost={canEditCost}
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
