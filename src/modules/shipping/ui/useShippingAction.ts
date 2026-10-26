'use client';

import type { ActionState } from '@/modules/admin';
import { useAdminAction } from '@/modules/admin';
import { toast } from '@/components/ui';

type Action = (state: ActionState, form: FormData) => Promise<ActionState>;

/**
 * Acciones que cambian el bloque del envío (la etiqueta sustituye al
 * formulario, la recogida al suyo): al terminar bien, aviso flotante, porque
 * el mensaje del formulario desaparece con él.
 */
export function useShippingAction(action: Action) {
  return useAdminAction(async (state: ActionState, form: FormData) => {
    const result = await action(state, form);
    if (result.status === 'ok') {
      toast(result.message ?? 'Hecho.');
      return { status: 'idle' } satisfies ActionState;
    }
    return result;
  });
}
