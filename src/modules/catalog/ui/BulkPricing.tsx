'use client';

import Link from 'next/link';
import { startTransition, useActionState, useState } from 'react';
import { formatEuros } from '@/lib/money';
import { MAX_BULK_ROWS, PRICE_ISSUE_LABELS } from '@/modules/pricing';
import type { BulkRowView, BulkState } from '../server/bulk-pricing';
import { bulkChangePrices } from '../server/bulk-pricing';
import {
  Card,
  Checkbox,
  Eyebrow,
  Field,
  Input,
  Select,
  SubmitButton,
  Table,
} from '@/components/ui';

const IDLE: BulkState = { status: 'idle' };

const PERCENT = new Intl.NumberFormat('es-ES', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  signDisplay: 'exceptZero',
});

const EXCLUDED: Record<NonNullable<BulkRowView['excluded']>, string> = {
  no_price: 'Sin PVP',
  on_sale: 'En rebaja: cámbialo en su ficha',
  invalid: 'El resultado no es un precio válido',
  unchanged: 'Queda igual',
  blocked: 'Bloqueado por la revisión',
};

export function BulkPricing({
  brands,
}: {
  brands: { id: string; name: string }[];
}) {
  const [state, dispatch, pending] = useActionState(bulkChangePrices, IDLE);
  const [params, setParams] = useState({
    brandId: '',
    scope: 'all',
    kind: 'percent',
    value: '',
    ending: 'ends_95',
  });
  const [reviewed, setReviewed] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmed, setConfirmed] = useState<Record<string, string[]>>({});
  const current = JSON.stringify(params);
  const rows = state.status === 'review' ? state.rows : [];
  const applicable = rows.filter((row) => !row.excluded);
  const upToDate = state.status === 'review' && reviewed === current;
  const ready = applicable.filter(
    (row) =>
      selected.has(row.variantId) &&
      row.confirm.every((code) => confirmed[row.variantId]?.includes(code)),
  );

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(event.currentTarget, submitter);
    if (formData.get('intent') === 'review') {
      setReviewed(current);
      setSelected(new Set());
      setConfirmed({});
    }
    startTransition(() => dispatch(formData));
  }

  // Tras cada revisión se marcan por defecto las filas aplicables. Se compara
  // el estado de la acción (estable entre renders), no `rows`, que es un
  // array nuevo en cada render cuando no hay revisión.
  const [seenState, setSeenState] = useState(state);
  if (seenState !== state) {
    setSeenState(state);
    if (state.status === 'review') {
      setSelected(new Set(applicable.map((row) => row.variantId)));
    }
  }

  const set = (key: keyof typeof params) => (value: string) =>
    setParams((p) => ({ ...p, [key]: value }));

  return (
    <form onSubmit={onSubmit} className="space-y-10">
      <Card as="section" className="grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
        <Field label="Marca">
          <Select
            name="brandId"
            value={params.brandId}
            onChange={(e) => set('brandId')(e.target.value)}
          >
            <option value="">Todas</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Perfumes">
          <Select
            name="scope"
            value={params.scope}
            onChange={(e) => set('scope')(e.target.value)}
          >
            <option value="all">Todos</option>
            <option value="published">Solo publicados</option>
          </Select>
        </Field>
        <Field label="Ajuste">
          <Select
            name="kind"
            value={params.kind}
            onChange={(e) => set('kind')(e.target.value)}
          >
            <option value="percent">Porcentaje</option>
            <option value="fixed">Importe fijo</option>
          </Select>
        </Field>
        <Field
          label={params.kind === 'percent' ? 'Porcentaje' : 'Importe (€)'}
          hint={params.kind === 'percent' ? 'Ej.: +5 o -10' : 'Ej.: +2 o -1,50'}
        >
          <Input
            name="value"
            value={params.value}
            onChange={(e) => set('value')(e.target.value)}
            inputMode="decimal"
            required
            className="tabular-nums"
          />
        </Field>
        <Field label="Redondeo">
          <Select
            name="ending"
            value={params.ending}
            onChange={(e) => set('ending')(e.target.value)}
          >
            <option value="ends_95">A ,95 más cercano</option>
            <option value="ends_00">A euro entero</option>
            <option value="exact">Sin redondeo</option>
          </Select>
        </Field>
        <div className="flex flex-wrap items-center gap-4 sm:col-span-2 xl:col-span-5">
          <SubmitButton
            name="intent"
            value="review"
            variant="outline"
            pending={pending}
            pendingLabel="Calculando…"
          >
            Revisar cambios
          </SubmitButton>
          <p className="text-fg-muted text-xs">
            Hasta {MAX_BULK_ROWS} formatos por cambio. Los que están en rebaja
            se cambian desde su ficha (Ómnibus).
          </p>
          {state.status === 'error' && (
            <p role="alert" className="text-danger text-sm">
              {state.message}
            </p>
          )}
        </div>
      </Card>

      {state.status === 'done' && (
        <Card as="section" className="space-y-3" role="status">
          <Eyebrow>Hecho</Eyebrow>
          <p className="font-display text-3xl font-light lining-nums">
            {state.message}
          </p>
          {state.failures.length > 0 && (
            <ul className="text-danger space-y-1 text-sm">
              {state.failures.map((failure) => (
                <li key={failure}>{failure}</li>
              ))}
            </ul>
          )}
          <Link
            href="/admin/catalogo/etiquetas"
            className="link-underline tracking-caps text-xs uppercase"
          >
            Imprimir etiquetas nuevas
          </Link>
        </Card>
      )}

      {state.status === 'review' && (
        <section className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <p className="text-sm">
              <span className="font-display text-3xl font-light lining-nums">
                {applicable.length}
              </span>{' '}
              de {rows.length} formatos se pueden cambiar.
            </p>
            {!upToDate && (
              <p className="text-danger text-sm">
                Has cambiado los parámetros: vuelve a revisar.
              </p>
            )}
          </div>
          <div className="overflow-x-auto">
            <Table
              caption="Formatos afectados por el cambio de precio"
              stacked={false}
              className="min-w-[56rem]"
            >
              <thead>
                <tr>
                  <th className="w-10">
                    <span className="sr-only">Aplicar</span>
                  </th>
                  <th>Perfume</th>
                  <th className="text-right">PVP actual</th>
                  <th className="text-right">Nuevo PVP</th>
                  <th className="text-right">Cambio</th>
                  {state.canViewCost && <th className="text-right">Margen</th>}
                  <th>Revisión</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.variantId}
                    className={row.excluded ? 'text-fg-muted' : ''}
                  >
                    <td>
                      {!row.excluded && (
                        <Checkbox
                          checked={selected.has(row.variantId)}
                          onChange={(e) =>
                            setSelected((s) => {
                              const next = new Set(s);
                              if (e.target.checked) next.add(row.variantId);
                              else next.delete(row.variantId);
                              return next;
                            })
                          }
                          label={
                            <span className="sr-only">
                              Aplicar a {row.productName} {row.variantLabel}
                            </span>
                          }
                        />
                      )}
                    </td>
                    <td className="text-sm">
                      <Link
                        href={`/admin/catalogo/${row.productId}`}
                        className="link-underline"
                      >
                        {row.productName}
                      </Link>
                      <span className="text-fg-muted">
                        {' '}
                        · {row.brandName} · {row.variantLabel}
                      </span>
                    </td>
                    <td className="text-right tabular-nums">
                      {row.retailCents === null
                        ? '—'
                        : formatEuros(row.retailCents, 'es')}
                    </td>
                    <td className="text-right font-semibold tabular-nums">
                      {row.proposedCents === null ||
                      row.excluded === 'unchanged'
                        ? '—'
                        : formatEuros(row.proposedCents, 'es')}
                    </td>
                    <td className="text-right tabular-nums">
                      {row.changeBp === null || row.excluded === 'unchanged'
                        ? '—'
                        : PERCENT.format(row.changeBp / 10_000)}
                    </td>
                    {state.canViewCost && (
                      <td className="text-right tabular-nums">
                        {row.marginBp === null
                          ? '—'
                          : PERCENT.format(row.marginBp / 10_000)}
                      </td>
                    )}
                    <td className="text-sm">
                      {row.excluded ? (
                        EXCLUDED[row.excluded]
                      ) : row.confirm.length === 0 ? (
                        <span className="text-success">Correcto</span>
                      ) : (
                        <div className="space-y-1">
                          {row.confirm.map((code) => (
                            <Checkbox
                              key={code}
                              name={`confirm:${row.variantId}`}
                              value={code}
                              checked={
                                confirmed[row.variantId]?.includes(code) ??
                                false
                              }
                              onChange={(e) =>
                                setConfirmed((c) => {
                                  const list = new Set(c[row.variantId]);
                                  if (e.target.checked) list.add(code);
                                  else list.delete(code);
                                  return { ...c, [row.variantId]: [...list] };
                                })
                              }
                              label={PRICE_ISSUE_LABELS[code]}
                            />
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
          <Card className="flex flex-wrap items-center justify-between gap-4">
            {/* Solo se envían las filas marcadas y con todo confirmado. */}
            {ready.map((row) => (
              <input
                key={`review-${row.variantId}`}
                type="hidden"
                name={`review:${row.variantId}`}
                value={row.reviewId ?? ''}
              />
            ))}
            {ready.map((row) => (
              <input
                key={row.variantId}
                type="hidden"
                name="row"
                value={row.variantId}
              />
            ))}
            <p className="text-sm">
              {ready.length === 1
                ? 'Se aplicará 1 cambio.'
                : `Se aplicarán ${ready.length} cambios.`}{' '}
              Cada uno queda en el historial de PVP; las filas con avisos
              necesitan su confirmación.
            </p>
            <SubmitButton
              name="intent"
              value="apply"
              pending={pending}
              pendingLabel="Aplicando…"
              disabled={!upToDate || ready.length === 0}
            >
              Aplicar {ready.length}
            </SubmitButton>
          </Card>
        </section>
      )}
    </form>
  );
}
