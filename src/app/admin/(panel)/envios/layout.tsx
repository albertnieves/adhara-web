import Link from 'next/link';
import type { ReactNode } from 'react';
import { SectionTabs } from '@/modules/admin';
import type { SectionTab } from '@/modules/admin';
import { isAllowed } from '@/modules/auth';
import type { Permission } from '@/modules/auth';
import { requireStaff } from '@/modules/auth/server';
import { buttonClass, Eyebrow, Heading } from '@/components/ui';

/*
 * Sección Envíos (DECISIONS §177): todo lo de los envíos en un sitio, con una
 * pestaña por tarea. Cada página vuelve a comprobar su permiso; aquí solo se
 * eligen las pestañas que se enseñan.
 */
const TABS: (SectionTab & { permission: Permission })[] = [
  {
    href: '/admin/envios',
    label: 'Seguimiento',
    exact: true,
    permission: 'orders.view',
  },
  {
    href: '/admin/envios/transportistas',
    label: 'Transportistas y tarifas',
    permission: 'settings.manage',
  },
  {
    href: '/admin/envios/ajustes',
    label: 'Remitente y zonas',
    permission: 'settings.manage',
  },
  {
    href: '/admin/envios/pesos',
    label: 'Pesos de los formatos',
    permission: 'catalog.edit',
  },
];

export default async function ShippingLayout({
  children,
}: {
  children: ReactNode;
}) {
  const staff = await requireStaff();
  const tabs = TABS.filter((tab) =>
    isAllowed({ role: staff.role, aal: 'aal2' }, tab.permission),
  ).map(({ href, label, exact }) => ({ href, label, exact }));
  const canOrders = isAllowed({ role: staff.role, aal: 'aal2' }, 'orders.view');

  return (
    <main>
      <header className="mb-6 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Eyebrow>Web</Eyebrow>
          <Heading level={1} size="h2" className="mt-2">
            Envíos
          </Heading>
        </div>
        {canOrders && (
          <Link href="/admin/pedidos" className={buttonClass('outline')}>
            Pedidos web
          </Link>
        )}
      </header>
      {tabs.length > 1 ? (
        <SectionTabs label="Apartados de Envíos" tabs={tabs} />
      ) : (
        <div className="border-border mb-10 border-b" />
      )}
      {children}
    </main>
  );
}
