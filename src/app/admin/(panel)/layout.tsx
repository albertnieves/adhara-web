import Link from 'next/link';
import type { ReactNode } from 'react';
import { PanelNav } from '@/modules/admin/ui/PanelNav';
import type { NavItem } from '@/modules/admin/ui/PanelNav';
import { Toaster } from '@/modules/admin/ui/Toaster';
import { ROLE_LABELS, isAllowed } from '@/modules/auth';
import type { Permission } from '@/modules/auth';
import { requireStaff, signOut } from '@/modules/auth/server';
import { Logo } from '@/modules/brand';
import { enterStorefrontPreview } from '@/modules/storefront/server/preview';

const SECTIONS: (NavItem & { permission?: Permission })[] = [
  { href: '/admin', label: 'Inicio' },
  {
    href: '/admin/mostrador',
    label: 'Mostrador',
    permission: 'inventory.sell_in_store',
    group: 'Tienda',
  },
  {
    href: '/admin/inventario',
    label: 'Inventario',
    permission: 'inventory.view',
    group: 'Tienda',
  },
  {
    href: '/admin/movimientos',
    label: 'Movimientos',
    permission: 'inventory.view',
    group: 'Tienda',
  },
  {
    href: '/admin/reposicion',
    label: 'Reposición',
    permission: 'inventory.view',
    group: 'Tienda',
  },
  {
    href: '/admin/compras',
    label: 'Compras',
    permission: 'purchasing.manage',
    group: 'Tienda',
  },
  {
    href: '/admin/catalogo',
    label: 'Catálogo',
    permission: 'catalog.edit',
    group: 'Web',
  },
  {
    href: '/admin/contenido',
    label: 'Contenido',
    permission: 'content.edit',
    group: 'Web',
  },
  {
    href: '/admin/asistente',
    label: 'Asistente',
    permission: 'agent.use',
    group: 'Análisis',
  },
  {
    href: '/admin/informes',
    label: 'Informes',
    permission: 'reports.view',
    group: 'Análisis',
  },
  {
    href: '/admin/configuracion',
    label: 'Configuración',
    permission: 'settings.manage',
    group: 'Administración',
  },
  {
    href: '/admin/equipo',
    label: 'Equipo',
    permission: 'staff.manage',
    group: 'Administración',
  },
  {
    href: '/admin/pedidos',
    label: 'Pedidos',
    soon: true,
    group: 'Próximamente',
  },
  {
    href: '/admin/mensajes',
    label: 'Mensajes',
    soon: true,
    group: 'Próximamente',
  },
  {
    href: '/admin/clientes',
    label: 'Clientes',
    soon: true,
    group: 'Próximamente',
  },
];

export default async function PanelLayout({
  children,
}: {
  children: ReactNode;
}) {
  const staff = await requireStaff();
  const items = SECTIONS.filter(
    (s) =>
      !s.permission ||
      isAllowed({ role: staff.role, aal: 'aal2' }, s.permission),
  ).map(({ href, label, soon, group }) => ({ href, label, soon, group }));
  const canPreview = isAllowed(
    { role: staff.role, aal: 'aal2' },
    'catalog.edit',
  );
  const shortcuts = (
    <>
      {canPreview && (
        <form action={enterStorefrontPreview}>
          <button
            type="submit"
            className="text-ivory/60 hover:text-ivory min-h-9 text-left text-xs tracking-[0.16em] uppercase"
          >
            Vista previa con borradores
          </button>
        </form>
      )}
      <Link
        href="/es"
        className="text-ivory/60 hover:text-ivory inline-flex min-h-9 items-center text-xs tracking-[0.16em] uppercase"
        target="_blank"
      >
        Tienda pública ↗
      </Link>
    </>
  );

  return (
    <div className="panel-shell min-h-screen lg:grid lg:grid-cols-[15rem_1fr] print:block print:min-h-0">
      <aside className="bg-night text-ivory flex items-center justify-between gap-4 px-5 py-3 lg:sticky lg:top-0 lg:h-screen lg:flex-col lg:items-stretch lg:justify-start lg:gap-8 lg:overflow-y-auto lg:overscroll-contain lg:px-4 lg:py-8 print:hidden">
        <Link
          href="/admin"
          className="inline-flex min-h-11 items-center lg:px-3"
          aria-label="Inicio del panel"
        >
          <Logo className="text-[14px]" />
        </Link>
        <PanelNav items={items} footer={shortcuts} />
        <div className="hidden lg:mt-auto lg:flex lg:flex-col lg:items-start lg:gap-1 lg:px-3">
          {shortcuts}
        </div>
      </aside>
      <div className="min-w-0">
        <header className="border-line flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3 sm:px-10 print:hidden">
          <p className="text-sm">
            <span className="font-semibold">
              {staff.displayName ?? staff.email}
            </span>
            <span className="text-smoke"> · {ROLE_LABELS[staff.role]}</span>
          </p>
          <form action={signOut}>
            <button
              type="submit"
              className="link-underline text-smoke inline-flex min-h-11 items-center text-xs tracking-[0.16em] uppercase"
            >
              Cerrar sesión
            </button>
          </form>
        </header>
        <div className="px-5 py-8 sm:px-10 sm:py-10 print:p-0">{children}</div>
      </div>
      <Toaster />
    </div>
  );
}
