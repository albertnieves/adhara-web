import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/modules/admin';
import { requirePermission } from '@/modules/auth/server';
import { DeliveryForm } from '@/modules/control/ui';
import { buttonClass, Card } from '@/components/ui';

export const metadata: Metadata = { title: 'Nueva entrega' };

export default async function NewDeliveryPage() {
  await requirePermission('business.control');
  return (
    <main className="max-w-4xl">
      <PageHeader eyebrow="Entregas" title="Nueva entrega">
        <Link
          href="/admin/control/entregas"
          className={buttonClass('outline', 'md')}
        >
          Todas las entregas
        </Link>
      </PageHeader>
      <Card as="section">
        <DeliveryForm />
      </Card>
    </main>
  );
}
