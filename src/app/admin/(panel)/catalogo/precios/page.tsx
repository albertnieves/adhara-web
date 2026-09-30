import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/modules/admin';
import { requirePermission } from '@/modules/auth/server';
import { listBrands } from '@/modules/catalog/server/admin';
import { BulkPricing } from '@/modules/catalog/ui';

export const metadata: Metadata = { title: 'Cambiar precios' };

export default async function BulkPricingPage() {
  const staff = await requirePermission('pricing.edit_retail');
  const brands = await listBrands(staff.supabase);
  return (
    <main>
      <Link
        href="/admin/catalogo"
        className="link-underline text-smoke text-xs tracking-[0.16em] uppercase"
      >
        ← Catálogo
      </Link>
      <div className="mt-6">
        <PageHeader eyebrow="Precios" title="Cambiar precios" />
      </div>
      <p className="text-smoke -mt-4 mb-10 max-w-3xl text-sm leading-relaxed">
        Sube o baja el PVP de una marca o de todo el catálogo. Primero se
        calcula y revisa cada formato con las mismas reglas que un cambio
        individual; no se aplica nada hasta que lo confirmas.
      </p>
      <BulkPricing brands={brands} />
    </main>
  );
}
