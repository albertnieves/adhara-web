import type { Metadata } from 'next';
import { requirePermission } from '@/modules/auth/server';
import { listVariantWeights } from '@/modules/shipping/server';
import { VariantWeightsForm } from '@/modules/shipping/ui';

export const metadata: Metadata = { title: 'Pesos de envío' };

/**
 * Envíos → Pesos de los formatos (DECISIONS §172, §177): lo pesa la tienda
 * (frasco con su caja). El envío se cobra por peso y un formato sin peso no
 * se puede enviar, así que no hay valores por defecto.
 */
export default async function VariantWeightsPage() {
  const { supabase } = await requirePermission('catalog.edit');
  const rows = await listVariantWeights(supabase);
  return (
    <div>
      <p className="text-fg-muted mb-8 max-w-3xl text-sm leading-relaxed">
        Gramos de una unidad lista para enviar: el frasco con su caja. El
        embalaje del paquete se suma aparte (en «Remitente y zonas»). Mientras
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
    </div>
  );
}
