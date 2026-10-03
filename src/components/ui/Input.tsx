import type { ComponentProps } from 'react';
import { Star } from '@/modules/brand';
import { cx } from './cx';
import { Icon } from './Icon';

/**
 * Caja de los controles de texto: 44 px de alto y 16 px de letra (iOS no
 * amplía la página al enfocar). El foco es el contorno global de 2 px; el
 * borde marca el paso del ratón, el error, el deshabilitado y la solo
 * lectura, que tiene fondo hundido y borde discontinuo.
 */
export const CONTROL_CLASSES =
  'min-h-11 w-full border border-border-strong bg-surface-raised px-3 py-2 font-sans text-base text-fg placeholder:text-fg-muted transition-colors duration-(--duration-fast) ease-luxe enabled:hover:border-fg aria-invalid:border-danger enabled:aria-invalid:hover:border-danger disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-sunken disabled:text-fg-muted [&[readonly]]:border-dashed [&[readonly]]:bg-surface-sunken';

export type InputType =
  | 'text'
  | 'email'
  | 'password'
  | 'tel'
  | 'url'
  | 'number'
  | 'date'
  | 'time'
  | 'datetime-local';

/** Texto de una línea. Las casillas, radios y búsquedas tienen el suyo. */
export function Input({
  type = 'text',
  className,
  ...props
}: Omit<ComponentProps<'input'>, 'type'> & { type?: InputType }) {
  return (
    <input {...props} type={type} className={cx(CONTROL_CLASSES, className)} />
  );
}

/** Texto de varias líneas; crece solo en vertical. */
export function Textarea({
  rows = 4,
  className,
  ...props
}: ComponentProps<'textarea'>) {
  return (
    <textarea
      {...props}
      rows={rows}
      className={cx(CONTROL_CLASSES, 'resize-y', className)}
    />
  );
}

/** Desplegable nativo (teclado y móvil del sistema) con el chevron propio. */
export function Select({
  className,
  children,
  ...props
}: ComponentProps<'select'>) {
  return (
    <div className={cx('relative', className)}>
      <select
        {...props}
        className={cx(CONTROL_CLASSES, 'cursor-pointer appearance-none pr-10')}
      >
        {children}
      </select>
      <Icon
        name="chevron"
        direction="down"
        size="sm"
        className="text-fg-muted pointer-events-none absolute top-1/2 right-3 -translate-y-1/2"
      />
    </div>
  );
}

/**
 * Búsqueda: lupa, nombre accesible propio (no suele llevar etiqueta visible)
 * y la estrella mientras llegan resultados.
 */
export function SearchField({
  label,
  pending = false,
  className,
  ...props
}: Omit<ComponentProps<'input'>, 'type'> & {
  /** Nombre para el lector de pantalla. */
  label: string;
  /** Mientras se buscan resultados. */
  pending?: boolean;
}) {
  return (
    <div className={cx('relative', className)}>
      <Icon
        name="search"
        size="sm"
        className="text-fg-muted pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
      />
      <input
        {...props}
        type="search"
        aria-label={label}
        className={cx(CONTROL_CLASSES, 'pr-10 pl-10')}
      />
      {/* Solo mientras busca: la animación pisa cualquier opacidad. */}
      {pending && (
        <Star className="animate-twinkle text-accent pointer-events-none absolute top-1/2 right-3 size-3.5 -translate-y-1/2" />
      )}
    </div>
  );
}
