import type { ReactNode } from 'react';
import { cx } from './cx';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'accent';

/** Borde y texto del mismo semántico: cumplen AA en el tono claro y los oscuros. */
const TONES: Record<BadgeTone, string> = {
  neutral: 'border-border-strong text-fg-muted',
  success: 'border-success text-success',
  warning: 'border-warning text-warning',
  danger: 'border-danger text-danger',
  accent: 'border-accent text-accent-fg',
};

export const BADGE_TONES = Object.keys(TONES) as BadgeTone[];

/**
 * Estado en una palabra (Fase 2, DS-09): publicación, existencias o pedido.
 * El color acompaña al texto, nunca lo sustituye.
 */
export function Badge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: BadgeTone;
  /** Solo colocación. */
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        'text-2xs tracking-caps inline-flex items-center border px-2 py-0.5 font-sans font-semibold whitespace-nowrap uppercase',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Etiqueta descriptiva (casa, concentración, público): fondo hundido y
 * texto normal, sin significado de estado.
 */
export function Tag({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        'bg-surface-sunken text-fg inline-flex items-center px-2.5 py-1 font-sans text-xs whitespace-nowrap',
        className,
      )}
    >
      {children}
    </span>
  );
}
