import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/modules/admin';
import { requirePermission } from '@/modules/auth/server';
import { DiscountCodeForm, NEW_DISCOUNT_CODE } from '@/modules/promotions/ui';

export const metadata: Metadata = { title: 'Nuevo código de descuento' };

export default async function NewDiscountCode() {
  await requirePermission('promotions.manage');
  return (
    <main>
      <PageHeader eyebrow="Códigos de descuento" title="Nuevo código">
        <Link
          href="/admin/descuentos"
          className="border-border hover:border-fg tracking-caps inline-flex min-h-11 items-center border px-5 text-xs font-semibold uppercase"
        >
          Volver a los códigos
        </Link>
      </PageHeader>
      <DiscountCodeForm values={NEW_DISCOUNT_CODE} />
    </main>
  );
}
