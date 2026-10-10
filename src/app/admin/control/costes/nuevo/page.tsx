import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/modules/admin';
import { requirePermission } from '@/modules/auth/server';
import { isOneOf, CONTROL_AREAS, madridToday } from '@/modules/control';
import { CostForm } from '@/modules/control/ui';
import { buttonClass, Card } from '@/components/ui';

export const metadata: Metadata = { title: 'Nuevo coste' };

export default async function NewCostPage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string }>;
}) {
  await requirePermission('business.control');
  const { area } = await searchParams;
  return (
    <main className="max-w-4xl">
      <PageHeader eyebrow="Costes" title="Nuevo coste">
        <Link
          href="/admin/control/costes"
          className={buttonClass('outline', 'md')}
        >
          Todos los costes
        </Link>
      </PageHeader>
      <Card as="section">
        <CostForm
          today={madridToday()}
          defaultArea={isOneOf(CONTROL_AREAS, area) ? area : 'business'}
        />
      </Card>
    </main>
  );
}
