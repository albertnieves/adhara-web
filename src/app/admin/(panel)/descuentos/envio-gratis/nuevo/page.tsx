import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/modules/admin';
import { requirePermission } from '@/modules/auth/server';
import {
  NEW_SHIPPING_PROMOTION,
  ShippingPromotionForm,
} from '@/modules/promotions/ui';

export const metadata: Metadata = { title: 'Nuevo envío gratis' };

export default async function NewShippingPromotion() {
  await requirePermission('promotions.manage');
  return (
    <main>
      <PageHeader eyebrow="Envío gratis temporal" title="Nuevo envío gratis">
        <Link
          href="/admin/descuentos"
          className="border-border hover:border-fg tracking-caps inline-flex min-h-11 items-center border px-5 text-xs font-semibold uppercase"
        >
          Volver a los descuentos
        </Link>
      </PageHeader>
      <ShippingPromotionForm values={NEW_SHIPPING_PROMOTION} />
    </main>
  );
}
