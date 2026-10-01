'use client';

import { useEffect, useState } from 'react';

type Toast = { id: number; message: string; tone: 'ok' | 'error' };

const listeners = new Set<(toast: Toast) => void>();
let next = 0;

/** Aviso breve en la esquina del panel con el resultado de una acción. */
export function toast(message: string, tone: Toast['tone'] = 'ok') {
  const item = { id: ++next, message, tone };
  listeners.forEach((listener) => listener(item));
}

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => {
    const add = (item: Toast) => {
      setToasts((list) => [...list.slice(-2), item]);
      window.setTimeout(
        () => setToasts((list) => list.filter((t) => t.id !== item.id)),
        item.tone === 'error' ? 8000 : 4500,
      );
    };
    listeners.add(add);
    return () => {
      listeners.delete(add);
    };
  }, []);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 print:hidden"
    >
      {toasts.map((t) => (
        <p
          key={t.id}
          role={t.tone === 'error' ? 'alert' : 'status'}
          className={`toast pointer-events-auto max-w-sm border-l-2 px-5 py-4 text-sm shadow-lg ${
            t.tone === 'error'
              ? 'border-danger bg-ivory text-danger'
              : 'border-gold bg-night text-ivory'
          }`}
        >
          {t.message}
        </p>
      ))}
    </div>
  );
}
