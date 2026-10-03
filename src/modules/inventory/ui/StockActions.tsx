'use client';

import { useState } from 'react';
import type { ActionState } from '@/modules/admin';
import { Sheet, toast } from '@/components/ui';
import {
  Field,
  FormMessage,
  SubmitButton,
  useAdminAction,
} from '@/modules/admin';
import { MOVEMENT_LABELS } from '../domain/labels';
import type { MovementType } from '../domain/movements';
import { isSignedMovement, requiresReason } from '../domain/movements';
import {
  recordMovement,
  recordStocktake,
  setReorderPoint,
} from '../server/actions';

type Props = {
  /** Perfume y formato, para el título del panel de la acción. */
  title: string;
  variantId: string;
  locationId: string;
  onHand: number;
  reserved: number;
  reorderPoint: number | null;
  /** Tipos que el rol puede registrar (ya filtrados en servidor). */
  movementTypes: MovementType[];
  canStocktake: boolean;
  canAdjust: boolean;
};

type Tab = 'movement' | 'stocktake' | 'reorder';

const TITLES: Record<Tab, string> = {
  movement: 'Registrar movimiento',
  stocktake: 'Recuento',
  reorder: 'Aviso de stock bajo',
};

/**
 * Acciones de una fila de inventario. Se abren en un panel lateral para no
 * deformar la tabla; al guardar, el panel se cierra y queda un aviso.
 */
export function StockActions(props: Props) {
  const [requestId, setRequestId] = useState('');
  const [open, setOpen] = useState<Tab | null>(null);
  const [type, setType] = useState<MovementType>(
    props.movementTypes[0] ?? 'PURCHASE_RECEIPT',
  );
  // Al terminar bien, se cierra el panel y el resultado queda en un aviso.
  const closeOnSuccess =
    (
      action: (state: ActionState, formData: FormData) => Promise<ActionState>,
    ) =>
    async (state: ActionState, formData: FormData) => {
      const result = await action(state, formData);
      if (result.status === 'ok') {
        setOpen(null);
        toast(`${props.title}: ${result.message ?? 'guardado'}`);
      }
      return result;
    };
  const movement = useAdminAction(closeOnSuccess(recordMovement));
  const stocktake = useAdminAction(closeOnSuccess(recordStocktake));
  const reorder = useAdminAction(closeOnSuccess(setReorderPoint));

  const tabs: { id: Tab; label: string; show: boolean }[] = [
    {
      id: 'movement',
      label: 'Movimiento',
      show: props.movementTypes.length > 0,
    },
    { id: 'stocktake', label: 'Recuento', show: props.canStocktake },
    { id: 'reorder', label: 'Alerta', show: props.canAdjust },
  ];
  const hidden = (
    <>
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="variantId" value={props.variantId} />
      <input type="hidden" name="locationId" value={props.locationId} />
    </>
  );

  return (
    <div className="flex justify-end">
      <div className="flex flex-wrap justify-end gap-1 md:flex-nowrap">
        {tabs
          .filter((tab) => tab.show)
          .map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-haspopup="dialog"
              onClick={() => {
                setRequestId(crypto.randomUUID());
                setOpen(tab.id);
              }}
              className={`panel-btn panel-btn-sm ${open === tab.id ? 'panel-btn-primary' : ''}`}
            >
              {tab.label}
            </button>
          ))}
      </div>

      <Sheet
        open={open !== null}
        onClose={() => setOpen(null)}
        title={open ? TITLES[open] : ''}
        description={
          <>
            <span className="text-ink">{props.title}</span>
            <span className="block tabular-nums">
              En tienda {props.onHand} · reservado {props.reserved} · disponible{' '}
              {props.onHand - props.reserved}
              {props.reorderPoint !== null &&
                ` · aviso ≤ ${props.reorderPoint}`}
            </span>
          </>
        }
      >
        {open === 'movement' && (
          <form
            onSubmit={movement.onSubmit}
            onChange={() => setRequestId(crypto.randomUUID())}
            className="grid gap-4 text-left"
          >
            {hidden}
            <input type="hidden" name="onHand" value={props.onHand} />
            <input type="hidden" name="reserved" value={props.reserved} />
            <Field label="Tipo">
              <select
                name="type"
                value={type}
                onChange={(event) =>
                  setType(event.target.value as MovementType)
                }
                className="input"
              >
                {props.movementTypes.map((t) => (
                  <option key={t} value={t}>
                    {MOVEMENT_LABELS[t]}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Unidades"
              hint={
                isSignedMovement(type)
                  ? 'Positivo suma, negativo resta.'
                  : 'Siempre en positivo.'
              }
            >
              <input
                name="quantity"
                type="number"
                required
                step={1}
                min={isSignedMovement(type) ? undefined : 1}
                defaultValue={1}
                className="input tabular-nums"
              />
            </Field>
            <Field
              label={requiresReason(type) ? 'Motivo (obligatorio)' : 'Motivo'}
            >
              <input
                name="reason"
                maxLength={300}
                required={requiresReason(type)}
                className="input"
              />
            </Field>
            <Field label="Referencia" hint="Albarán, ticket…">
              <input name="reference" maxLength={120} className="input" />
            </Field>
            <SubmitButton pending={movement.pending}>Registrar</SubmitButton>
            {movement.state.status !== 'ok' && (
              <FormMessage state={movement.state} />
            )}
          </form>
        )}

        {open === 'stocktake' && (
          <form
            onSubmit={stocktake.onSubmit}
            onChange={() => setRequestId(crypto.randomUUID())}
            className="grid gap-4 text-left"
          >
            {hidden}
            <Field
              label="Unidades contadas"
              hint={`El sistema tiene ${props.onHand}. Se registra la diferencia.`}
            >
              <input
                name="counted"
                type="number"
                min={0}
                required
                defaultValue={props.onHand}
                className="input tabular-nums"
              />
            </Field>
            <Field label="Nota">
              <input name="reason" maxLength={300} className="input" />
            </Field>
            <SubmitButton pending={stocktake.pending}>
              Guardar recuento
            </SubmitButton>
            {stocktake.state.status !== 'ok' && (
              <FormMessage state={stocktake.state} />
            )}
          </form>
        )}

        {open === 'reorder' && (
          <form onSubmit={reorder.onSubmit} className="grid gap-4 text-left">
            {hidden}
            <Field
              label="Avisar cuando queden"
              hint="Vacío: sin aviso (solo al agotarse)."
            >
              <input
                name="reorderPoint"
                type="number"
                min={0}
                defaultValue={props.reorderPoint ?? ''}
                className="input tabular-nums"
              />
            </Field>
            <SubmitButton pending={reorder.pending}>Guardar</SubmitButton>
            {reorder.state.status !== 'ok' && (
              <FormMessage state={reorder.state} />
            )}
          </form>
        )}
      </Sheet>
    </div>
  );
}
