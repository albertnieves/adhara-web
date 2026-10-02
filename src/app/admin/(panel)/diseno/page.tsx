import type { Metadata } from 'next';
import { PageHeader } from '@/modules/admin';
import { requireStaff } from '@/modules/auth/server';
import { DesignReference } from '@/modules/design';

export const metadata: Metadata = { title: 'Sistema de diseño' };

/** Referencia del sistema de diseño: todo el personal con sesión (D6). */
export default async function DesignReferencePage() {
  await requireStaff();
  return (
    <main>
      <PageHeader eyebrow="Referencia" title="Sistema de diseño" />
      <DesignReference />
    </main>
  );
}
