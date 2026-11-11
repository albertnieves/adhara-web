'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

/** Recuento de una rejilla: al cambiar el número, el texto nuevo sube y se funde. */
export function CountLabel({
  value,
  children,
}: {
  /** El número: cambia la clave y dispara la entrada. */
  value: number;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.span
      key={value}
      className="inline-block"
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.span>
  );
}
