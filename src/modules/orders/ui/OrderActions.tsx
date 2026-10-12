'use client';

import type { FormEvent } from 'react';
import { startTransition, useActionState } from 'react';
import { FormMessage, IDLE } from '@/modules/admin';
import type { PanelTransition } from '../domain/labels';
import { changeWebOrderStatus } from '../server/actions';
import { Field, Input, SubmitButton, useConfirm } from '@/components/ui';

/**
 * Pasos que la sesión puede dar sobre el pedido (calculados en el servidor con
 * panelTransitions). Los que mueven stock o resuelven una incidencia piden
 * confirmación; la base vuelve a comprobar permiso, MFA y revisión.
 */
export function OrderActions({
  orderId,
  revision,
  actions,
}: {
  orderId: string;
  revision: number;
  actions: PanelTransition[];
}) {
  const [state, dispatch, pending] = useActionState(changeWebOrderStatus, IDLE);
  const [confirm, confirmDialog] = useConfirm();
  if (actions.length === 0) return null;
  const withTracking = actions.some((action) => action.to === 'shipped');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null;
    const formData = new FormData(event.currentTarget, submitter);
    const chosen = actions.find((action) => action.to === submitter?.value);
    if (chosen?.confirm && !(await confirm({ ...chosen.confirm }))) return;
    startTransition(() => dispatch(formData));
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="revision" value={revision} />
      {withTracking && (
        <Field
          label="Nº de seguimiento"
          hint="Opcional: el de la empresa de transporte."
          className="max-w-sm"
        >
          <Input name="tracking" maxLength={120} autoComplete="off" />
        </Field>
      )}
      <div className="flex flex-wrap items-center gap-3">
        {actions.map((action) => (
          <SubmitButton
            key={action.to}
            name="to"
            value={action.to}
            pending={pending}
            pendingLabel="…"
            variant={action.variant}
          >
            {action.label}
          </SubmitButton>
        ))}
        <FormMessage state={state} />
      </div>
      {confirmDialog}
    </form>
  );
}
