import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Badge, buttonClass, Toaster } from '@/components/ui';
import type { BadgeTone } from '@/components/ui';
import { signOut } from '@/modules/auth/server';
import { BRAND_NAME } from '@/modules/brand';
import { madridToday } from '@/modules/control';
import { requireControl } from '@/modules/control/server';
import { ConsoleNav } from '@/modules/control/ui';

export const metadata: Metadata = {
  title: { default: 'Consola', template: '%s · Consola' },
};

/** Dónde corre la aplicación, según Vercel; fuera de Vercel, en local. */
function environment(): { label: string; tone: BadgeTone } {
  switch (process.env.VERCEL_ENV) {
    case 'production':
      return { label: 'Producción', tone: 'accent' };
    case 'preview':
      return { label: 'Preview', tone: 'warning' };
    default:
      return { label: 'Local', tone: 'neutral' };
  }
}

const TODAY = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Europe/Madrid',
});

const footerLink =
  'text-fg-muted hover:text-fg flex min-h-9 items-center px-3 text-xs transition-colors duration-(--duration-fast)';

/**
 * Consola del titular (/admin/control): solo para quien está en la lista de
 * titulares, con business.control y MFA (si no, 404). Tono propio de consola
 * oscura y solo para escritorio: por debajo de 1280 px, la misma URL muestra
 * un aviso con el enlace al panel de la tienda, sin redirigir.
 */
export default async function ConsoleLayout({
  children,
}: {
  children: ReactNode;
}) {
  const staff = await requireControl();
  const env = environment();
  const now = new Date();

  return (
    <div
      data-tone="console"
      data-shell="console"
      className="bg-surface text-fg min-h-dvh print:min-h-0"
    >
      <main className="flex min-h-dvh flex-col justify-center gap-4 px-6 py-16 xl:hidden print:hidden">
        <p className="text-fg-muted text-2xs tracking-caps font-semibold uppercase">
          Consola · {BRAND_NAME}
        </p>
        <h1 className="text-2xl font-semibold">Solo en ordenador</h1>
        <p className="text-fg-muted max-w-md text-sm">
          La consola se usa en ordenador, a partir de 1280 px de ancho.
        </p>
        <Link
          href="/admin"
          className={buttonClass('outline', 'md', 'self-start')}
        >
          Panel de la tienda
        </Link>
      </main>

      <div className="hidden min-h-dvh xl:grid xl:grid-cols-[15rem_1fr] print:block print:min-h-0">
        <aside className="border-border bg-surface-sunken sticky top-0 flex h-dvh flex-col gap-6 overflow-y-auto overscroll-contain border-r px-3 py-5 print:hidden">
          <Link
            href="/admin/control"
            className="flex min-h-11 flex-col justify-center px-3"
          >
            <span className="flex items-center gap-2 text-base font-semibold">
              <span aria-hidden="true" className="bg-accent block size-2" />
              Consola
            </span>
            <span className="text-fg-muted text-2xs tracking-caps-sm uppercase">
              {BRAND_NAME}
            </span>
          </Link>
          <ConsoleNav />
          <div className="border-border mt-auto flex flex-col border-t pt-3">
            <Link href="/admin" className={footerLink}>
              Panel de la tienda
            </Link>
            <Link href="/es" className={footerLink} target="_blank">
              Tienda pública ↗
            </Link>
            <p className="text-fg mt-2 truncate px-3 text-xs font-semibold">
              {staff.displayName ?? staff.email}
            </p>
            <form action={signOut} className="px-3">
              <button
                type="submit"
                className="text-fg-muted hover:text-fg tracking-caps-sm inline-flex min-h-11 items-center text-xs uppercase transition-colors duration-(--duration-fast)"
              >
                Cerrar sesión
              </button>
            </form>
          </div>
        </aside>
        <div className="min-w-0">
          <header className="border-border flex min-h-10 items-center justify-between gap-4 border-b px-8 print:hidden">
            <p className="flex items-center gap-2 text-xs">
              <span className="text-fg-muted">Entorno</span>
              <Badge tone={env.tone}>{env.label}</Badge>
            </p>
            <p className="text-fg-muted text-xs">
              <time dateTime={madridToday(now)}>{TODAY.format(now)}</time>
              <span> · Madrid</span>
            </p>
          </header>
          <div className="px-8 py-6 print:p-0">{children}</div>
        </div>
      </div>
      <Toaster />
    </div>
  );
}
