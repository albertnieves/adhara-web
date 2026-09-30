import type { ActionState } from '../action-state';

export function FormMessage({ state }: { state: ActionState }) {
  if (state.status === 'idle' || !state.message) return null;
  const tone =
    state.status === 'ok'
      ? 'border-success/30 text-success'
      : state.status === 'confirm'
        ? 'border-gold/50 text-ink'
        : 'border-danger/30 text-danger';
  return (
    <p
      role={state.status === 'error' ? 'alert' : 'status'}
      className={`border-l-2 bg-white/50 px-4 py-3 text-sm ${tone}`}
    >
      {state.message}
    </p>
  );
}
