import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/modules/admin';
import { requirePermission } from '@/modules/auth/server';
import { createProduct } from '@/modules/catalog/server/actions';
import { listBrands } from '@/modules/catalog/server/admin';
import { ProductForm } from '@/modules/catalog/ui';

export const metadata: Metadata = { title: 'Nuevo perfume' };

export default async function NewProduct() {
  const { supabase } = await requirePermission('catalog.edit');
  const brands = await listBrands(supabase);
  return (
    <main className="max-w-3xl">
      <Link
        href="/admin/catalogo"
        className="link-underline text-smoke text-xs tracking-[0.16em] uppercase"
      >
        ← Catálogo
      </Link>
      <div className="mt-6">
        <PageHeader eyebrow="Catálogo" title="Nuevo perfume" />
      </div>
      <p className="text-smoke mb-8 text-sm leading-relaxed">
        Se crea como borrador. Después podrás añadir formatos, PVP, imágenes y
        textos, y publicarlo cuando esté completo.
      </p>
      <ProductForm
        action={createProduct}
        brands={brands}
        submitLabel="Crear borrador"
        values={{
          name: '',
          brandId: '',
          concentration: null,
          audience: null,
          unboxingScene: null,
          sourceRef: null,
          featured: false,
          position: 0,
        }}
      />
    </main>
  );
}
