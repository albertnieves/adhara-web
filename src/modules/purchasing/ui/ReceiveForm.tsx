'use client';

import { startTransition, useActionState, useState } from 'react';
import { newRequestId } from '@/lib/request-id';
import type { ActionState } from '@/modules/admin';
import { FormMessage, IDLE } from '@/modules/admin';
import type { SearchableVariant } from '@/modules/inventory';
import { receivePurchaseOrder } from '../server/actions';
import { Checkbox, Field, Input, SubmitButton, Table } from '@/components/ui';

type Line = {
  lineId: number;
  variantId: string;
  ordered: number;
  received: number;
  supplierSku: string | null;
};

/**
 * Recepción de mercancía. Por defecto propone lo pendiente de cada línea; se
 * corrige con lo que llega de verdad. Repetir el envío del mismo formulario
 * (doble toque, red lenta) no vuelve a sumar stock: la clave de petición solo
 * cambia cuando cambian las cantidades o tras registrarse.
 */
export function ReceiveForm({
  orderId,
  lines,
  variants,
  canRecordCosts,
  receivable,
}: {
  orderId: string;
  lines: Line[];
  variants: SearchableVariant[];
  canRecordCosts: boolean;
  /** El estado del pedido admite recepciones (pedido o recibido en parte). */
  receivable: boolean;
}) {
  const byId = new Map(variants.map((v) => [v.variantId, v]));
  const [request, setRequest] = useState<{
    id: string;
    signature: string;
  } | null>(null);
  // Cada recepción registrada vacía el albarán para la siguiente entrega.
  const [round, setRound] = useState(0);
  const [state, dispatch, pending] = useActionState(
    async (previous: ActionState, formData: FormData) => {
      const result = await receivePurchaseOrder(previous, formData);
      if (result.status === 'ok') {
        setRequest(null);
        setRound((n) => n + 1);
      }
      return result;
    },
    IDLE,
  );
  const open = lines.filter((line) => line.received < line.ordered);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const signature = JSON.stringify([...formData.entries()]);
    const id = request?.signature === signature ? request.id : newRequestId();
    setRequest({ id, signature });
    formData.set('requestId', id);
    startTransition(() => dispatch(formData));
  }

  // Tras la última recepción el pedido deja de admitir más: el componente
  // sigue montado para que se vea la confirmación.
  if (!receivable || open.length === 0) {
    return (
      <div className="space-y-4">
        <FormMessage state={state} />
        <p className="text-fg-muted text-sm">
          {open.length === 0
            ? 'No queda nada por recibir.'
            : 'El pedido está cerrado: no admite más recepciones.'}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <input type="hidden" name="orderId" value={orderId} />
      <div className="overflow-x-auto">
        <Table
          caption="Líneas por recibir"
          stacked={false}
          className="min-w-[36rem]"
        >
          <thead>
            <tr>
              <th>Perfume</th>
              <th className="text-right">Pedido</th>
              <th className="text-right">Recibido</th>
              <th className="text-right">Llega ahora</th>
            </tr>
          </thead>
          <tbody>
            {open.map((line) => {
              const v = byId.get(line.variantId);
              const pendingUnits = line.ordered - line.received;
              return (
                <tr key={line.lineId}>
                  <td className="text-sm">
                    <span className="text-fg-muted">{v?.brandName} · </span>
                    {v?.productName ?? line.variantId}
                    <span className="text-fg-muted"> · {v?.variantLabel}</span>
                    {line.supplierSku && (
                      <span className="text-fg-muted block text-xs">
                        ref. {line.supplierSku}
                      </span>
                    )}
                  </td>
                  <td className="text-right tabular-nums">{line.ordered}</td>
                  <td className="text-fg-muted text-right tabular-nums">
                    {line.received}
                  </td>
                  <td className="text-right">
                    <Input
                      key={`${line.lineId}:${line.received}`}
                      name={`qty:${line.lineId}`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={pendingUnits}
                      defaultValue={pendingUnits}
                      aria-label="Unidades que llegan"
                      className="w-24! text-right tabular-nums"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </div>
      <div className="grid items-end gap-4 sm:grid-cols-[1fr_auto]">
        <Field label="Albarán" hint="Nº del albarán o de la entrega.">
          <Input key={round} name="reference" maxLength={120} />
        </Field>
        {canRecordCosts && (
          <Checkbox
            name="recordCosts"
            defaultChecked
            label="El coste del pedido pasa a ser el coste vigente"
          />
        )}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton pending={pending} pendingLabel="Registrando…">
          Registrar recepción
        </SubmitButton>
        <p className="text-fg-muted text-xs">
          Suma stock en la tienda y deja un movimiento con el número del pedido.
          Lo que no llegue queda pendiente.
        </p>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
