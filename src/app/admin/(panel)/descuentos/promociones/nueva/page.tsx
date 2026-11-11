import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/modules/admin';
import { requirePermission } from '@/modules/auth/server';
import { listPromotionBrands } from '@/modules/promotions/server';
import { NEW_PROMOTION, PromotionForm } from '@/modules/promotions/ui';

export const metadata: Metadata = { title: 'Nueva promoción' };

export default async function NewPromotion() {
  const { supabase } = await requirePermission('promotions.manage');
  const brands = await listPromotionBrands(supabase);
  return (
    <main>
      <PageHeader eyebrow="Promociones automáticas" title="Nueva promoción">
        <Link
          href="/admin/descuentos"
          className="border-border hover:border-fg tracking-caps inline-flex min-h-11 items-center border px-5 text-xs font-semibold uppercase"
        >
          Volver a los descuentos
        </Link>
      </PageHeader>
      <PromotionForm values={NEW_PROMOTION} brands={brands} />
    </main>
  );
}
