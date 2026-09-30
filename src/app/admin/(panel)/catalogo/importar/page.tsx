import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/modules/admin';
import { isAllowed } from '@/modules/auth';
import { requirePermission } from '@/modules/auth/server';
import { CatalogImport } from '@/modules/catalog/ui';

export const metadata: Metadata = { title: 'Importar catálogo' };

export default async function ImportCatalogPage() {
  const staff = await requirePermission('catalog.edit');
  return (
    <main>
      <Link
        href="/admin/catalogo"
        className="link-underline text-smoke text-xs tracking-[0.16em] uppercase"
      >
        ← Catálogo
      </Link>
      <div className="mt-6">
        <PageHeader eyebrow="Catálogo" title="Importar catálogo" />
      </div>
      <p className="text-smoke -mt-4 mb-10 max-w-3xl text-sm leading-relaxed">
        Para cargar perfumes, formatos y PVP desde un catálogo (por ejemplo, el
        PDF del proveedor pasado a CSV). Primero se revisa fila a fila y no se
        aplica nada hasta que confirmas. Se reconocen las marcas, perfumes y
        formatos que ya existen; un PVP distinto del actual nunca se sobrescribe
        (se cambia desde la ficha, con la revisión Ómnibus).
      </p>
      <CatalogImport
        canSetPrices={isAllowed(
          { role: staff.role, aal: 'aal2' },
          'pricing.edit_retail',
        )}
      />
    </main>
  );
}
