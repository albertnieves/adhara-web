'use client';

import { useEffect, useRef } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

/**
 * `<dialog>` modal nativo (Fase 2, DS-08): `showModal()` deja el resto de la
 * página inerte y Esc cierra (evento `close`). Tab y Mayús+Tab dan la vuelta
 * dentro del diálogo en lugar de salir a la barra del navegador. Al abrir,
 * el foco va al elemento con `data-autofocus` si lo hay; al cerrar, vuelve
 * al control que abrió el diálogo.
 */
export function useModal(open: boolean) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open) return;
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    if (!dialog.open) dialog.showModal();
    dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();

    const wrap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const items = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.getClientRects().length > 0,
      );
      const first = items[0];
      const last = items.at(-1);
      if (!first || !last) return;
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    dialog.addEventListener('keydown', wrap);

    return () => {
      dialog.removeEventListener('keydown', wrap);
      if (dialog.open) dialog.close();
      if (opener?.isConnected) opener.focus();
    };
  }, [open]);
  return ref;
}
