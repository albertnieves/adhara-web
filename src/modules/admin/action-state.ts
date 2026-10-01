/** Resultado de una Server Action del panel, mostrado por el formulario. */
export type ActionState = {
  status: 'idle' | 'ok' | 'error' | 'confirm';
  message?: string;
  reviewId?: string;
  reviewedInput?: string;
  /** Avisos que hay que confirmar antes de repetir la acción (precios). */
  confirm?: { code: string; label: string }[];
};

export const IDLE: ActionState = { status: 'idle' };

export function ok(message: string): ActionState {
  return { status: 'ok', message };
}

export function fail(message: string): ActionState {
  return { status: 'error', message };
}
