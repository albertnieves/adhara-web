'use client';

import { useMemo, useState } from 'react';
import { FormMessage, useAdminAction } from '@/modules/admin';
import {
  Badge,
  Button,
  Checkbox,
  Field,
  Input,
  SubmitButton,
  Table,
} from '@/components/ui';
import { saveVariantWeights } from '../server/actions';

export type WeightRow = {
  variantId: string;
  name: string;
  size: string;
  sizeMl: number | null;
  sku: string | null;
  published: boolean;
  weightG: number | null;
};

/**
 * Pesos de envío de los formatos (catalog.edit): el frasco con su caja, en
 * gramos, pesado en la tienda. Sin peso, ese formato no se puede enviar.
 * «Rellenar por tamaño» solo escribe en los vacíos el peso que se indique
 * para cada tamaño; se revisa y se guarda.
 */
export function VariantWeightsForm({ rows }: { rows: WeightRow[] }) {
  const { state, pending, onSubmit } = useAdminAction(saveVariantWeights);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      rows.map((r) => [r.variantId, r.weightG ? String(r.weightG) : '']),
    ),
  );
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [bySize, setBySize] = useState<Record<string, string>>({});
  const sizes = useMemo(
    () =>
      [
        ...new Set(rows.filter((r) => r.sizeMl).map((r) => r.sizeMl as number)),
      ].sort((a, b) => a - b),
    [rows],
  );
  const missing = rows.filter((r) => !values[r.variantId]?.trim()).length;
  const shown = onlyMissing ? rows.filter((r) => !r.weightG) : rows;

  function fillBySize() {
    setValues((current) => {
      const next = { ...current };
      for (const row of rows) {
        const weight = row.sizeMl ? bySize[String(row.sizeMl)]?.trim() : '';
        if (weight && !next[row.variantId]?.trim())
          next[row.variantId] = weight;
      }
      return next;
    });
  }

  return (
    <div className="space-y-8">
      {sizes.length > 0 && (
        <section className="border-border space-y-4 border p-5">
          <h2 className="text-lg">Rellenar los vacíos por tamaño</h2>
          <p className="text-fg-muted max-w-2xl text-sm">
            Pesa un frasco de cada tamaño con su caja y escribe aquí los gramos:
            se copian solo en los formatos sin peso de ese tamaño. Revisa los
            que tengan un frasco o una caja distintos antes de guardar.
          </p>
          <div className="flex flex-wrap items-end gap-4">
            {sizes.map((size) => (
              <Field key={size} label={`${size} ml (g)`} className="w-28">
                <Input
                  inputMode="numeric"
                  value={bySize[String(size)] ?? ''}
                  onChange={(event) =>
                    setBySize((current) => ({
                      ...current,
                      [String(size)]: event.target.value,
                    }))
                  }
                />
              </Field>
            ))}
            <Button type="button" variant="outline" onClick={fillBySize}>
              Rellenar vacíos
            </Button>
          </div>
        </section>
      )}
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm" role="status">
            {missing === 0
              ? 'Todos los formatos tienen peso.'
              : `${missing} ${missing === 1 ? 'formato sin peso' : 'formatos sin peso'}: no se pueden enviar.`}
          </p>
          <Checkbox
            label="Ver solo los que no tenían peso"
            checked={onlyMissing}
            onChange={(event) => setOnlyMissing(event.target.checked)}
          />
        </div>
        <Table
          caption="Peso de envío de cada formato"
          className="md:min-w-[40rem]"
        >
          <thead>
            <tr>
              <th>Perfume</th>
              <th>Formato</th>
              <th>SKU</th>
              <th className="text-right">Peso (g)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.variantId} hidden={!shown.includes(row)}>
                <td data-primary className="text-sm">
                  {row.name}{' '}
                  {!row.published && <Badge tone="neutral">Borrador</Badge>}
                </td>
                <td data-label="Formato" className="text-sm">
                  {row.size}
                </td>
                <td data-label="SKU" className="text-fg-muted text-sm">
                  {row.sku ?? '—'}
                </td>
                <td data-label="Peso (g)" className="text-right">
                  <input
                    type="hidden"
                    name={`previous:${row.variantId}`}
                    value={row.weightG ? String(row.weightG) : ''}
                  />
                  <Input
                    aria-label={`Peso de ${row.name} ${row.size}, en gramos`}
                    name={`weight:${row.variantId}`}
                    inputMode="numeric"
                    className="ml-auto w-28 text-right"
                    value={values[row.variantId] ?? ''}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        [row.variantId]: event.target.value,
                      }))
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
        <div className="flex flex-wrap items-center gap-4">
          <SubmitButton pending={pending}>Guardar pesos</SubmitButton>
          <FormMessage state={state} />
        </div>
      </form>
    </div>
  );
}
