'use client';

import { useEffect, useId, useRef } from 'react';

/**
 * Panel lateral modal (`<dialog>` nativo): atrapa el foco, se cierra con Esc o
 * tocando fuera y no empuja ni recorta el contenido de tablas y listados.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  side = 'right',
  tone = 'light',
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  side?: 'right' | 'left';
  tone?: 'light' | 'dark';
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      data-side={side}
      data-tone={tone}
      className="sheet"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className="flex min-h-full flex-col">
          <header
            className={`sticky top-0 z-10 flex items-start justify-between gap-4 border-b px-6 py-5 ${
              tone === 'dark'
                ? 'bg-night border-ivory/10'
                : 'border-line bg-ivory'
            }`}
          >
            <div className="min-w-0">
              <h2 id={titleId} className="text-2xl leading-tight font-light">
                {title}
              </h2>
              {description && (
                <div
                  className={`mt-1 text-sm ${tone === 'dark' ? 'text-ivory/60' : 'text-smoke'}`}
                >
                  {description}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className={`-mr-2 inline-flex size-11 shrink-0 items-center justify-center border text-lg transition-colors ${
                tone === 'dark'
                  ? 'border-ivory/20 hover:border-ivory'
                  : 'border-line hover:border-ink'
              }`}
            >
              ×
            </button>
          </header>
          <div className="flex-1 px-6 py-6">{children}</div>
        </div>
      )}
    </dialog>
  );
}
