'use client';

import type { FormEvent } from 'react';
import { startTransition, useActionState } from 'react';
import { formatEuros, parseEuros } from '@/lib/money';
import { FormMessage, IDLE } from '@/modules/admin';
import type { RefundOption } from '../domain/refunds';
import { requestRefund, retryRefund } from '../server/refund-actions';
import { Field, Input, SubmitButton, useConfirm } from '@/components/ui';

const euros = (cents: number) => formatEuros(cents, 'es');

/**
 * Botones de devolución de la ficha (calculados en el servidor con
 * refundOptions). Cada uno pide confirmación con el importe; el resultado lo
 * decide la respuesta del banco, no el botón.
 */
export function RefundActions({
  orderId,
  revision,
  options,
  unknownRefundId,
}: {
  orderId: string;
  revision: number;
  options: RefundOption[];
  /** Devolución sin respuesta clara que se puede volver a enviar. */
  unknownRefundId: string | null;
}) {
  const [state, dispatch, pending] = useActionState(requestRefund, IDLE);
  const [retryState, retryDispatch, retryPending] = useActionState(
    retryRefund,
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
      {unknownRefundId && (
        <form onSubmit={retry}>
          <input type="hidden" name="refundId" value={unknownRefundId} />
          <SubmitButton
            pending={retryPending}
            pendingLabel="Pidiendo al banco…"
            variant="outline"
          >
            Volver a enviar la devolución
          </SubmitButton>
        </form>
      )}
      <FormMessage state={state} />
      <FormMessage state={retryState} />
      {confirmDialog}
    </div>
  );
}
