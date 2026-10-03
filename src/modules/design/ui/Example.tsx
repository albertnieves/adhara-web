import type { ReactNode } from 'react';
import { Text } from '@/components/ui';

/** Una fila de la demostración: muestra, uso y cómo se escribe. */
export function Example({
  code,
  use,
  children,
}: {
  code: string;
  use: string;
  children: ReactNode;
}) {
  return (
    <li className="grid gap-3 py-5 md:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] md:items-center md:gap-8">
      <div className="min-w-0">{children}</div>
      <div className="flex flex-col gap-1">
        <code className="text-xs wrap-anywhere">{code}</code>
        <Text size="caption" tone="muted">
          {use}
        </Text>
      </div>
    </li>
  );
}
