'use client';

import Link from 'next/link';
import { startTransition, useActionState, useState } from 'react';
import { formatEuros } from '@/lib/money';
import type { PlannedRow } from '../domain/import';
import { IMPORT_COLUMNS } from '../domain/import';
import { CONCENTRATION_NAMES } from '../domain/product';
import type { ImportState } from '../server/import';
import { importCatalog } from '../server/import';
import {
  Card,
  Checkbox,
  Eyebrow,
  Field,
  Input,
  Select,
  SubmitButton,
  Table,
  Textarea,
} from '@/components/ui';

const IDLE: ImportState = { status: 'idle' };

/** Excel en español guarda los CSV en Windows-1252 si no se elige UTF-8. */
async function readText(file: File) {
  const buffer = await file.arrayBuffer();
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('windows-1252').decode(buffer);
  }
}

function downloadTemplate() {
  const blob = new Blob([`﻿${IMPORT_COLUMNS.join(';')}\n`], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'plantilla-catalogo-atelier-du-desert.csv';
  link.click();
  URL.revokeObjectURL(url);
}

function Chip({
  tone = 'default',
  children,
}: {
  tone?: 'default' | 'new' | 'warn' | 'muted';
  children: React.ReactNode;
}) {
  const tones = {
    default: 'border-border',
    new: 'border-accent/60 text-fg',
    warn: 'border-danger/50 text-danger',
    muted: 'border-border text-fg-muted',
  };
  return (
    <span
      className={`text-2xs inline-block border px-2 py-0.5 whitespace-nowrap ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function RowOutcome({
  row,
  canSetPrices,
  canRecordCosts,
}: {
  row: PlannedRow;
  canSetPrices: boolean;
  canRecordCosts: boolean;
}) {
  const fill = Object.keys(row.product.fill).map(
    (field) =>
      ({
        concentration: 'concentración',
        audience: 'público',
        source_ref: 'origen',
      })[field] ?? field,
  );
  return (
    <div className="flex flex-wrap gap-1.5">
      {!row.brand.existingId && <Chip tone="new">Marca nueva</Chip>}
      {!row.product.existingId && <Chip tone="new">Perfume nuevo</Chip>}
      {fill.length > 0 && <Chip>Completa {fill.join(', ')}</Chip>}
      <Chip tone={row.variant.existingId ? 'muted' : 'new'}>
        {row.variant.existingId ? 'Formato existente' : 'Formato nuevo'}
      </Chip>
      {row.price.kind === 'set' && (
        <Chip tone={canSetPrices ? 'new' : 'muted'}>
          {canSetPrices ? 'Fija PVP' : 'PVP sin permiso'}
        </Chip>
      )}
      {row.price.kind === 'same' && <Chip tone="muted">PVP igual</Chip>}
      {row.price.kind === 'conflict' && (
        <Chip tone="warn">
          PVP actual {formatEuros(row.price.currentCents, 'es')}: no se cambia
        </Chip>
      )}
      {row.cost.kind === 'record' && (
        <Chip tone={canRecordCosts ? 'new' : 'muted'}>
          {canRecordCosts ? 'Registra coste' : 'Coste sin permiso'}
        </Chip>
      )}
      {row.cost.kind === 'same' && <Chip tone="muted">Coste igual</Chip>}
      {row.product.warnings.map((warning) => (
        <Chip key={warning} tone="warn">
          {warning}
        </Chip>
      ))}
    </div>
  );
}

export function CatalogImport({ canSetPrices }: { canSetPrices: boolean }) {
  const [state, dispatch, pending] = useActionState(importCatalog, IDLE);
  const [csv, setCsv] = useState('');
  const [source, setSource] = useState('');
  const [costVat, setCostVat] = useState('net');
  const [fileName, setFileName] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const current = `${source}\n${costVat}\n${csv}`;
  const upToDate = state.status === 'review' && reviewed === current;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(event.currentTarget, submitter);
    if (formData.get('intent') === 'review') {
      setReviewed(current);
      setConfirmed(false);
    }
    startTransition(() => dispatch(formData));
  }

  const plan = state.status === 'review' ? state.plan : null;

  return (
    <form onSubmit={onSubmit} className="space-y-10">
      <Card as="section" className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>1 · Archivo</Eyebrow>
            <p className="text-fg-muted mt-2 max-w-2xl text-sm leading-relaxed">
              CSV con cabecera (separado por «;» o «,»). Columnas:{' '}
              <span className="text-fg">{IMPORT_COLUMNS.join(', ')}</span>. Solo
              «marca» y «nombre» son obligatorias. Nada se publica: todo lo
              nuevo queda en borrador.
            </p>
          </div>
          <button
            type="button"
            onClick={downloadTemplate}
            className="link-underline tracking-caps inline-flex min-h-11 items-center text-xs uppercase"
          >
            Descargar plantilla
          </button>
        </div>
        <label className="border-border hover:border-fg flex cursor-pointer flex-col items-center justify-center gap-2 border border-dashed px-6 py-8 text-center text-sm transition-colors">
          <span className="font-display text-2xl font-light">
            {fileName ?? 'Elegir archivo CSV'}
          </span>
          <span className="text-fg-muted text-xs">
            o pega el contenido debajo
          </span>
          <input
            type="file"
            accept=".csv,text/csv,text/plain"
            className="sr-only"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              setFileName(file.name);
              setCsv(await readText(file));
            }}
          />
        </label>
        <Field label="Contenido CSV">
          <Textarea
            name="csv"
            value={csv}
            onChange={(event) => setCsv(event.target.value)}
            rows={8}
            spellCheck={false}
            placeholder={`${IMPORT_COLUMNS.join(';')}\n…`}
            className="font-mono! text-xs! leading-relaxed"
          />
        </Field>
        <Field
          label="Origen por defecto"
          hint="Se guarda como procedencia en las filas sin «origen». Por ejemplo: CATALOGO global 2026."
        >
          <Input
            name="source"
            value={source}
            onChange={(event) => setSource(event.target.value)}
            maxLength={200}
          />
        </Field>
        <Field
          label="Costes del archivo"
          hint="Solo si el CSV trae la columna «coste». Se guardan netos, sin IVA, y solo los ve quien tiene permiso de costes."
        >
          <Select
            name="costVat"
            value={costVat}
            onChange={(event) => setCostVat(event.target.value)}
          >
            <option value="net">Sin IVA (netos)</option>
            <option value="gross">Con IVA del 21 % (se pasan a netos)</option>
          </Select>
        </Field>
        <div className="flex flex-wrap items-center gap-4">
          <SubmitButton
            name="intent"
            value="review"
            variant="outline"
            pending={pending}
            pendingLabel="Revisando…"
          >
            Revisar
          </SubmitButton>
          {state.status === 'error' && (
            <p role="alert" className="text-danger text-sm">
              {state.message}
            </p>
          )}
        </div>
      </Card>

      {state.status === 'done' && (
        <Card as="section" className="space-y-4" role="status">
          <Eyebrow>Hecho</Eyebrow>
          <p className="font-display text-3xl font-light lining-nums">
            {state.message}
          </p>
          {state.priceConflicts > 0 && (
            <p className="text-sm">
              {state.priceConflicts} PVP distintos del actual no se han
              cambiado: revísalos en cada ficha (pasan por Ómnibus).
            </p>
          )}
          {state.pricesSkipped > 0 && (
            <p className="text-sm">
              {state.pricesSkipped} PVP no se han fijado porque tu rol no puede
              cambiar precios.
            </p>
          )}
          {state.costsSkipped > 0 && (
            <p className="text-sm">
              {state.costsSkipped} costes no se han registrado porque tu rol no
              puede registrar costes.
            </p>
          )}
          {state.failures.length > 0 && (
            <p className="text-sm">
              {state.failures.length} filas con errores no se importaron.
            </p>
          )}
          <Link
            href="/admin/catalogo?estado=draft"
            className="link-underline tracking-caps text-xs uppercase"
          >
            Ver borradores
          </Link>
        </Card>
      )}

      {plan && (
        <section className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <Eyebrow>2 · Revisión</Eyebrow>
              {!upToDate && (
                <p className="text-danger mt-2 text-sm">
                  Has cambiado el CSV, el origen o los costes: vuelve a
                  revisarlo.
                </p>
              )}
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-9">
            {(
              [
                ['Marcas nuevas', plan.summary.newBrands],
                ['Perfumes nuevos', plan.summary.newProducts],
                ['Perfumes completados', plan.summary.filledProducts],
                ['Formatos nuevos', plan.summary.newVariants],
                ['PVP a fijar', plan.summary.pricesToSet],
                ['PVP en conflicto', plan.summary.priceConflicts],
                ['Costes a registrar', plan.summary.costsToRecord],
                ['Sin cambios', plan.summary.unchanged],
                ['Filas con error', plan.summary.errors],
              ] as const
            ).map(([label, value]) => (
              <Card key={label} padding="sm">
                <dt className="text-fg-muted text-xs">{label}</dt>
                <dd
                  className={`font-display mt-1 text-3xl font-light lining-nums tabular-nums ${
                    value > 0 &&
                    (label === 'PVP en conflicto' ||
                      label === 'Filas con error')
                      ? 'text-danger'
                      : ''
                  }`}
                >
                  {value}
                </dd>
              </Card>
            ))}
          </dl>
          {state.status === 'review' && state.unknownColumns.length > 0 && (
            <p className="text-fg-muted text-sm">
              Columnas ignoradas: {state.unknownColumns.join(', ')}.
            </p>
          )}

          {plan.errors.length > 0 && (
            <div className="border-danger/40 border p-5">
              <p className="text-danger mb-3 text-sm font-semibold">
                Filas que no se importarán
              </p>
              <ul className="space-y-1 text-sm">
                {plan.errors.map((error) => (
                  <li key={`${error.line}-${error.message}`}>
                    <span className="text-fg-muted tabular-nums">
                      Línea {error.line}:
                    </span>{' '}
                    {error.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {plan.rows.length > 0 && (
            <div className="overflow-x-auto">
              <Table
                caption="Revisión de la importación, fila a fila"
                stacked={false}
                className="min-w-[48rem]"
              >
                <thead>
                  <tr>
                    <th>Línea</th>
                    <th>Perfume</th>
                    <th>Formato</th>
                    <th>PVP</th>
                    <th>Coste</th>
                    <th>Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.rows.map((row) => (
                    <tr key={row.line}>
                      <td className="text-fg-muted tabular-nums">{row.line}</td>
                      <td>
                        <span className="text-fg-muted">
                          {row.brand.name} ·{' '}
                        </span>
                        {row.product.name}
                        {row.row.concentration && (
                          <span className="text-fg-muted">
                            {' '}
                            · {CONCENTRATION_NAMES[row.row.concentration]}
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap">
                        {row.variant.label ??
                          (row.variant.sizeMl
                            ? `${row.variant.sizeMl} ml`
                            : '—')}
                      </td>
                      <td className="whitespace-nowrap tabular-nums">
                        {row.row.priceCents === null
                          ? '—'
                          : formatEuros(row.row.priceCents, 'es')}
                      </td>
                      <td className="whitespace-nowrap tabular-nums">
                        {row.row.costCents === null
                          ? '—'
                          : formatEuros(row.row.costCents, 'es')}
                      </td>
                      <td>
                        <RowOutcome
                          row={row}
                          canSetPrices={
                            state.status === 'review' && state.canSetPrices
                          }
                          canRecordCosts={
                            state.status === 'review' && state.canRecordCosts
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}

          {plan.rows.length > 0 && (
            <Card className="flex flex-wrap items-center justify-between gap-4">
              <Checkbox
                name="confirm"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                label={
                  <>
                    He revisado las {plan.rows.length} filas; crear como
                    borradores.{' '}
                  </>
                }
              />
              <SubmitButton
                name="intent"
                value="apply"
                pending={pending}
                pendingLabel="Importando…"
                disabled={!upToDate || !confirmed}
              >
                Importar
              </SubmitButton>
            </Card>
          )}
          {!canSetPrices && plan.summary.pricesToSet > 0 && (
            <p className="text-fg-muted text-sm">
              Tu rol no puede fijar PVP: se importarán los formatos sin precio.
            </p>
          )}
        </section>
      )}
    </form>
  );
}
