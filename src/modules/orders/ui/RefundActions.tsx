'use client';

import type { FormEvent } from 'react';
import { startTransition, useActionState } from 'react';
import { formatEuros, parseEuros } from '@/lib/money';
import { FormMessage, IDLE } from '@/modules/admin';
import type { RefundOption } from '../domain/refunds';
import {
  requestRefund,
  resolveRefund,
  retryRefund,
} from '../server/refund-actions';
import { Field, Input, SubmitButton, useConfirm } from '@/components/ui';

const euros = (cents: number) => formatEuros(cents, 'es');

/**
 * Botones de devolución de la ficha (calculados en el servidor con
 * refundOptions). Cada uno pide confirmación con el importe; el resultado lo
 * decide la respuesta del banco, no el botón. Una devolución atascada (sin
 * respuesta clara o a medias) se reenvía o se resuelve con lo que diga el
 * portal del banco (DECISIONS §168).
 */
export function RefundActions({
  orderId,
  revision,
  options,
  stalledRefundId,
}: {
  orderId: string;
  revision: number;
  options: RefundOption[];
  /** Devolución atascada que se puede reenviar o resolver a mano. */
  stalledRefundId: string | null;
}) {
  const [state, dispatch, pending] = useActionState(requestRefund, IDLE);
  const [retryState, retryDispatch, retryPending] = useActionState(
    retryRefund,
    IDLE,
  );
  const [resolveState, resolveDispatch, resolvePending] = useActionState(
    resolveRefund,
    IDLE,
  );
  const [confirm, confirmDialog] = useConfirm();

  async function submit(
    event: FormEvent<HTMLFormElement>,
    option: RefundOption,
  ) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const amount =
      option.amountCents ?? parseEuros(String(formData.get('amount') ?? ''));
    const description =
      amount && amount > 0
        ? `Se pedirá al banco que devuelva ${euros(amount)} por el mismo medio con el que se pagó (tarjeta o Bizum). ${
            option.to === 'cancelled'
              ? 'Si la acepta, el pedido queda cancelado y sus unidades vuelven a la tienda.'
              : option.to === null
                ? 'El pedido no cambia.'
                : 'Si la acepta, el pedido queda como reembolsado.'
          } No se puede deshacer.`
        : 'Escribe el importe que quieres devolver.';
    if (
      !(await confirm({
        title: `¿${option.label}?`,
        description,
        confirmLabel: 'Pedir la devolución',
        tone: 'danger',
      }))
    )
      return;
    // Una clave por petición: si llega dos veces, la base no crea otra.
    formData.set('requestId', crypto.randomUUID());
    startTransition(() => dispatch(formData));
  }

  async function retry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    if (
      !(await confirm({
        title: '¿Volver a enviar la devolución?',
        description:
          'Antes, comprueba en el portal de Redsys que no se hizo: si ya está hecha, el banco rechazará devolver más de lo cobrado.',
        confirmLabel: 'Volver a enviar',
        tone: 'danger',
      }))
    )
      return;
    startTransition(() => retryDispatch(formData));
  }

  async function resolve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null;
    const formData = new FormData(event.currentTarget, submitter);
    const done = submitter?.value === 'succeeded';
    if (
      !(await confirm(
        done
          ? {
              title: '¿La devolución consta en el portal de Redsys?',
              description:
                'Se da por hecha sin enviar nada al banco: el pedido cambia como si el banco la hubiera aceptado (si era «Cancelar y devolver», queda cancelado y sus unidades vuelven a la tienda). Hazlo solo si la ves hecha en el portal. No se puede deshacer.',
              confirmLabel: 'Consta hecha',
              tone: 'danger',
            }
          : {
              title: '¿La devolución no consta en el portal de Redsys?',
              description:
                'Se cierra como no hecha y el pedido sigue igual; después puedes pedir otra. Hazlo solo si en el portal no aparece.',
              confirmLabel: 'No consta',
            },
      ))
    )
      return;
    startTransition(() => resolveDispatch(formData));
  }

  return (
    <div className="space-y-4">
      {options.map((option) => (
        <form
          key={option.key}
          onSubmit={(event) => submit(event, option)}
          className="flex flex-wrap items-end gap-3"
        >
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="revision" value={revision} />
          <input type="hidden" name="paymentId" value={option.paymentId} />
          <input type="hidden" name="to" value={option.to ?? ''} />
          {option.amountCents !== null ? (
            <input
              type="hidden"
              name="amountCents"
              value={option.amountCents}
            />
          ) : (
            <Field
              label="Importe a devolver (€)"
              hint={`Hasta ${euros(option.maxCents)}.`}
              className="max-w-48"
            >
              <Input name="amount" inputMode="decimal" required />
            </Field>
          )}
          <SubmitButton
            pending={pending}
            pendingLabel="Pidiendo al banco…"
            variant="danger"
          >
            {option.amountCents !== null
              ? `${option.label} (${euros(option.amountCents)})`
              : option.label}
          </SubmitButton>
        </form>
      ))}
      {stalledRefundId && (
        <div className="flex flex-wrap gap-3">
          <form onSubmit={retry}>
            <input type="hidden" name="refundId" value={stalledRefundId} />
            <SubmitButton
              pending={retryPending}
              pendingLabel="Pidiendo al banco…"
              variant="outline"
            >
              Volver a enviar la devolución
            </SubmitButton>
          </form>
          <form onSubmit={resolve} className="flex flex-wrap gap-3">
            <input type="hidden" name="refundId" value={stalledRefundId} />
            <SubmitButton
              name="status"
              value="succeeded"
              pending={resolvePending}
              pendingLabel="Guardando…"
              variant="outline"
            >
              Consta hecha en el portal
            </SubmitButton>
            <SubmitButton
              name="status"
              value="failed"
              pending={resolvePending}
              pendingLabel="Guardando…"
              variant="outline"
            >
              No consta en el portal
            </SubmitButton>
          </form>
        </div>
      )}
      <FormMessage state={state} />
      <FormMessage state={retryState} />
      <FormMessage state={resolveState} />
      {confirmDialog}
    </div>
  );
}
