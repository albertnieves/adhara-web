import type { ReactNode } from 'react';
import { cx } from './cx';

export type EyebrowTone = 'muted' | 'accent' | 'inherit';

const TONES: Record<EyebrowTone, string> = {
  muted: 'text-fg-muted',
  accent: 'text-accent-fg',
  inherit: '',
};

/**
 * Antetítulo en versalitas: 11 px, el tamaño mínimo, con el espaciado amplio.
 * Siempre en Manrope, también cuando es un encabezado (h2, h3).
 */
export function Eyebrow({
  as: Tag = 'p',
  tone = 'muted',
  id,
  className,
  children,
}: {
  as?: 'p' | 'span' | 'h2' | 'h3' | 'dt' | 'legend';
  tone?: EyebrowTone;
  id?: string;
  /** Solo márgenes y colocación. */
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tag
      id={id}
      className={cx(
        'text-2xs tracking-caps-lg font-sans font-normal uppercase',
        TONES[tone],
        className,
      )}
    >
      {children}
    </Tag>
  );
}
