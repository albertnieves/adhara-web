'use client';

import { buttonClass } from '@/components/ui';

export function PrintButton({
  children = 'Imprimir',
  disabled = false,
}: {
  children?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => window.print()}
      className={buttonClass('primary')}
    >
      {children}
    </button>
  );
}
