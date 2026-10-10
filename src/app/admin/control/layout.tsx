import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { PanelNav } from '@/modules/admin/ui/PanelNav';
import type { NavItem } from '@/modules/admin/ui/PanelNav';
import { Toaster } from '@/components/ui';
import { requirePermission, signOut } from '@/modules/auth/server';
import { Logo } from '@/modules/brand';

export const metadata: Metadata = {
  title: { default: 'Control', template: '%s · Control' },
};

const SECTIONS: NavItem[] = [
  { href: '/admin/control', label: 'Resumen', exact: true },
  {
    href: '/admin/control/negocio',
    label: 'Ventas y beneficio',
    group: 'Negocio',
  },
  { href: '/admin/control/costes', label: 'Costes', group: 'Negocio' },
  { href: '/admin/control/tareas', label: 'Tareas', group: 'Proyecto' },
  { href: '/admin/control/entregas', label: 'Entregas', group: 'Proyecto' },
];

/**
 * Control del negocio y del proyecto: una sección aparte del panel de la
 * tienda, con su propio menú, solo para quien tiene business.control (el
 * administrador del sistema, con MFA). Sin permiso, 404.
 */
export default async function ControlLayout({
  children,
}: {
  children: ReactNode;
}) {
  const staff = await requirePermission('business.control');
  const shortcut =
    'text-fg-muted hover:text-fg inline-flex min-h-11 items-center text-left text-xs tracking-caps uppercase';
  const shortcuts = (
    <>
      <Link href="/admin" className={shortcut}>
        Panel de la tienda
      </Link>
      <Link href="/es" className={shortcut} target="_blank">
        Tienda pública ↗
      </Link>
    </>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[15rem_1fr] print:block print:min-h-0">
      <aside
        data-tone="dark"
        className="bg-surface text-fg flex items-center justify-between gap-4 px-5 py-3 lg:sticky lg:top-0 lg:h-screen lg:flex-col lg:items-stretch lg:justify-start lg:gap-8 lg:overflow-y-auto lg:overscroll-contain lg:px-4 lg:py-8 print:hidden"
      >
        <Link
          href="/admin/control"
          className="inline-flex min-h-11 flex-col justify-center gap-1 lg:px-3"
          aria-label="Resumen del control"
        >
          <Logo size="sm" />
          <span className="text-accent-fg text-2xs tracking-caps hidden font-semibold uppercase lg:block">
            Control
          </span>
        </Link>
        <PanelNav items={SECTIONS} footer={shortcuts} />
        <div className="hidden lg:mt-auto lg:flex lg:flex-col lg:items-start lg:gap-1 lg:px-3">
          {shortcuts}
        </div>
      </aside>
      <div className="min-w-0">
        <header className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3 sm:px-10 print:hidden">
          <p className="text-sm">
            <span className="font-semibold">
              {staff.displayName ?? staff.email}
            </span>
            <span className="text-fg-muted">
              {' '}
              · Control del negocio y del proyecto
            </span>
          </p>
          <form action={signOut}>
            <button
              type="submit"
              className="link-underline text-fg-muted tracking-caps inline-flex min-h-11 items-center text-xs uppercase"
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
