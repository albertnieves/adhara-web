import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/modules/admin';
import { requirePermission } from '@/modules/auth/server';
import { madridToday } from '@/modules/control';
import { listCosts } from '@/modules/control/server';
import { CostForm, DeleteControlItem } from '@/modules/control/ui';
import { buttonClass, Card } from '@/components/ui';

export const metadata: Metadata = { title: 'Coste' };

export default async function CostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { supabase } = await requirePermission('business.control');
  const { id } = await params;
  const cost = (await listCosts(supabase)).find((c) => c.id === id);
  if (!cost) notFound();
  return (
    <main className="max-w-4xl">
      <PageHeader eyebrow="Costes" title={cost.concept}>
        <Link
          href="/admin/control/costes"
          className={buttonClass('outline', 'md')}
        >
          Todos los costes
        </Link>
      </PageHeader>
      <Card as="section">
        <CostForm cost={cost} today={madridToday()} />
      </Card>
      <section className="border-border mt-14 border-t pt-8">
        <h2 className="mb-2 text-xl font-light">Borrar</h2>
        <p className="text-fg-muted mb-4 text-sm">
          Si el coste ya no se paga, mejor ponle fecha de fin: así sigue
          contando en los meses en que se pagó.
        </p>
        <DeleteControlItem kind="cost" id={cost.id} name={cost.concept} />
      </section>
    </main>
  );
}
