'use client';

import { useState } from 'react';
import {
  Field,
  FormMessage,
  SubmitButton,
  useAdminAction,
} from '@/modules/admin';
import type { SearchableVariant } from '@/modules/inventory';
import { VariantSearch } from '@/modules/inventory/ui';
import {
  assignSupplierBrand,
  removeSupplierTerms,
  saveSupplierTerms,
} from '../server/actions';
import type { SupplierTerm } from '../server/admin';

type Variant = SearchableVariant & { productId: string };

/** Fila editable de condiciones: referencia, múltiplo, plazo y preferente. */
function TermRow({
  term,
  variant,
  supplierId,
}: {
  term: SupplierTerm;
  variant: Variant | undefined;
  supplierId: string;
}) {
  const save = useAdminAction(saveSupplierTerms);
  const remove = useAdminAction(removeSupplierTerms);
  return (
    <li className="py-4">
      <p className="text-sm">
        <span className="text-smoke">{variant?.brandName ?? '—'} · </span>
        {variant?.productName ?? 'Formato archivado'}
        <span className="text-smoke"> · {variant?.variantLabel ?? ''}</span>
      </p>
      <form
        onSubmit={save.onSubmit}
        className="mt-3 grid items-end gap-3 sm:grid-cols-[1fr_7rem_7rem_auto_auto]"
      >
        <input type="hidden" name="supplierId" value={supplierId} />
        <input type="hidden" name="variantId" value={term.variantId} />
        <Field label="Ref. del proveedor">
          <input
            name="supplierSku"
            maxLength={80}
            defaultValue={term.supplierSku ?? ''}
            className="input"
          />
        </Field>
        <Field label="Múltiplo">
          <input
            name="packSize"
            type="number"
            inputMode="numeric"
            min={1}
            max={10000}
            required
            defaultValue={term.packSize}
            className="input tabular-nums"
          />
        </Field>
        <Field label="Plazo (días)">
          <input
            name="leadTimeDays"
            type="number"
            inputMode="numeric"
            min={0}
            max={365}
            defaultValue={term.leadTimeDays ?? ''}
            placeholder={
              term.effectiveLeadTimeDays !== null
                ? String(term.effectiveLeadTimeDays)
                : '—'
            }
            className="input tabular-nums"
          />
        </Field>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="preferred"
            defaultChecked={term.preferred}
            className="h-5 w-5"
          />
          Preferente
        </label>
        <SubmitButton pending={save.pending} variant="ghost">
          Guardar
        </SubmitButton>
      </form>
      <form onSubmit={remove.onSubmit} className="mt-2">
        <input type="hidden" name="supplierId" value={supplierId} />
        <input type="hidden" name="variantId" value={term.variantId} />
        <button
          type="submit"
          disabled={remove.pending}
          className="text-smoke hover:text-danger text-xs tracking-[0.14em] uppercase"
        >
          Quitar de este proveedor
        </button>
      </form>
      <div className="mt-2 space-y-1">
        <FormMessage state={save.state} />
        <FormMessage state={remove.state} />
      </div>
    </li>
  );
}

