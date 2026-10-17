import type { ReactNode } from 'react';
import type { BadgeTone } from '@/components/ui';
import { Eyebrow, Heading } from '@/components/ui';
import type { CustomerOrderStatus } from '../domain/status';

/**
 * Marco de las páginas de la cuenta: antetítulo, título y, si se pide, una
 * columna estrecha para los formularios de acceso.
 */
export function AccountShell({
  eyebrow,
  title,
  lead,
  narrow = false,
  nav,
  children,
}: {
  eyebrow: string;
  title: string;
  lead?: ReactNode;
  narrow?: boolean;
  nav?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto max-w-[90rem] px-5 pt-32 pb-20 sm:px-10">
      <div className={narrow ? 'max-w-md space-y-8' : 'max-w-3xl space-y-8'}>
        {nav}
        <header className="space-y-4">
          <Eyebrow>{eyebrow}</Eyebrow>
          <Heading level={1} size="h1">
            {title}
          </Heading>
          {lead && <p className="text-fg-muted leading-relaxed">{lead}</p>}
        </header>
        {children}
      </div>
    </main>
  );
}

/** El color acompaña al estado, nunca lo sustituye (Badge). */
export const STATUS_TONE: Record<CustomerOrderStatus, BadgeTone> = {
  awaitingPayment: 'warning',
  preparing: 'accent',
  readyForPickup: 'accent',
  shipped: 'accent',
  completed: 'success',
  cancelled: 'neutral',
  refunded: 'neutral',
  partiallyRefunded: 'neutral',
  review: 'warning',
};
