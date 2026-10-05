import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/modules/admin';
import { requirePermission } from '@/modules/auth/server';
import { listSuppliers } from '@/modules/purchasing/server';
import { SupplierForm } from '@/modules/purchasing/ui';
import { Card, Eyebrow, Table } from '@/components/ui';

export const metadata: Metadata = { title: 'Proveedores' };

export default async function Suppliers() {
  const { supabase } = await requirePermission('purchasing.manage');
  const suppliers = await listSuppliers(supabase);

  return (
    <main>
      <PageHeader eyebrow="Compras" title="Proveedores">
        <Link
          href="/admin/compras"
          className="border-border hover:border-fg tracking-caps inline-flex min-h-11 items-center border px-5 text-xs font-semibold uppercase"
        >
          Pedidos
        </Link>
      </PageHeader>
      <p className="text-fg-muted mb-10 max-w-3xl text-sm leading-relaxed">
        Datos internos: no salen de la base de datos salvo para quien gestiona
        compras con verificación en dos pasos. El plazo y el múltiplo de compra
        permiten al vigilante de Reposición proponer cantidades.
      </p>

      {suppliers.length === 0 ? (
        <p className="text-fg-muted mb-10">Aún no hay proveedores.</p>
      ) : (
        <div className="mb-12 overflow-x-auto">
          <Table
            caption="Proveedores"
            stacked={false}
            className="min-w-[40rem]"
          >
            <thead>
              <tr>
                <th>Proveedor</th>
                <th>Contacto</th>
                <th className="text-right">Plazo</th>
                <th className="text-right">Formatos</th>
                <th className="text-right">Pedidos abiertos</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id} className={s.active ? '' : 'text-fg-muted'}>
                  <td>
                    <Link
                      href={`/admin/compras/proveedores/${s.id}`}
                      className="link-underline font-semibold"
                    >
                      {s.name}
                    </Link>
                    {!s.active && <p className="text-xs">inactivo</p>}
                  </td>
                  <td className="text-fg-muted text-sm">
                    {[s.contactName, s.email, s.phone]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </td>
                  <td className="text-right tabular-nums">
                    {s.leadTimeDays !== null ? `${s.leadTimeDays} d` : '—'}
                  </td>
                  <td className="text-right tabular-nums">{s.variantCount}</td>
                  <td className="text-right tabular-nums">{s.openOrders}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      <Card as="section">
        <Eyebrow className="mb-4">Nuevo proveedor</Eyebrow>
        <SupplierForm />
      </Card>
    </main>
  );
}
