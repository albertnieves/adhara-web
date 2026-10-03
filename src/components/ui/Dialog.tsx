'use client';

import { useCallback, useId, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from './Button';
import { Icon } from './Icon';
import { useModal } from './useModal';

/** Tonos de superficie de las superposiciones (los de la guía, DS-02). */
export type OverlayTone = 'light' | 'dark' | 'oud' | 'indigo' | 'forest';

/** Botón de cerrar de 44 px para diálogos y paneles. */
export function CloseButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="border-border text-fg hover:border-fg ease-luxe -mr-2 inline-flex size-11 shrink-0 items-center justify-center border transition-colors duration-(--duration-fast)"
    >
      <Icon name="close" />
    </button>
  );
}

/**
 * Diálogo modal centrado (Fase 2, DS-08) sobre `<dialog>` nativo: foco
 * atrapado, Esc cierra y el foco vuelve al control que lo abrió. Tocar fuera
 * también cierra. Las acciones van al pie; la menos arriesgada, primero.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  actions,
  tone = 'light',
  closeLabel = 'Cerrar',
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  /** Botones del pie. */
  actions?: ReactNode;
  tone?: OverlayTone;
  /** Nombre del botón de cerrar, en el idioma de la página. */
  closeLabel?: string;
  children?: ReactNode;
}) {
  const ref = useModal(open);
  const titleId = useId();
  const descriptionId = useId();
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      data-tone={tone === 'light' ? undefined : tone}
      className="dialog"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className="flex flex-col gap-5 p-6">
          <header className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2
                id={titleId}
                className="font-display text-2xl leading-tight font-light"
              >
                {title}
              </h2>
              {description && (
                <div id={descriptionId} className="text-fg-muted mt-2 text-sm">
                  {description}
                </div>
              )}
            </div>
            <CloseButton label={closeLabel} onClick={onClose} />
          </header>
          {children && <div className="text-sm">{children}</div>}
          {actions && (
            <footer className="flex flex-wrap justify-end gap-3">
              {actions}
            </footer>
          )}
        </div>
      )}
    </dialog>
  );
}

export type ConfirmOptions = {
  title: ReactNode;
  description?: ReactNode;
  /** Texto del botón que confirma, con el verbo: «Eliminar». */
  confirmLabel: string;
  cancelLabel?: string;
  /** `danger` para acciones destructivas. */
  tone?: 'danger' | 'primary';
};

/**
 * Confirmación de acciones (sustituye a `window.confirm`). Devuelve la
 * función que pregunta y el diálogo que hay que pintar:
 *
 *   const [confirm, confirmDialog] = useConfirm();
 *   if (!(await confirm({ title: '¿Eliminar…?', confirmLabel: 'Eliminar', tone: 'danger' }))) return;
 *
 * El foco empieza en «Cancelar»: Intro por accidente no destruye nada.
 */
export function useConfirm() {
  const [pending, setPending] = useState<{
    options: ConfirmOptions;
    resolve: (confirmed: boolean) => void;
  } | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setPending({ options, resolve })),
    [],
  );

  const settle = (confirmed: boolean) => {
    pending?.resolve(confirmed);
    setPending(null);
  };

  const dialog = (
    <Dialog
      open={pending !== null}
      onClose={() => settle(false)}
      title={pending?.options.title}
      description={pending?.options.description}
      actions={
        pending && (
          <>
            <Button
              variant="outline"
              data-autofocus=""
              onClick={() => settle(false)}
            >
              {pending.options.cancelLabel ?? 'Cancelar'}
            </Button>
            <Button
              variant={pending.options.tone === 'danger' ? 'danger' : 'primary'}
              onClick={() => settle(true)}
            >
              {pending.options.confirmLabel}
            </Button>
          </>
        )
      }
    />
  );

  return [confirm, dialog] as const;
}
