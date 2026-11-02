import type { Metadata } from 'next';
import { PageHeader } from '@/modules/admin';
import { requirePermission } from '@/modules/auth/server';
import { listCustomers } from '@/modules/customers/server';
import { CustomerList } from '@/modules/customers/ui';

export const metadata: Metadata = { title: 'Clientes' };

/**
 * Clientes (A7, DECISIONS §184): quien ha comprado en la web, ha escrito, se
 * ha unido al Club o tiene cuenta, uno por email. Solo con customers.view.
 */
export default async function Customers() {
  const { supabase } = await requirePermission('customers.view');
  const { customers, total } = await listCustomers(supabase, {
    search: '',
    page: 1,
  });
  return (
    <main>
      <PageHeader eyebrow="Web" title="Clientes" />
      <p className="text-fg-muted mb-8 max-w-2xl text-sm leading-relaxed">
        Una ficha por email con sus pedidos web, sus mensajes, el Club L’Atelier
        y su cuenta, si la tiene. Las ventas del mostrador no llevan cliente.
        Quien solo escribió spam no aparece.
      </p>
      <CustomerList initial={{ search: '', page: 1, customers, total }} />
    </main>
  );
}
