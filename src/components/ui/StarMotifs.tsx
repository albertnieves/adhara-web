import type { ReactNode } from 'react';
import { Star } from '@/modules/brand';
import { cx } from './cx';

/*
 * La estrella de cuatro puntas del emblema como motivo: viñeta, separador y
 * cargador. Siempre en dorado de acento y siempre decorativa (aria-hidden);
 * el significado lo lleva el texto o el rol.
 */

/** Lista con la estrella como viñeta. */
export function StarList({
  items,
  className,
}: {
  items: ReactNode[];
  /** Solo colocación. */
  className?: string;
}) {
  return (
    <ul className={cx('flex flex-col gap-3', className)}>
      {items.map((item, i) => (
        <li key={i} className="flex items-baseline gap-3">
          <Star className="text-accent size-2.5 shrink-0 translate-y-px" />
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** Separador entre bloques: línea, estrella y línea. */
export function StarDivider({ className }: { className?: string }) {
  return (
    <div
      role="separator"
      className={cx('text-accent flex items-center gap-4', className)}
    >
      <span className="bg-border h-px flex-1" />
      <Star className="size-3 shrink-0" />
      <span className="bg-border h-px flex-1" />
    </div>
  );
}

/**
 * Cargador: la estrella titila mientras llega el contenido. Con «reducir
 * movimiento» queda quieta. El texto es para lectores de pantalla.
 */
export function StarLoader({
  label = 'Cargando',
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span
      role="status"
      className={cx('text-accent inline-flex items-center', className)}
    >
      <Star className="animate-twinkle size-5" />
      <span className="sr-only">{label}</span>
    </span>
  );
}
