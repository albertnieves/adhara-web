'use client';

import type { ComponentProps } from 'react';
import { SubmitButton as Base } from '@/components/ui';

/**
 * El botón de envío del panel ya es el del sistema (DS-06). Conserva su API
 * hasta la migración del panel (DS-11): `ghost` es el contorno del sistema.
 */
export function SubmitButton({
  variant = 'primary',
  ...props
}: Omit<ComponentProps<typeof Base>, 'variant'> & {
  variant?: 'primary' | 'ghost' | 'danger';
}) {
  return (
    <Base {...props} variant={variant === 'ghost' ? 'outline' : variant} />
  );
}
