import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { PageHeader } from '@/modules/admin';
import { requirePermission } from '@/modules/auth/server';
import { listMessageTemplates } from '@/modules/messaging/server';
import { TemplateForm } from '@/modules/messaging/ui';

export const metadata: Metadata = { title: 'Plantilla de respuesta' };

export default async function MessageTemplate({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const staff = await requirePermission('messages.reply');
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const template = (await listMessageTemplates(staff.supabase)).find(
    (t) => t.id === id,
  );
  if (!template) notFound();
  return (
    <main>
      <PageHeader eyebrow="Plantilla de respuesta" title={template.title}>
        <Link
          href="/admin/mensajes/plantillas"
          className="border-border hover:border-fg tracking-caps inline-flex min-h-11 items-center border px-5 text-xs font-semibold uppercase"
        >
          Todas las plantillas
        </Link>
      </PageHeader>
      <TemplateForm template={template} />
    </main>
  );
}
