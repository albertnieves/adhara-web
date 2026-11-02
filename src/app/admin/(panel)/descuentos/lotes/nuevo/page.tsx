import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, buttonClass } from '@/components/ui';
import { PageHeader } from '@/modules/admin';
import { isAllowed } from '@/modules/auth';
import { requirePermission } from '@/modules/auth/server';
import { listSubscribers } from '@/modules/newsletter/server';
import { DiscountBatchForm } from '@/modules/promotions/ui';

export const metadata: Metadata = { title: 'Nuevo lote de códigos únicos' };

/** Alta de un lote de códigos únicos (DECISIONS §185). */
export default async function NewDiscountBatch() {
  const staff = await requirePermission('promotions.manage');
  const people = isAllowed({ role: staff.role, aal: 'aal2' }, 'customers.view');
  const subscribers = people
    ? (await listSubscribers(staff.supabase)).filter(
        (subscriber) => !subscriber.unsubscribedAt,
      ).length
    : null;
  return (
    <main>
      <PageHeader
        eyebrow="Códigos de descuento"
        title="Nuevo lote de códigos únicos"
      >
        <Link href="/admin/descuentos" className={buttonClass('outline')}>
          Volver a los códigos
        </Link>
      </PageHeader>
      <Card className="mb-10">
        <div className="max-w-3xl space-y-3 text-sm leading-relaxed">
          <p>
            Cada código del lote vale para un solo pedido y tiene las mismas
            condiciones. A diferencia de un código de campaña, no se puede
            compartir: el primero que lo usa lo gasta.
          </p>
          <p className="text-fg-muted">
            Con «uno para cada suscriptor», el lote se descarga en CSV con el
            email y el código de cada uno para importarlo en Sender y ponerlo en
            el correo. Quien se suscriba después no tiene código: haz otro lote
            más adelante.
          </p>
        </div>
      </Card>
      <DiscountBatchForm subscribers={subscribers} />
    </main>
  );
}
