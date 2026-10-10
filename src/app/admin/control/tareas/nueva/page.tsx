import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/modules/admin';
import { requirePermission } from '@/modules/auth/server';
import { CONTROL_AREAS, isOneOf } from '@/modules/control';
import { TaskForm } from '@/modules/control/ui';
import { buttonClass, Card } from '@/components/ui';

export const metadata: Metadata = { title: 'Nueva tarea' };

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string }>;
}) {
  await requirePermission('business.control');
  const { area } = await searchParams;
  return (
    <main className="max-w-4xl">
      <PageHeader eyebrow="Tareas" title="Nueva tarea">
        <Link
          href="/admin/control/tareas"
          className={buttonClass('outline', 'md')}
        >
          Todas las tareas
        </Link>
      </PageHeader>
      <Card as="section">
        <TaskForm
          defaultArea={isOneOf(CONTROL_AREAS, area) ? area : 'project'}
        />
      </Card>
    </main>
  );
}
