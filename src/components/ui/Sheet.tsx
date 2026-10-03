'use client';

import { useId } from 'react';
import type { ReactNode } from 'react';
import { CloseButton } from './Dialog';
import type { OverlayTone } from './Dialog';
import { useModal } from './useModal';

/**
 * Panel lateral modal (Fase 2, DS-08; antes en el panel): `<dialog>` nativo
 * que entra desde el borde, atrapa el foco, se cierra con Esc o tocando fuera
 * y devuelve el foco al control que lo abrió. No empuja ni recorta tablas.
 * Los colores salen del tono (`data-tone`), sin variantes propias.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  side = 'right',
  tone = 'light',
  closeLabel = 'Cerrar',
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  side?: 'right' | 'left';
  tone?: OverlayTone;
  /** Nombre del botón de cerrar, en el idioma de la página. */
  closeLabel?: string;
  children: ReactNode;
}) {
  const ref = useModal(open);
  const titleId = useId();
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      data-side={side}
      data-tone={tone === 'light' ? undefined : tone}
      className="sheet"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className="flex min-h-full flex-col">
          <header className="border-border bg-surface sticky top-0 z-10 flex items-start justify-between gap-4 border-b px-6 py-5">
            <div className="min-w-0">
              <h2
                id={titleId}
                className="font-display text-2xl leading-tight font-light"
              >
                {title}
              </h2>
              {description && (
                <div className="text-fg-muted mt-1 text-sm">{description}</div>
              )}
            </div>
            <CloseButton label={closeLabel} onClick={onClose} />
          </header>
          <div className="flex-1 px-6 py-6">{children}</div>
        </div>
      )}
    </dialog>
  );
}
