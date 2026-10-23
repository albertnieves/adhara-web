'use client';

import type { FormEvent } from 'react';
import { startTransition, useActionState } from 'react';
import { FormMessage, IDLE } from '@/modules/admin';
import { releaseWebOrderReservation } from '../server/actions';
import { SubmitButton, useConfirm } from '@/components/ui';

/**
 * «Liberar la reserva» de un pedido que espera el pago (DECISIONS §164). Solo
 * se muestra si canReleaseReservation lo permite; pide confirmación porque el
 * cliente ya no podrá pagar el pedido.
 */
export function ReleaseReservation({
  orderId,
  revision,
}: {
  orderId: string;
  revision: number;
}) {
  const [state, dispatch, pending] = useActionState(
    releaseWebOrderReservation,
    IDLE,
  );
  const [confirm, confirmDialog] = useConfirm();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const confirmed = await confirm({
      title: '¿Liberar la reserva?',
      description:
        'Las unidades vuelven al stock ahora y el cliente ya no podrá pagar este pedido. Si estaba pagando en el banco y el cobro llega después, el pedido pasará a incidencias para que lo aceptes o lo devuelvas.',
      confirmLabel: 'Liberar la reserva',
      tone: 'danger',
    });
    if (confirmed) startTransition(() => dispatch(formData));
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="revision" value={revision} />
      <SubmitButton pending={pending} pendingLabel="…" variant="outline">
        Liberar la reserva
      </SubmitButton>
      <FormMessage state={state} />
      {confirmDialog}
    </form>
  );
}
