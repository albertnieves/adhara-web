import type { ReactNode } from 'react';
import { cx } from './cx';

export type HeadingSize = 'display' | 'h1' | 'h2' | 'h3' | 'h4';
export type HeadingLevel = 1 | 2 | 3 | 4;

/**
 * Tamaño visual, independiente del nivel: un título de página del panel es
 * un h1 con aspecto de h2. `display` es el titular fluido de la portada.
 */
export const HEADING_SIZES: Record<HeadingSize, string> = {
  display: 'text-display font-light',
  h1: 'text-5xl font-light sm:text-6xl',
  h2: 'text-4xl font-light sm:text-5xl',
  h3: 'text-2xl font-light',
  h4: 'text-xl',
};

type HeadingProps = {
  id?: string;
  /** Solo márgenes y colocación: el tamaño y el tono los fija el componente. */
  className?: string;
  children: ReactNode;
} & (
  | { level: HeadingLevel; size?: HeadingSize }
  /** Sin nivel es un párrafo con aspecto de titular (no entra en el índice). */
  | { level?: undefined; size: HeadingSize }
);

/** Titular en Cormorant Garamond (D1) con la escala cerrada (criterio 3). */
export function Heading({
  level,
  size,
  id,
  className,
  children,
}: HeadingProps) {
  const Tag = level ? (`h${level}` as const) : 'p';
  return (
    <Tag
      id={id}
      className={cx(
        'font-display tracking-display text-balance',
        HEADING_SIZES[size ?? (`h${level}` as HeadingSize)],
        className,
      )}
    >
      {children}
    </Tag>
  );
}
