import Link from 'next/link';
import type { ReactNode } from 'react';
import { ROLE_LABELS } from '@/modules/auth';
import { requireStaff, signOut } from '@/modules/auth/server';

const SECTIONS = [
  'Precios',
  'Inventario',
  'Agente de stock',
  'Pedidos',
  'Mensajes',
  'Clientes',
  'Informes',
];

export default async function PanelLayout({
  children,
}: {
  children: ReactNode;
}) {
  const staff = await requireStaff();
  return (
    <div className="min-h-screen md:grid md:grid-cols-[14rem_1fr]">
      <nav
        aria-label="Secciones del panel"
        className="border-b p-4 md:border-r md:border-b-0"
      >
        <p className="mb-4 font-semibold">ADHARA</p>
        <ul className="flex flex-wrap gap-3 md:flex-col">
          <li>
            <Link href="/admin">Inicio</Link>
          </li>
          {SECTIONS.map((section) => (
            <li key={section} className="text-neutral-500">
              {section} <span className="text-xs">(próximamente)</span>
            </li>
          ))}
        </ul>
      </nav>
      <div>
        <header className="flex flex-wrap items-center justify-between gap-2 border-b p-4">
          <p>
            {staff.displayName ?? staff.email} · {ROLE_LABELS[staff.role]}
          </p>
          <form action={signOut}>
            <button type="submit" className="border px-3 py-1">
              Cerrar sesión
            </button>
          </form>
        </header>
        {children}
      </div>
    </div>
  );
}
