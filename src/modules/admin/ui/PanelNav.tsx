'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Sheet } from '@/components/ui';

export type NavItem = {
  href: string;
  label: string;
  soon?: boolean;
  /** Grupo del menú; sin grupo, el enlace va arriba (Inicio). */
  group?: string;
};

function isActive(pathname: string, href: string) {
  return href === '/admin'
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

function NavList({
  items,
  pathname,
  onNavigate,
}: {
  items: NavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  const groups: { name: string | undefined; items: NavItem[] }[] = [];
  for (const item of items) {
    const last = groups.at(-1);
    if (last && last.name === item.group) last.items.push(item);
    else groups.push({ name: item.group, items: [item] });
  }
  return (
    <div className="flex flex-col gap-5">
      {groups.map((group) => (
        <div key={group.name ?? 'inicio'}>
          {group.name && (
            <p className="text-fg-muted text-2xs tracking-caps px-3 pb-1 font-semibold uppercase">
              {group.name}
            </p>
          )}
          <ul className="flex flex-col">
            {group.items.map((item) =>
              item.soon ? (
                <li
                  key={item.href}
                  className="text-fg-muted flex min-h-11 items-center justify-between px-3 text-sm"
                >
                  {item.label}
                  <span className="text-2xs tracking-caps-sm uppercase">
                    Pronto
                  </span>
                </li>
              ) : (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={
                      isActive(pathname, item.href) ? 'page' : undefined
                    }
                    className={`ease-luxe flex min-h-11 items-center border-l-2 px-3 text-sm transition-colors duration-(--duration-base) ${
                      isActive(pathname, item.href)
                        ? 'bg-surface-raised text-fg border-accent'
                        : 'text-fg-muted hover:text-fg hover:bg-surface-raised border-transparent'
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              ),
            )}
          </ul>
        </div>
      ))}
    </div>
  );
}

/**
 * Navegación del panel: lateral fija en escritorio (con desplazamiento propio
 * si no cabe en alto) y menú en panel deslizante en tablet vertical y móvil.
 */
export function PanelNav({
  items,
  footer,
}: {
  items: NavItem[];
  /** Accesos a la tienda y vista previa, también dentro del menú móvil. */
  footer?: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="border-border-strong hover:border-fg text-fg tracking-caps inline-flex min-h-11 items-center gap-3 border px-4 text-xs uppercase transition-colors lg:hidden"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <span aria-hidden="true" className="flex w-4 flex-col gap-1">
          <span className="h-px bg-current" />
          <span className="h-px bg-current" />
          <span className="h-px bg-current" />
        </span>
        Menú
      </button>
      <nav aria-label="Secciones del panel" className="hidden lg:block">
        <NavList items={items} pathname={pathname} />
      </nav>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Menú"
        side="left"
        tone="dark"
      >
        <nav aria-label="Secciones del panel" className="-mx-3">
          <NavList
            items={items}
            pathname={pathname}
            onNavigate={() => setOpen(false)}
          />
        </nav>
        {footer && (
          <div className="border-border mt-8 flex flex-col items-start gap-4 border-t pt-6">
            {footer}
          </div>
        )}
      </Sheet>
    </>
  );
}
