import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/modules/admin';
import { requirePermission } from '@/modules/auth/server';
import { listVariantWeights } from '@/modules/shipping/server';
import { VariantWeightsForm } from '@/modules/shipping/ui';

export const metadata: Metadata = { title: 'Pesos de envío' };

/**
 * Peso de envío de cada formato (DECISIONS §172): lo pesa la tienda (frasco
 * con su caja). El envío se cobra por peso y un formato sin peso no se puede
 * enviar, así que no hay valores por defecto.
 */
export default async function VariantWeightsPage() {
  const { supabase } = await requirePermission('catalog.edit');
  const rows = await listVariantWeights(supabase);
  return (
    <main>
      <PageHeader eyebrow="Catálogo" title="Pesos de envío">
        <Link
          href="/admin/catalogo"
          className="border-border hover:border-fg tracking-caps inline-flex min-h-11 items-center border px-5 text-xs font-semibold uppercase"
        >
          Catálogo
        </Link>
      </PageHeader>
      <p className="text-fg-muted mb-8 max-w-3xl text-sm leading-relaxed">
        Gramos de una unidad lista para enviar: el frasco con su caja. El
        embalaje del paquete se suma aparte (Configuración → Envíos). Mientras
        un formato no tenga peso, una cesta con él solo se puede recoger en la
        tienda.
      </p>
      <VariantWeightsForm
        rows={rows.map((r) => ({
          variantId: r.variantId,
          name: `${r.brandName} · ${r.productName}`,
          size: r.label ?? (r.sizeMl ? `${r.sizeMl} ml` : '—'),
          sizeMl: r.sizeMl,
          sku: r.sku,
          published: r.productStatus === 'published',
          weightG: r.weightG,
        }))}
      />
    </main>
  );
}
