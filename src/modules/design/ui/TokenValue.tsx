'use client';

import { useCallback, useState } from 'react';

/**
 * Valor de una variable CSS tal como la calcula el navegador donde se monta,
 * con el tono (data-tone) que la rodea. Lleva aria-busy hasta leerlo.
 */
export function TokenValue({ variable }: { variable: string }) {
  const [value, setValue] = useState<string | null>(null);
  const ref = useCallback(
    (el: HTMLElement | null) => {
      if (el) setValue(getComputedStyle(el).getPropertyValue(variable).trim());
    },
    [variable],
  );
  return (
    <code
      ref={ref}
      aria-busy={value === null ? true : undefined}
      className="text-xs wrap-anywhere"
    >
      {value === null ? '…' : value || 'sin valor'}
    </code>
  );
}
