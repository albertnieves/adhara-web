'use client';

import type { FormEvent } from 'react';
import { startTransition, useActionState } from 'react';
import type { ActionState } from './action-state';
import { IDLE } from './action-state';

/**
 * Envía el formulario a una Server Action sin el reinicio automático de React 19
 * (que borraría lo escrito al mostrar un error o pedir una confirmación).
 */
export function useAdminAction(
  action: (state: ActionState, formData: FormData) => Promise<ActionState>,
) {
  const [state, dispatch, pending] = useActionState(action, IDLE);
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(event.currentTarget, submitter);
    startTransition(() => dispatch(formData));
  }
  return { state, pending, onSubmit };
}
