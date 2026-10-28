'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type SectionTab = {
  href: string;
  label: string;
  /** Activa solo en su ruta exacta (la portada de la sección). */
  exact?: boolean;
};

function isActive(pathname: string, tab: SectionTab) {
  return tab.exact
    ? pathname === tab.href
    : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
}

/**
 * Pestañas de una sección del panel (Envíos: seguimiento, transportistas,
 * remitente y pesos). Son enlaces a páginas, no paneles: cada una tiene su
 * URL y su permiso. En el móvil se desplazan en horizontal sin mover la
 * página.
 */
export function SectionTabs({
  label,
  tabs,
}: {
  /** Nombre del grupo para el lector de pantalla («Apartados de Envíos»). */
  label: string;
  tabs: SectionTab[];
}) {
  const pathname = usePathname();
  return (
    <nav
      aria-label={label}
      className="border-border mb-10 overflow-x-auto overscroll-x-contain border-b print:hidden"
    >
      <ul className="flex min-w-max">
        {tabs.map((tab, index) => {
          const active = isActive(pathname, tab);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={`ease-luxe inline-flex min-h-11 items-center border-b-2 text-sm transition-colors duration-(--duration-fast) ${index === 0 ? 'pr-4' : 'px-4'} ${
                  active
                    ? 'border-accent text-fg font-semibold'
                    : 'text-fg-muted hover:text-fg hover:border-border-strong border-transparent'
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
