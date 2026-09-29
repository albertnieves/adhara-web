'use client';

import { useState } from 'react';
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

/** Acciones de una fila de inventario, en un panel desplegable. */
export function StockActions(props: Props) {
  const [open, setOpen] = useState<Tab | null>(null);
  const [type, setType] = useState<MovementType>(
    props.movementTypes[0] ?? 'PURCHASE_RECEIPT',
  );
  const movement = useAdminAction(recordMovement);
  const stocktake = useAdminAction(recordStocktake);
  const reorder = useAdminAction(setReorderPoint);

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
      <input type="hidden" name="variantId" value={props.variantId} />
      <input type="hidden" name="locationId" value={props.locationId} />
    </>
  );

  return (
    <div className="flex flex-col items-end gap-3">
      <div className="flex gap-1">
        {tabs
          .filter((tab) => tab.show)
          .map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-expanded={open === tab.id}
              onClick={() => setOpen(open === tab.id ? null : tab.id)}
              className={`border px-3 py-2 text-[0.625rem] font-semibold tracking-[0.14em] uppercase transition-colors ${
                open === tab.id
                  ? 'border-ink bg-ink text-ivory'
                  : 'border-line hover:border-ink'
              }`}
            >
              {tab.label}
            </button>
          ))}
      </div>

      {open === 'movement' && (
        <form
          onSubmit={movement.onSubmit}
          className="panel-card grid w-full min-w-[18rem] gap-3 text-left sm:w-[26rem]"
        >
          {hidden}
          <input type="hidden" name="onHand" value={props.onHand} />
          <input type="hidden" name="reserved" value={props.reserved} />
          <Field label="Tipo">
            <select
              name="type"
              value={type}
              onChange={(event) => setType(event.target.value as MovementType)}
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
          <FormMessage state={movement.state} />
        </form>
      )}

      {open === 'stocktake' && (
        <form
          onSubmit={stocktake.onSubmit}
          className="panel-card grid w-full min-w-[18rem] gap-3 text-left sm:w-[26rem]"
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
          <FormMessage state={stocktake.state} />
        </form>
      )}

      {open === 'reorder' && (
        <form
          onSubmit={reorder.onSubmit}
          className="panel-card grid w-full min-w-[18rem] gap-3 text-left sm:w-[26rem]"
        >
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
          <FormMessage state={reorder.state} />
        </form>
      )}
    </div>
  );
}
