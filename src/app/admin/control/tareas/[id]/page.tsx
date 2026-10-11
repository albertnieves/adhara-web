import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireControl } from '@/modules/control/server';
import { listTasks } from '@/modules/control/server';
import {
  ConsoleHeader,
  DeleteControlItem,
  TaskForm,
} from '@/modules/control/ui';
import { buttonClass, Card } from '@/components/ui';

export const metadata: Metadata = { title: 'Tarea' };

export default async function TaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { supabase } = await requireControl();
  const { id } = await params;
  const task = (await listTasks(supabase)).find((t) => t.id === id);
  if (!task) notFound();
  return (
    <main className="max-w-4xl">
      <ConsoleHeader section="Tareas" title={task.title}>
        <Link
          href="/admin/control/tareas"
          className={buttonClass('outline', 'md')}
        >
          Todas las tareas
        </Link>
      </ConsoleHeader>
      <Card as="section">
        <TaskForm task={task} />
      </Card>
      <section className="border-border mt-14 border-t pt-8">
        <h2 className="mb-3 text-lg font-semibold">Borrar</h2>
        <DeleteControlItem kind="task" id={task.id} name={task.title} />
      </section>
    </main>
  );
}
