import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { PageHeader } from '@/modules/admin';
import { requirePermission } from '@/modules/auth/server';
import { listBrands } from '@/modules/catalog/server/admin';
import { listVariantDirectory } from '@/modules/inventory/server';
import { listSupplierTerms, listSuppliers } from '@/modules/purchasing/server';
import { SupplierForm, SupplierTerms } from '@/modules/purchasing/ui';

export const metadata: Metadata = { title: 'Proveedor' };

export default async function SupplierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { supabase } = await requirePermission('purchasing.manage');
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [suppliers, terms, directory, brands] = await Promise.all([
    listSuppliers(supabase),
    listSupplierTerms(supabase, { supplierId: id }),
    listVariantDirectory(supabase),
    listBrands(supabase),
  ]);
  const supplier = suppliers.find((s) => s.id === id);
  if (!supplier) notFound();

  return (
    <main>
      <PageHeader eyebrow="Proveedor" title={supplier.name}>
        <Link
          href="/admin/compras/proveedores"
          className="border-line hover:border-ink tracking-caps inline-flex min-h-11 items-center border px-5 text-xs font-semibold uppercase"
        >
          Todos los proveedores
        </Link>
      </PageHeader>

      <section className="panel-card mb-12">
        <SupplierForm supplier={supplier} />
      </section>

      <section>
        <h2 className="mb-2 text-2xl font-light">Formatos que suministra</h2>
        <p className="text-smoke mb-6 max-w-3xl text-sm">
          Referencia del proveedor, múltiplo de compra (cajas de 6, de 12…) y
          plazo si difiere del habitual. El proveedor preferente es el que usan
          las propuestas de Reposición.
        </p>
        <SupplierTerms
          supplierId={supplier.id}
          terms={terms}
          variants={directory.map((row) => ({
            variantId: row.variantId,
            productId: row.productId,
            productName: row.productName,
            brandName: row.brandName,
            variantLabel: row.variantLabel,
            sku: row.sku,
            ean: row.ean,
          }))}
          brands={brands.map((b) => ({ id: b.id, name: b.name }))}
        />
      </section>
    </main>
  );
}
