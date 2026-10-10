import type { ReactNode } from 'react';
import { cx } from './cx';

/*
 * Juego propio de iconos (D5): trazo fino de 1,5 px en una retícula de
 * 24 × 24, extremos redondeados y currentColor, así que toman el color del
 * texto y de su tono. Sin librería externa.
 */

const PATHS = {
  close: <path d="M6 6l12 12M18 6 6 18" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="m15.5 15.5 4.5 4.5" />
    </>
  ),
  arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  /** Enlace a otra pestaña: dibujada en diagonal, sin girar (no desborda). */
  external: <path d="M7 17 17 7m-8 0h8v8" />,
  chevron: <path d="m9 6 6 6-6 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  alert: (
    <>
      <path d="M12 4 21 19.5H3Z" />
      <path d="M12 10v4.5m0 2.75v.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5m0-8.75v.01" />
    </>
  ),
  cart: <path d="M6 8h12l-1 12H7L6 8Zm3 0V6.5a3 3 0 0 1 6 0V8" />,
  user: (
    <>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20c1.2-3.6 4-5.5 7-5.5s5.8 1.9 7 5.5" />
    </>
  ),
  /** Vista en cuadrícula: cuatro tarjetas. */
  grid: (
    <path d="M5 5h5.5v5.5H5Zm8.5 0H19v5.5h-5.5ZM5 13.5h5.5V19H5Zm8.5 0H19V19h-5.5Z" />
  ),
  /** Vista amplia: una tarjeta con su pie. */
  tile: <path d="M5 4h14v11H5Zm0 15.5h14" />,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;
export const ICON_NAMES = Object.keys(PATHS) as IconName[];

export type IconSize = 'sm' | 'md' | 'lg';
const SIZES: Record<IconSize, string> = {
  sm: 'size-4',
  md: 'size-5',
  lg: 'size-6',
};

/** Flechas y chevrones apuntan a la derecha; el resto, girados. */
export type IconDirection = 'right' | 'left' | 'up' | 'down';
const DIRECTIONS: Record<IconDirection, string> = {
  right: '',
  left: 'rotate-180',
  up: '-rotate-90',
  down: 'rotate-90',
};

/**
 * Icono de trazo. Sin `label` es decorativo (aria-hidden): el control que lo
 * lleva tiene su propio nombre. Con `label` es una imagen con nombre.
 */
export function Icon({
  name,
  size = 'md',
  direction = 'right',
  label,
  className,
}: {
  name: IconName;
  size?: IconSize;
  /** Solo para `arrow` y `chevron`. */
  direction?: IconDirection;
  label?: string;
  /** Solo colocación (márgenes, flex). */
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cx(
        // El trazo mide 1,5 px a cualquier tamaño.
        'shrink-0 [&_*]:[vector-effect:non-scaling-stroke]',
        SIZES[size],
        (name === 'arrow' || name === 'chevron') && DIRECTIONS[direction],
        className,
      )}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
