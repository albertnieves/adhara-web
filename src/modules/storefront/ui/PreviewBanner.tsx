'use client';

import { usePathname } from 'next/navigation';
import { Star } from '@/modules/brand';

/** Aviso fijo mientras el personal ve la tienda con borradores. */
export function PreviewBanner() {
  const pathname = usePathname();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <form
        method="post"
        action="/api/vista-previa/salir"
        data-tone="dark"
        className="bg-night text-ivory pointer-events-auto flex items-center gap-4 py-2.5 pr-2.5 pl-4 text-xs shadow-2xl"
      >
        <input type="hidden" name="path" value={pathname} />
        <Star className="text-gold-soft size-3 shrink-0" />
        <p>
          <span className="tracking-caps-sm font-semibold uppercase">
            Vista previa
          </span>
          <span className="text-ivory/70">
            {' '}
            · con borradores, solo personal
          </span>
        </p>
        <button
          type="submit"
          className="border-ivory/30 hover:bg-ivory hover:text-ink tracking-caps border px-3 py-1.5 uppercase transition-colors"
        >
          Salir
        </button>
      </form>
    </div>
  );
}