function AddTerm({
  supplierId,
  variants,
  linked,
}: {
  supplierId: string;
  variants: Variant[];
  linked: ReadonlySet<string>;
}) {
  const [picked, setPicked] = useState<Variant | null>(null);
  const { state, pending, onSubmit } = useAdminAction(saveSupplierTerms);
  return (
    <div className="panel-card space-y-4">
      <VariantSearch
        items={variants}
        label="Añadir un formato"
        onPick={setPicked}
        isDisabled={(item) => linked.has(item.variantId)}
        renderMeta={(item) =>
          linked.has(item.variantId) ? 'ya asignado' : null
        }
      />
      {picked && (
        <form
          onSubmit={onSubmit}
          className="grid items-end gap-3 sm:grid-cols-[1fr_7rem_7rem_auto_auto]"
        >
          <input type="hidden" name="supplierId" value={supplierId} />
          <input type="hidden" name="variantId" value={picked.variantId} />
          <p className="text-sm sm:col-span-5">
            {picked.brandName} · {picked.productName} · {picked.variantLabel}
          </p>
          <Field label="Ref. del proveedor">
            <input name="supplierSku" maxLength={80} className="input" />
          </Field>
          <Field label="Múltiplo">
            <input
              name="packSize"
              type="number"
              min={1}
              max={10000}
              defaultValue={1}
              required
              className="input tabular-nums"
            />
          </Field>
          <Field label="Plazo (días)">
            <input
              name="leadTimeDays"
              type="number"
              min={0}
              max={365}
              className="input tabular-nums"
            />
          </Field>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="preferred"
              defaultChecked
              className="h-5 w-5"
            />
            Preferente
          </label>
          <SubmitButton pending={pending}>Añadir</SubmitButton>
          <div className="sm:col-span-5">
            <FormMessage state={state} />
          </div>
        </form>
      )}
    </div>
  );
}

function AssignBrand({
  supplierId,
  brands,
}: {
  supplierId: string;
  brands: { id: string; name: string }[];
}) {
  const { state, pending, onSubmit } = useAdminAction(assignSupplierBrand);
  return (
    <form
      onSubmit={onSubmit}
      className="panel-card grid items-end gap-4 sm:grid-cols-[1fr_auto_auto]"
    >
      <input type="hidden" name="supplierId" value={supplierId} />
      <Field
        label="Asignar por marca"
        hint="Añade todos sus formatos que aún no tenga este proveedor."
      >
        <select name="brandId" required className="input" defaultValue="">
          <option value="" disabled>
            Elige una marca
          </option>
          <option value="all">Todo el catálogo</option>
          {brands.map((brand) => (
            <option key={brand.id} value={brand.id}>
              {brand.name}
            </option>
          ))}
        </select>
      </Field>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="preferred"
          defaultChecked
          className="h-5 w-5"
        />
        Preferente si no tienen otro
      </label>
      <SubmitButton pending={pending} variant="ghost">
        Asignar
      </SubmitButton>
      <div className="sm:col-span-3">
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function SupplierTerms({
  supplierId,
  terms,
  variants,
  brands,
}: {
  supplierId: string;
  terms: SupplierTerm[];
  variants: Variant[];
  brands: { id: string; name: string }[];
}) {
  const byId = new Map(variants.map((v) => [v.variantId, v]));
  const linked = new Set(terms.map((t) => t.variantId));
  const [filter, setFilter] = useState('');
  const needle = filter.trim().toLowerCase();
  const visible = terms
    .map((term) => ({ term, variant: byId.get(term.variantId) }))
    .filter(
      ({ variant }) =>
        !needle ||
        `${variant?.brandName} ${variant?.productName}`
          .toLowerCase()
          .includes(needle),
    )
    .sort((a, b) =>
      `${a.variant?.brandName} ${a.variant?.productName}`.localeCompare(
        `${b.variant?.brandName} ${b.variant?.productName}`,
        'es',
      ),
    );
  const SHOWN = 60;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <AddTerm supplierId={supplierId} variants={variants} linked={linked} />
        <AssignBrand supplierId={supplierId} brands={brands} />
      </div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="text-smoke text-sm">
          {terms.length} {terms.length === 1 ? 'formato' : 'formatos'} con este
          proveedor.
        </p>
        {terms.length > 10 && (
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtrar por perfume o marca"
            className="input sm:w-72"
          />
        )}
      </div>
      <ul className="divide-line border-line divide-y border-y">
        {visible.slice(0, SHOWN).map(({ term, variant }) => (
          <TermRow
            key={term.variantId}
            term={term}
            variant={variant}
            supplierId={supplierId}
          />
        ))}
      </ul>
      {visible.length > SHOWN && (
        <p className="text-smoke text-sm">
          Se muestran {SHOWN} de {visible.length}. Filtra para encontrar el
          resto.
        </p>
      )}
    </div>
  );
}
