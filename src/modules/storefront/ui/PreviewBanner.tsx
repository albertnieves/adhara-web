'use client';

import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui';
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
        className="bg-surface text-fg pointer-events-auto flex items-center gap-4 py-2.5 pr-2.5 pl-4 text-xs shadow-2xl"
      >
        <input type="hidden" name="path" value={pathname} />
        <Star className="text-accent-fg size-3 shrink-0" />
        <p>
          <span className="tracking-caps-sm font-semibold uppercase">
            Vista previa
          </span>
          <span className="text-fg-muted">
            {' '}
            · con borradores, solo personal
          </span>
        </p>
        <Button type="submit" variant="outline" size="sm">
          Salir
        </Button>
      </form>
    </div>
  );
}
