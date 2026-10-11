import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireControl } from '@/modules/control/server';
import { listDeliveries } from '@/modules/control/server';
import {
  ConsoleHeader,
  DeleteControlItem,
  DeliveryForm,
} from '@/modules/control/ui';
import { buttonClass, Card } from '@/components/ui';

export const metadata: Metadata = { title: 'Entrega' };

export default async function DeliveryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { supabase } = await requireControl();
  const { id } = await params;
  const delivery = (await listDeliveries(supabase)).find((d) => d.id === id);
  if (!delivery) notFound();
  return (
    <main className="max-w-4xl">
      <ConsoleHeader section="Entregas" title={delivery.title}>
        <Link
          href="/admin/control/entregas"
          className={buttonClass('outline', 'md')}
        >
          Todas las entregas
        </Link>
      </ConsoleHeader>
      <Card as="section">
        <DeliveryForm delivery={delivery} />
      </Card>
      <section className="border-border mt-14 border-t pt-8">
        <h2 className="mb-3 text-lg font-semibold">Borrar</h2>
        <DeleteControlItem
          kind="delivery"
          id={delivery.id}
          name={delivery.title}
        />
      </section>
    </main>
  );
}
