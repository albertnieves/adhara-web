import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/modules/admin';
import { requirePermission } from '@/modules/auth/server';
import { listMessageTemplates } from '@/modules/messaging/server';
import { TemplateForm } from '@/modules/messaging/ui';
import { Badge, EmptyState, Table } from '@/components/ui';

export const metadata: Metadata = { title: 'Plantillas de respuesta' };

const LOCALES = { es: 'Español', ca: 'Català', en: 'English' } as const;

export default async function MessageTemplates({
  searchParams,
}: {
  searchParams: Promise<{ guardada?: string }>;
}) {
  const staff = await requirePermission('messages.reply');
  const [templates, params] = await Promise.all([
    listMessageTemplates(staff.supabase),
    searchParams,
  ]);
  return (
    <main>
      <PageHeader eyebrow="Mensajes" title="Plantillas de respuesta">
        <Link
          href="/admin/mensajes"
          className="border-border hover:border-fg tracking-caps inline-flex min-h-11 items-center border px-5 text-xs font-semibold uppercase"
        >
          Todos los mensajes
        </Link>
      </PageHeader>
      <p className="text-fg-muted mb-8 max-w-2xl text-sm leading-relaxed">
        Textos para respuestas frecuentes (envíos, devoluciones de perfumes
        precintados, disponibilidad). Al responder, la plantilla rellena el
        texto y se puede cambiar antes de enviar. Cada plantilla es de un
        idioma.
      </p>
      {params.guardada === '1' && (
        <p
          role="status"
          className="border-success/30 text-success bg-surface-raised/50 mb-6 max-w-2xl border-l-2 px-4 py-3 text-sm"
        >
          Plantilla guardada.
        </p>
      )}
      {templates.length === 0 ? (
        <EmptyState
          title="Aún no hay plantillas"
          description="Crea la primera con el formulario de abajo."
        />
      ) : (
        <div className="mb-12 overflow-x-auto">
          <Table caption="Plantillas" className="md:min-w-[40rem]">
            <thead>
              <tr>
                <th>Título</th>
                <th>Idioma</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => (
                <tr key={template.id}>
                  <td data-primary>
                    <Link
                      href={`/admin/mensajes/plantillas/${template.id}`}
                      className="link-underline font-semibold wrap-anywhere"
                    >
                      {template.title}
                    </Link>
                    <p className="text-fg-muted line-clamp-2 max-w-xl text-xs wrap-anywhere">
                      {template.body}
                    </p>
                  </td>
                  <td data-label="Idioma" className="text-sm">
                    {LOCALES[template.locale]}
                  </td>
                  <td data-label="Estado">
                    <Badge tone={template.active ? 'success' : 'neutral'}>
                      {template.active ? 'Activa' : 'Apagada'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
      <section className="border-border border-t py-10">
        <h2 className="mb-6 text-2xl font-light">Nueva plantilla</h2>
        <TemplateForm />
      </section>
    </main>
  );
}
