'use client';

import type { ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from './Button';
import type { ButtonSize, ButtonVariant } from './Button';

/**
 * Botón de envío de un formulario: mientras se envía, la estrella titila, el
 * texto pasa a `pendingLabel` y no se puede pulsar otra vez.
 */
export function SubmitButton({
  children,
  pending: pendingProp,
  pendingLabel = 'Guardando…',
  variant = 'primary',
  size = 'md',
  name,
  value,
  disabled = false,
  className,
}: {
  children: ReactNode;
  /** Estado de envío propio (p. ej. de useAdminAction); si falta, el del formulario. */
  pending?: boolean;
  pendingLabel?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  name?: string;
  value?: string;
  disabled?: boolean;
  /** Solo colocación. */
  className?: string;
}) {
  const status = useFormStatus();
  const pending = pendingProp ?? status.pending;
  return (
    <Button
      type="submit"
      name={name}
      value={value}
      variant={variant}
      size={size}
      disabled={disabled}
      loading={pending}
      loadingLabel={pendingLabel}
      className={className}
    >
      {children}
    </Button>
  );
}
