'use client';

import { useFormStatus } from 'react-dom';

export function SubmitButton({
  children,
  pending: pendingProp,
  pendingLabel = 'Guardando…',
  variant = 'primary',
  name,
  value,
  disabled = false,
  className = '',
}: {
  children: React.ReactNode;
  /** Estado de envío de useAdminAction; si falta, se usa el del formulario. */
  pending?: boolean;
  pendingLabel?: string;
  variant?: 'primary' | 'ghost' | 'danger';
  name?: string;
  value?: string;
  disabled?: boolean;
  className?: string;
}) {
  const status = useFormStatus();
  const pending = pendingProp ?? status.pending;
  const styles = {
    primary: 'bg-ink text-ivory hover:bg-ink-soft',
    ghost: 'border border-line hover:border-ink',
    danger:
      'border border-danger/40 text-danger hover:bg-danger hover:text-ivory',
  }[variant];
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending || disabled}
      className={`tracking-caps inline-flex min-h-11 items-center justify-center px-5 text-xs font-semibold uppercase transition-colors duration-300 disabled:opacity-50 ${styles} ${className}`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
