'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

/**
 * Filtro de las rejillas de perfumes: un botón con `aria-pressed`. El fondo
 * del activo es una pastilla que se desliza de un filtro a otro dentro de su
 * grupo (`group`); con «reducir movimiento» cambia sin deslizarse. Mismo
 * tamaño que el botón `sm` (36 px).
 */
export function FilterChip({
  active,
  onClick,
  group,
  children,
}: {
  active: boolean;
  onClick: () => void;
  /** Nombre del grupo: la pastilla solo viaja entre los filtros que lo comparten. */
  group: string;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`ease-luxe text-2xs tracking-caps-sm relative inline-flex min-h-9 items-center justify-center border px-3 text-center font-sans font-semibold uppercase transition-colors duration-(--duration-base) ${
        active
          ? 'border-fg text-fg-inverse'
          : 'border-border-strong text-fg hover:border-fg hover:bg-surface-raised'
      }`}
    >
      {active &&
        (reduced ? (
          <span aria-hidden className="bg-fg absolute inset-0" />
        ) : (
          <motion.span
            aria-hidden
            layoutId={`filter-${group}`}
            className="bg-fg absolute inset-0"
            transition={{ type: 'spring', stiffness: 420, damping: 38 }}
          />
        ))}
      <span className="relative inline-flex items-center gap-2">
        {children}
      </span>
    </button>
  );
}
