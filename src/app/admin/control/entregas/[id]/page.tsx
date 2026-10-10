import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/modules/admin';
import { requirePermission } from '@/modules/auth/server';
import { listDeliveries } from '@/modules/control/server';
import { DeleteControlItem, DeliveryForm } from '@/modules/control/ui';
import { buttonClass, Card } from '@/components/ui';

export const metadata: Metadata = { title: 'Entrega' };

export default async function DeliveryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { supabase } = await requirePermission('business.control');
  const { id } = await params;
  const delivery = (await listDeliveries(supabase)).find((d) => d.id === id);
  if (!delivery) notFound();
  return (
    <main className="max-w-4xl">
      <PageHeader eyebrow="Entregas" title={delivery.title}>
        <Link
          href="/admin/control/entregas"
          className={buttonClass('outline', 'md')}
        >
          Todas las entregas
        </Link>
      </PageHeader>
      <Card as="section">
        <DeliveryForm delivery={delivery} />
      </Card>
      <section className="border-border mt-14 border-t pt-8">
        <h2 className="mb-4 text-xl font-light">Borrar</h2>
        <DeleteControlItem
          kind="delivery"
          id={delivery.id}
          name={delivery.title}
        />
      </section>
    </main>
  );
}
