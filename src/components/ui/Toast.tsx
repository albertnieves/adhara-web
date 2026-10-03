'use client';

import { useEffect, useState } from 'react';
import { cx } from './cx';
import { Icon } from './Icon';

export type ToastTone = 'ok' | 'error';
type Item = { id: number; message: string; tone: ToastTone };

const listeners = new Set<(item: Item) => void>();
let next = 0;

/** Los de éxito se van solos; los errores se quedan hasta cerrarlos. */
const OK_TIMEOUT = 5000;

/**
 * Aviso breve con el resultado de una acción (Fase 2, DS-08). Lo pinta el
 * `Toaster` de la página; se puede llamar desde cualquier componente.
 */
export function toast(message: string, tone: ToastTone = 'ok') {
  const item = { id: ++next, message, tone };
  listeners.forEach((listener) => listener(item));
}

/**
 * Zona de avisos, una por página. Las dos regiones vivas existen desde el
 * principio para que el lector de pantalla anuncie cada aviso: los de éxito
 * con cortesía (`status`) y los errores al momento (`alert`).
 */
export function Toaster({
  closeLabel = 'Cerrar aviso',
}: {
  closeLabel?: string;
}) {
  const [items, setItems] = useState<Item[]>([]);
  useEffect(() => {
    const add = (item: Item) => {
      setItems((list) => [...list.slice(-2), item]);
      if (item.tone === 'ok')
        window.setTimeout(() => dismiss(item.id), OK_TIMEOUT);
    };
    const dismiss = (id: number) =>
      setItems((list) => list.filter((t) => t.id !== id));
    listeners.add(add);
    return () => {
      listeners.delete(add);
    };
  }, []);

  const render = (tone: ToastTone) =>
    items
      .filter((t) => t.tone === tone)
      .map((t) => (
        <div
          key={t.id}
          data-tone={tone === 'ok' ? 'dark' : undefined}
          className={cx(
            'toast bg-surface text-fg pointer-events-auto flex max-w-sm items-start gap-3 border-l-2 py-3 pr-2 pl-4 text-sm shadow-lg',
            tone === 'ok' ? 'border-accent' : 'border-danger',
          )}
        >
          <Icon
            name={tone === 'ok' ? 'check' : 'alert'}
            size="sm"
            className={cx(
              'mt-0.5 shrink-0',
              tone === 'ok' ? 'text-accent' : 'text-danger',
            )}
          />
          <p className="flex-1 py-px">{t.message}</p>
          <button
            type="button"
            aria-label={closeLabel}
            onClick={() =>
              setItems((list) => list.filter((item) => item.id !== t.id))
            }
            className="text-fg-muted hover:text-fg -my-1 inline-flex size-6 shrink-0 items-center justify-center"
          >
            <Icon name="close" size="sm" />
          </button>
        </div>
      ));

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-(--z-toast) flex flex-col items-end gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 print:hidden">
      <div role="alert" className="flex flex-col items-end gap-2">
        {render('error')}
      </div>
      <div role="status" className="flex flex-col items-end gap-2">
        {render('ok')}
      </div>
    </div>
  );
}
