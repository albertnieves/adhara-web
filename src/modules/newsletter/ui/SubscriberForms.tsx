'use client';

import type { FormEvent } from 'react';
import { startTransition, useActionState } from 'react';
import { SubmitButton, useConfirm } from '@/components/ui';
import { FormMessage, IDLE, useAdminAction } from '@/modules/admin';
import { changeSubscriber, syncSubscribersToSender } from '../server/actions';

/** Envía a Sender las altas pendientes (hasta 200 por vez). */
export function SyncToSenderButton({ pending: count }: { pending: number }) {
  const { state, pending, onSubmit } = useAdminAction(syncSubscribersToSender);
  return (
    <form onSubmit={onSubmit} className="flex flex-col items-start gap-3">
      <SubmitButton
        pending={pending}
        pendingLabel="Enviando a Sender…"
        variant="outline"
        disabled={count === 0}
      >
        Enviar pendientes a Sender ({count})
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

/** Baja o borrado de un suscriptor, con confirmación. */
export function SubscriberActions({
  id,
  email,
  active,
}: {
  id: string;
  email: string;
  active: boolean;
}) {
  const [state, dispatch, pending] = useActionState(changeSubscriber, IDLE);
  const [confirm, confirmDialog] = useConfirm();
  async function guarded(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    // Los datos se leen antes de esperar la confirmación.
    const formData = new FormData(event.currentTarget, submitter);
    const remove = formData.get('intent') === 'delete';
    const confirmed = await confirm(
      remove
        ? {
            title: '¿Borrar este suscriptor?',
            description: `Se borra ${email} de la lista (derecho de supresión). No se puede deshacer.`,
            confirmLabel: 'Borrar',
            tone: 'danger',
          }
        : {
            title: '¿Dar de baja?',
            description: `${email} dejará de recibir promociones.`,
            confirmLabel: 'Dar de baja',
          },
    );
    if (confirmed) startTransition(() => dispatch(formData));
  }
  return (
    <form onSubmit={guarded} className="flex items-center justify-end gap-3">
      <input type="hidden" name="id" value={id} />
      <FormMessage state={state} />
      {active && (
        <SubmitButton
          name="intent"
          value="unsubscribe"
          variant="outline"
          pending={pending}
          pendingLabel="…"
        >
          Dar de baja
        </SubmitButton>
      )}
      <SubmitButton
        name="intent"
        value="delete"
        variant="danger"
        pending={pending}
        pendingLabel="…"
      >
        Borrar
      </SubmitButton>
      {confirmDialog}
    </form>
  );
}
