import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireControl } from '@/modules/control/server';
import { madridToday } from '@/modules/control';
import { listCosts } from '@/modules/control/server';
import {
  ConsoleHeader,
  CostForm,
  DeleteControlItem,
} from '@/modules/control/ui';
import { buttonClass, Card } from '@/components/ui';

export const metadata: Metadata = { title: 'Coste' };

export default async function CostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { supabase } = await requireControl();
  const { id } = await params;
  const cost = (await listCosts(supabase)).find((c) => c.id === id);
  if (!cost) notFound();
  return (
    <main className="max-w-4xl">
      <ConsoleHeader section="Costes" title={cost.concept}>
        <Link
          href="/admin/control/costes"
          className={buttonClass('outline', 'md')}
        >
          Todos los costes
        </Link>
      </ConsoleHeader>
      <Card as="section">
        <CostForm cost={cost} today={madridToday()} />
      </Card>
      <section className="border-border mt-14 border-t pt-8">
        <h2 className="mb-2 text-lg font-semibold">Borrar</h2>
        <p className="text-fg-muted mb-4 text-sm">
          Si el coste ya no se paga, mejor ponle fecha de fin: así sigue
          contando en los meses en que se pagó.
        </p>
        <DeleteControlItem kind="cost" id={cost.id} name={cost.concept} />
      </section>
    </main>
  );
}
