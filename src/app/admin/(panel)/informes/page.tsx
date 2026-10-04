import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/modules/admin';
import { isAllowed } from '@/modules/auth';
import type { Permission } from '@/modules/auth';
import { requirePermission } from '@/modules/auth/server';
import { cardClass } from '@/components/ui';

export const metadata: Metadata = { title: 'Informes' };

const REPORTS: {
  href: string;
  title: string;
  description: string;
  requires?: Permission;
}[] = [
  {
    href: '/admin/informes/inventario',
    title: 'Existencias y cierre mensual',
    description:
      'Existencias iniciales, entradas, ventas, mermas, ajustes y finales de cada mes, con su valor a coste. CSV para la gestoría.',
  },
  {
    href: '/admin/informes/rotacion',
    title: 'Rotación e inmovilizado',
    description:
      'Qué se vende y qué no: ventas, stock medio, rotación, días de cobertura y días sin vender por perfume.',
  },
  {
    href: '/admin/informes/margenes',
    title: 'Márgenes',
    description:
      'Margen teórico de cada marca y formato (PVP sin IVA frente al coste), los que quedan por debajo del mínimo y los que no tienen coste.',
    requires: 'pricing.view_cost',
  },
  {
    href: '/admin/informes/compras',
    title: 'Compras por proveedor',
    description:
      'Pedidos, unidades y valor recibido, y el plazo real frente al declarado para ajustar el vigilante de Reposición.',
    requires: 'purchasing.manage',
  },
  {
    href: '/admin/informes/auditoria',
    title: 'Auditoría',
    description:
      'Quién hizo qué y cuándo: accesos, catálogo, precios, inventario, compras, equipo y configuración.',
    requires: 'staff.manage',
  },
];

export default async function Reports() {
  const staff = await requirePermission('reports.view');
  const visible = REPORTS.filter(
    (r) =>
      !r.requires || isAllowed({ role: staff.role, aal: 'aal2' }, r.requires),
  );
  return (
    <main>
      <PageHeader eyebrow="Panel" title="Informes" />
      <p className="text-fg-muted mb-10 max-w-3xl text-sm leading-relaxed">
        Solo lectura, calculados con los movimientos, costes y compras
        registrados. Las ventas se cuentan en unidades: el mostrador no guarda
        importes. Los valores a coste son netos, sin IVA, y solo los ve quien
        tiene permiso de costes.
      </p>
      <ul className="grid gap-4 md:grid-cols-2">
        {visible.map((report) => (
          <li key={report.href}>
            <Link
              href={report.href}
              className={cardClass({
                interactive: true,
                className: 'block h-full',
              })}
            >
              <h2 className="text-2xl font-light">{report.title}</h2>
              <p className="text-fg-muted mt-3 text-sm leading-relaxed">
                {report.description}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
