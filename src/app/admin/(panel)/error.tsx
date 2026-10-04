'use client';

import { useEffect } from 'react';
import { buttonClass, Eyebrow } from '@/components/ui';

/** Error en una sección del panel: se puede reintentar sin perder la sesión. */
export default function PanelError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[admin] error en el panel', error.digest ?? error.message);
  }, [error]);
  return (
    <div role="alert" className="max-w-lg py-16">
      <Eyebrow>Error</Eyebrow>
      <h1 className="mt-2 text-4xl font-light">
        No se pudo cargar esta sección
      </h1>
      <p className="text-fg-muted mt-4 text-sm leading-relaxed">
        Puede ser un corte momentáneo de la conexión con la base de datos. Si se
        repite, anota la referencia{error.digest ? ` ${error.digest}` : ''}.
      </p>
      <button
        type="button"
        onClick={reset}
        className={buttonClass('primary', 'lg', 'mt-8')}
      >
        Reintentar
      </button>
    </div>
  );
}
