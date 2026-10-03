import type { ComponentProps, ReactNode } from 'react';
import { cx } from './cx';

/**
 * Tabla de datos (Fase 2, DS-09) con los estilos de `.data-table`. Con
 * `stacked`, en el móvil cada fila pasa a ficha: la celda `primary` encabeza
 * y las demás muestran su `label`, sin desplazamiento horizontal. La leyenda
 * nombra la tabla para el lector de pantalla.
 */
export function Table({
  caption,
  stacked = true,
  className,
  children,
}: {
  caption: string;
  stacked?: boolean;
  /** Solo colocación. */
  className?: string;
  children: ReactNode;
}) {
  return (
    <table className={cx('data-table', stacked && 'stack-table', className)}>
      <caption className="sr-only">{caption}</caption>
      {children}
    </table>
  );
}

/** Cabecera de columna; las cifras se alinean a la derecha. */
export function Th({
  numeric = false,
  className,
  children,
  ...props
}: ComponentProps<'th'> & { numeric?: boolean }) {
  return (
    <th
      scope="col"
      {...props}
      className={cx(numeric && 'text-right', className)}
    >
      {children}
    </th>
  );
}

/** Celda: `label` para la ficha del móvil, `primary` para la que encabeza. */
export function Td({
  label,
  primary = false,
  numeric = false,
  className,
  children,
  ...props
}: ComponentProps<'td'> & {
  label?: string;
  primary?: boolean;
  numeric?: boolean;
}) {
  return (
    <td
      {...props}
      data-label={label}
      data-primary={primary || undefined}
      className={cx(
        numeric && 'text-right lining-nums tabular-nums',
        className,
      )}
    >
      {children}
    </td>
  );
}
