import Link from 'next/link';
import type { ReactNode } from 'react';
import { PanelNav } from '@/modules/admin/ui/PanelNav';
import type { NavItem } from '@/modules/admin/ui/PanelNav';
import { ROLE_LABELS, isAllowed } from '@/modules/auth';
import type { Permission } from '@/modules/auth';
import { requireStaff, signOut } from '@/modules/auth/server';
import { Logo } from '@/modules/brand';

const SECTIONS: (NavItem & { permission?: Permission })[] = [
  { href: '/admin', label: 'Inicio' },
  { href: '/admin/catalogo', label: 'Catálogo', permission: 'catalog.edit' },
  {
    href: '/admin/inventario',
    label: 'Inventario',
    permission: 'inventory.view',
  },
  {
    href: '/admin/movimientos',
    label: 'Movimientos',
    permission: 'inventory.view',
  },
  { href: '/admin/equipo', label: 'Equipo', permission: 'staff.manage' },
  { href: '/admin/pedidos', label: 'Pedidos', soon: true },
  { href: '/admin/mensajes', label: 'Mensajes', soon: true },
  { href: '/admin/clientes', label: 'Clientes', soon: true },
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
  ).map(({ href, label, soon }) => ({ href, label, soon }));

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="bg-night text-ivory relative flex items-center justify-between px-5 py-4 lg:sticky lg:top-0 lg:h-screen lg:flex-col lg:items-stretch lg:justify-start lg:gap-10 lg:px-4 lg:py-8">
        <Link href="/admin" className="lg:px-3" aria-label="Inicio del panel">
          <Logo />
        </Link>
        <PanelNav items={items} />
        <div className="hidden lg:mt-auto lg:block lg:px-3">
          <Link
            href="/es"
            className="text-ivory/60 hover:text-ivory text-xs tracking-[0.16em] uppercase"
            target="_blank"
          >
            Ver la tienda ↗
          </Link>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="border-line flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4 sm:px-10">
          <p className="text-sm">
            <span className="font-semibold">
              {staff.displayName ?? staff.email}
            </span>
            <span className="text-smoke"> · {ROLE_LABELS[staff.role]}</span>
          </p>
          <form action={signOut}>
            <button
              type="submit"
              className="link-underline text-smoke text-xs tracking-[0.16em] uppercase"
            >
              Cerrar sesión
            </button>
          </form>
        </header>
        <div className="px-5 py-10 sm:px-10">{children}</div>
      </div>
    </div>
  );
}
