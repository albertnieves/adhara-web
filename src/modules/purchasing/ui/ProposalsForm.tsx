'use client';

import Link from 'next/link';
import { startTransition, useActionState } from 'react';
import { FormMessage } from '@/modules/admin';
import type { ProposalsState } from '../server/actions';
import { createOrdersFromProposals } from '../server/actions';
import {
  cardClass,
  Checkbox,
  Eyebrow,
  Input,
  SubmitButton,
} from '@/components/ui';

export type ProposalGroupView = {
  supplier: { id: string; name: string };
  lines: {
    variantId: string;
    label: string;
    quantity: number;
    packSize: number | null;
    reason: string;
  }[];
};

/**
 * Propuestas del vigilante agrupadas por proveedor. La persona elige qué
 * pedir y cuánto; se crea un borrador por proveedor que después revisa y
 * marca como pedido. Nada se compra solo.
 */
export function ProposalsForm({ groups }: { groups: ProposalGroupView[] }) {
  const [state, dispatch, pending] = useActionState(createOrdersFromProposals, {
    status: 'idle',
  } as ProposalsState);
  if (groups.length === 0) return null;
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => dispatch(formData));
      }}
      className="space-y-6"
    >
      {groups.map((group) => (
        <fieldset
          key={group.supplier.id}
          className={cardClass({ className: 'space-y-3' })}
        >
          <Eyebrow as="legend" className="px-1">
            {group.supplier.name}
          </Eyebrow>
          <input
            type="hidden"
            name={`name:${group.supplier.id}`}
            value={group.supplier.name}
          />
          <ul className="divide-border divide-y">
            {group.lines.map((line) => {
              const key = `${group.supplier.id}:${line.variantId}`;
              return (
                <li
                  key={key}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <Checkbox
                    name={`pick:${key}`}
                    defaultChecked
                    label={
                      <span>
                        {line.label}
                        <span className="text-fg-muted block text-xs">
                          {line.reason}
                        </span>
                      </span>
                    }
                    className="min-w-0 flex-1"
                  />
                  <label className="flex items-center gap-2 text-xs">
                    <span className="text-fg-muted">Pedir</span>
                    <Input
                      name={`qty:${key}`}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={100000}
                      step={1}
                      defaultValue={line.quantity}
                      aria-label={`Unidades a pedir de ${line.label}`}
                      className="w-24! text-right tabular-nums"
                    />
                    {line.packSize && line.packSize > 1 && (
                      <span className="text-fg-muted">x{line.packSize}</span>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>
      ))}
      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton pending={pending} pendingLabel="Creando…">
          Crear borradores de pedido
        </SubmitButton>
        <p className="text-fg-muted text-xs">
          Solo crea borradores: no se envía nada al proveedor.
        </p>
      </div>
      <FormMessage state={state} />
      {state.created && state.created.length > 0 && (
        <ul className="space-y-1 text-sm">
          {state.created.map((order) => (
            <li key={order.id}>
              <Link href={`/admin/compras/${order.id}`} className="underline">
                Borrador para {order.supplierName}
              </Link>{' '}
              · {order.lines} {order.lines === 1 ? 'línea' : 'líneas'}
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
