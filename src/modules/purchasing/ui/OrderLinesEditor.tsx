'use client';

import { useState, useTransition } from 'react';
import { formatEuros, parseEuros } from '@/lib/money';
import type { ActionState } from '@/modules/admin';
import { FormMessage } from '@/modules/admin';
import type { SearchableVariant } from '@/modules/inventory';
import { VariantSearch } from '@/modules/inventory/ui';
import { orderCostCents } from '../domain/orders';
import { savePurchaseOrderLines } from '../server/actions';
import { buttonClass, Input, Table } from '@/components/ui';

type Row = {
  variantId: string;
  quantity: number;
  /** Coste neto en euros tal como se escribe; solo con permiso de costes. */
  unitCost: string;
  costDirty: boolean;
};

type Terms = { supplierSku: string | null; packSize: number };

const toEuros = (cents: number | null) =>
  cents === null ? '' : (cents / 100).toFixed(2).replace('.', ',');

/**
 * Líneas de un borrador: añadir por búsqueda, cantidades y coste neto
 * unitario. Se guarda todo junto con la revisión que se cargó: si otra
 * persona cambió el pedido entretanto, no se sobrescribe.
 */
export function OrderLinesEditor({
  orderId,
  revision,
  lines,
  variants,
  terms,
  canCost,
}: {
  orderId: string;
  revision: number;
  lines: {
    variantId: string;
    quantityOrdered: number;
    unitCostNetCents: number | null;
  }[];
  variants: SearchableVariant[];
  terms: Record<string, Terms>;
  canCost: boolean;
}) {
  const byId = new Map(variants.map((v) => [v.variantId, v]));
  const initial = lines.map((line) => ({
    variantId: line.variantId,
    quantity: line.quantityOrdered,
    unitCost: toEuros(line.unitCostNetCents),
    costDirty: false,
  }));
  const [rows, setRows] = useState<Row[]>(initial);
  const [state, setState] = useState<ActionState>({ status: 'idle' });
  const [pending, startTransition] = useTransition();
  // Al guardar llega otra revisión con lo guardado (y el coste vigente de las
  // líneas nuevas): se toman esas líneas sin perder el mensaje.
  const [seenRevision, setSeenRevision] = useState(revision);
  if (seenRevision !== revision) {
    setSeenRevision(revision);
    setRows(initial);
  }
  const dirty = JSON.stringify(rows) !== JSON.stringify(initial);

  const update = (variantId: string, patch: Partial<Row>) => {
    setRows((current) =>
      current.map((row) =>
        row.variantId === variantId ? { ...row, ...patch } : row,
      ),
    );
    setState({ status: 'idle' });
  };

  function add(variant: SearchableVariant) {
    if (rows.some((row) => row.variantId === variant.variantId)) return;
    setRows((current) => [
      ...current,
      {
        variantId: variant.variantId,
        quantity: terms[variant.variantId]?.packSize ?? 1,
        unitCost: '',
        costDirty: false,
      },
    ]);
    setState({ status: 'idle' });
  }

  function save() {
    startTransition(async () => {
      const result = await savePurchaseOrderLines({
        orderId,
        revision,
        lines: rows.map((row) => ({
          variantId: row.variantId,
          quantity: row.quantity,
          // Sin tocar: el servidor conserva el coste o toma el vigente.
          ...(canCost && row.costDirty ? { unitCost: row.unitCost } : {}),
        })),
      });
      setState(result);
    });
  }

  const costs = rows.map((row) => ({
    quantity: row.quantity,
    unitCostCents: row.unitCost ? parseEuros(row.unitCost) : null,
  }));
  const total = orderCostCents(costs);
  const units = rows.reduce((sum, row) => sum + row.quantity, 0);

  return (
    <div className="space-y-6">
      <VariantSearch
        items={variants}
        label="Añadir perfume al pedido"
        onPick={add}
        isDisabled={(item) =>
          rows.some((row) => row.variantId === item.variantId)
        }
        renderMeta={(item) =>
          terms[item.variantId]
            ? `ref. ${terms[item.variantId]!.supplierSku ?? '—'} · x${terms[item.variantId]!.packSize}`
            : 'sin condiciones'
        }
      />
      {rows.length === 0 ? (
        <p className="text-fg-muted text-sm">El pedido aún no tiene líneas.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table
            caption="Líneas del pedido"
            stacked={false}
            className="min-w-[40rem]"
          >
            <thead>
              <tr>
                <th>Perfume</th>
                <th>Ref. proveedor</th>
                <th className="text-right">Unidades</th>
                {canCost && <th className="text-right">Coste neto ud.</th>}
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const v = byId.get(row.variantId);
                const t = terms[row.variantId];
                const offPack =
                  t && t.packSize > 1 && row.quantity % t.packSize !== 0;
                return (
                  <tr key={row.variantId}>
                    <td className="text-sm">
                      <span className="text-fg-muted">{v?.brandName} · </span>
                      {v?.productName ?? row.variantId}
                      <span className="text-fg-muted">
                        {' '}
                        · {v?.variantLabel}
                      </span>
                    </td>
                    <td className="text-fg-muted text-sm">
                      {t?.supplierSku ?? '—'}
                    </td>
                    <td className="text-right">
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={100000}
                        value={row.quantity}
                        onChange={(e) =>
                          update(row.variantId, {
                            quantity: Math.max(
                              1,
                              Math.floor(Number(e.target.value)) || 1,
                            ),
                          })
                        }
                        aria-label="Unidades"
                        className="w-24! text-right tabular-nums"
                      />
                      {offPack && (
                        <p className="text-danger mt-1 text-xs">
                          El proveedor vende de {t.packSize} en {t.packSize}
                        </p>
                      )}
                    </td>
                    {canCost && (
                      <td className="text-right">
                        <Input
                          inputMode="decimal"
                          value={row.unitCost}
                          placeholder="vigente"
                          onChange={(e) =>
                            update(row.variantId, {
                              unitCost: e.target.value,
                              costDirty: true,
                            })
                          }
                          aria-label="Coste neto por unidad"
                          className="w-28! text-right tabular-nums"
                        />
                      </td>
                    )}
                    <td className="text-right">
                      <button
                        type="button"
                        onClick={() =>
                          setRows((current) =>
                            current.filter(
                              (r) => r.variantId !== row.variantId,
                            ),
                          )
                        }
                        className="text-fg-muted hover:text-danger tracking-caps-sm min-h-11 px-2 text-xs uppercase"
                      >
                        Quitar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={save}
          disabled={pending || !dirty}
          className={buttonClass('primary')}
        >
          {pending ? 'Guardando…' : 'Guardar líneas'}
        </button>
        <p className="text-fg-muted text-sm">
          {units} {units === 1 ? 'unidad' : 'unidades'}
          {canCost &&
            (total === null
              ? ' · coste total: falta algún coste'
              : ` · coste total ${formatEuros(total, 'es')} sin IVA`)}
          {dirty && ' · cambios sin guardar'}
        </p>
      </div>
      <FormMessage state={state} />
    </div>
  );
}
