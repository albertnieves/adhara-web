'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type ConsoleSection = {
  href: string;
  label: string;
  /** Grupo del menú; sin grupo, el enlace va arriba (Resumen). */
  group?: string;
  /** Activo solo en su ruta exacta (el inicio de la consola). */
  exact?: boolean;
};

/**
 * Secciones de la consola del titular, en el orden del menú. Algunas páginas
 * llegan en la misma fase que el menú (productos, atención, sistema…).
 */
const CONSOLE_SECTIONS: readonly ConsoleSection[] = [
  { href: '/admin/control', label: 'Resumen', exact: true },
  {
    href: '/admin/control/negocio',
    label: 'Ventas y beneficio',
    group: 'Negocio',
  },
  { href: '/admin/control/productos', label: 'Productos', group: 'Negocio' },
  { href: '/admin/control/atencion', label: 'Atención', group: 'Negocio' },
  { href: '/admin/control/costes', label: 'Costes', group: 'Negocio' },
  { href: '/admin/control/tareas', label: 'Tareas', group: 'Proyecto' },
  { href: '/admin/control/entregas', label: 'Entregas', group: 'Proyecto' },
  { href: '/admin/control/sistema', label: 'Estado', group: 'Sistema' },
  { href: '/admin/control/copias', label: 'Copias', group: 'Sistema' },
  { href: '/admin/control/asistente', label: 'Asistente', group: 'Sistema' },
  {
    href: '/admin/control/calidad',
    label: 'Calidad de datos',
    group: 'Sistema',
  },
];

/** Si la sección está abierta: la ruta exacta o una de sus subrutas. */
function isSectionActive(pathname: string, section: ConsoleSection) {
  return section.exact
    ? pathname === section.href
    : pathname === section.href || pathname.startsWith(`${section.href}/`);
}

/** Secciones agrupadas en orden, sin repetir grupo. */
function groupSections(sections: readonly ConsoleSection[]) {
  const groups: { name: string | undefined; items: ConsoleSection[] }[] = [];
  for (const section of sections) {
    const last = groups.at(-1);
    if (last && last.name === section.group) last.items.push(section);
    else groups.push({ name: section.group, items: [section] });
  }
  return groups;
}

/**
 * Menú de la consola: siempre visible en la barra lateral (la consola es
 * solo para escritorio), sin panel deslizante ni botón «Menú». Enlaces
 * densos de 36 px; el activo lleva `aria-current` y el borde de señal.
 */
export function ConsoleNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Secciones de la consola" className="flex flex-col gap-4">
      {groupSections(CONSOLE_SECTIONS).map((group) => {
        const labelId = group.name
          ? `consola-grupo-${group.name.toLowerCase()}`
          : undefined;
        return (
          <div key={group.name ?? 'inicio'}>
            {group.name && (
              <p
                id={labelId}
                className="text-fg-muted text-2xs tracking-caps px-3 pb-1 font-semibold uppercase"
              >
                {group.name}
              </p>
            )}
            <ul aria-labelledby={labelId} className="flex flex-col">
              {group.items.map((section) => {
                const active = isSectionActive(pathname, section);
                return (
                  <li key={section.href}>
                    <Link
                      href={section.href}
                      aria-current={active ? 'page' : undefined}
                      className={`flex min-h-9 items-center border-l-2 px-3 text-sm transition-colors duration-(--duration-fast) ${
                        active
                          ? 'border-accent bg-surface-raised text-fg font-semibold'
                          : 'text-fg-muted hover:text-fg hover:bg-surface-raised border-transparent'
                      }`}
                    >
                      {section.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
