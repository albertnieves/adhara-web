import type { ReactNode } from 'react';
import { Star } from '@/modules/brand';
import { cx } from './cx';

/**
 * Tarjeta (Fase 2, DS-09; sustituye a `.panel-card`): superficie elevada
 * con borde fino. `interactive` marca el borde al pasar el ratón cuando toda
 * la tarjeta es un enlace.
 */
export function Card({
  as: Tag = 'div',
  padding = 'md',
  interactive = false,
  className,
  children,
}: {
  as?: 'div' | 'article' | 'section' | 'li';
  padding?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  /** Solo colocación. */
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tag
      className={cx(
        'border-border bg-surface-raised text-fg border',
        { sm: 'p-4', md: 'p-6', lg: 'p-8' }[padding],
        interactive &&
          'hover:border-fg ease-luxe transition-colors duration-(--duration-fast)',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/**
 * Estado vacío: la estrella, qué pasa y, si la hay, la acción siguiente.
 * Dice la verdad: «no hay» o «todavía no», nunca datos de relleno.
 */
export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        'border-border-strong flex flex-col items-center gap-3 border border-dashed px-6 py-12 text-center',
        className,
      )}
    >
      <Star className="text-accent size-4" />
      <p className="font-display text-2xl font-light">{title}</p>
      {description && (
        <p className="text-fg-muted max-w-sm text-sm">{description}</p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/**
 * Hueco de carga: la forma de lo que va a llegar, sin saltos al cargar.
 * Es decorativo (aria-hidden); quien lo usa anuncia la carga una sola vez,
 * por ejemplo con `role="status"` y `aria-busy` en el contenedor. Con
 * «reducir movimiento» deja de latir.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx('bg-surface-sunken block h-4 animate-pulse', className)}
    />
  );
}
