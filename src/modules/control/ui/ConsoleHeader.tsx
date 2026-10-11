import Link from 'next/link';
import type { ReactNode } from 'react';

/** Cabecera compacta de las pantallas de la consola: sección, título y acciones. */
export function ConsoleHeader({
  section,
  title,
  description,
  children,
}: {
  section: string;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="border-border mb-6 flex flex-wrap items-end justify-between gap-4 border-b pb-4">
      <div className="min-w-0">
        <p className="text-fg-muted text-2xs tracking-caps-sm font-semibold uppercase">
          {section}
        </p>
        <h1 className="mt-1 text-2xl font-semibold">{title}</h1>
        {description && (
          <p className="text-fg-muted mt-1 max-w-3xl text-sm">{description}</p>
        )}
      </div>
      {children && (
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      )}
    </header>
  );
}

/** Enlaces de filtro (periodo, vista…) como pestañas compactas. */
export function FilterLinks({
  label,
  options,
}: {
  label: string;
  options: { href: string; label: string; active: boolean }[];
}) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-1">
      {options.map((o) => (
        <Link
          key={o.href}
          href={o.href}
          aria-current={o.active ? 'page' : undefined}
          className={`inline-flex min-h-9 items-center border px-3 text-xs transition-colors duration-(--duration-fast) ${
            o.active
              ? 'border-accent text-fg bg-surface-raised'
              : 'border-border text-fg-muted hover:border-border-strong hover:text-fg'
          }`}
        >
          {o.label}
        </Link>
      ))}
    </nav>
  );
}
