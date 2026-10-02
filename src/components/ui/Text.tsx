import type { ReactNode } from 'react';
import { cx } from './cx';

export type TextSize = 'body' | 'small' | 'caption';
export type TextTone =
  'inherit' | 'muted' | 'accent' | 'danger' | 'success' | 'warning';

export const TEXT_SIZES: Record<TextSize, string> = {
  body: 'text-base',
  small: 'text-sm',
  caption: 'text-xs',
};

/** Tonos de texto: semánticos, así que cumplen AA también en los oscuros. */
export const TEXT_TONES: Record<TextTone, string> = {
  inherit: '',
  muted: 'text-fg-muted',
  accent: 'text-accent-fg',
  danger: 'text-danger',
  success: 'text-success',
  warning: 'text-warning',
};

/** Texto en Manrope: cuerpo, pequeño o nota, con cifras tabulares si hacen falta. */
export function Text({
  as: Tag = 'p',
  size = 'body',
  tone = 'inherit',
  numeric = false,
  id,
  className,
  children,
}: {
  as?: 'p' | 'span' | 'div';
  size?: TextSize;
  tone?: TextTone;
  /** Cifras alineadas (precios, existencias, tablas). */
  numeric?: boolean;
  id?: string;
  /** Solo márgenes y colocación. */
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tag
      id={id}
      className={cx(
        TEXT_SIZES[size],
        TEXT_TONES[tone],
        numeric && 'lining-nums tabular-nums',
        className,
      )}
    >
      {children}
    </Tag>
  );
}
