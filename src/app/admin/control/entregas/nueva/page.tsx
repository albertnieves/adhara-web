import type { Metadata } from 'next';
import Link from 'next/link';
import { requireControl } from '@/modules/control/server';
import { ConsoleHeader, DeliveryForm } from '@/modules/control/ui';
import { buttonClass, Card } from '@/components/ui';

export const metadata: Metadata = { title: 'Nueva entrega' };

export default async function NewDeliveryPage() {
  await requireControl();
  return (
    <main className="max-w-4xl">
      <ConsoleHeader section="Entregas" title="Nueva entrega">
        <Link
          href="/admin/control/entregas"
          className={buttonClass('outline', 'md')}
        >
          Todas las entregas
        </Link>
      </ConsoleHeader>
      <Card as="section">
        <DeliveryForm />
      </Card>
    </main>
  );
}
