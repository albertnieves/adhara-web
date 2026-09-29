'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

export type NavItem = { href: string; label: string; soon?: boolean };

function isActive(pathname: string, href: string) {
  return href === '/admin' ? pathname === href : pathname.startsWith(href);
}

/** Navegación del panel: lateral en escritorio, desplegable en móvil y tablet vertical. */
export function PanelNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const links = (
    <ul className="flex flex-col gap-1">
      {items.map((item) =>
        item.soon ? (
          <li
            key={item.href}
            className="text-ivory/30 flex items-center justify-between px-3 py-2.5 text-sm"
          >
            {item.label}
            <span className="text-[0.5625rem] tracking-[0.16em] uppercase">
              Pronto
            </span>
          </li>
        ) : (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={() => setOpen(false)}
              aria-current={isActive(pathname, item.href) ? 'page' : undefined}
              className={`flex min-h-11 items-center px-3 text-sm transition-colors duration-300 ${
                isActive(pathname, item.href)
                  ? 'bg-ivory/10 text-ivory border-gold border-l-2'
                  : 'text-ivory/65 hover:text-ivory border-l-2 border-transparent'
              }`}
            >
              {item.label}
            </Link>
          </li>
        ),
      )}
    </ul>
  );
  return (
    <>
      <button
        type="button"
        className="text-ivory/80 text-xs tracking-[0.2em] uppercase lg:hidden"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? 'Cerrar' : 'Menú'}
      </button>
      <nav aria-label="Secciones del panel" className="hidden lg:block">
        {links}
      </nav>
      {open && (
        <nav
          aria-label="Secciones del panel"
          className="bg-night absolute inset-x-0 top-full z-30 px-4 pb-6 lg:hidden"
        >
          {links}
        </nav>
      )}
    </>
  );
}
