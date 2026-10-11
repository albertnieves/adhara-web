'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { buttonClass } from '@/components/ui';

/**
 * Error en una sección de la consola: se puede reintentar sin perder la
 * sesión ni el menú. Densa, como el resto de la consola.
 */
export default function ConsoleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(
      '[consola] error en una sección',
      error.digest ?? error.message,
    );
  }, [error]);
  return (
    <div role="alert" className="border-danger max-w-xl border-l-2 py-2 pl-5">
      <p className="text-danger text-2xs tracking-caps-sm font-semibold uppercase">
        Error
      </p>
      <h1 className="mt-1 text-2xl font-semibold">
        No se pudo cargar esta sección
      </h1>
      <p className="text-fg-muted mt-2 text-sm">
        Puede ser un corte momentáneo de la conexión con la base de datos.
        {error.digest && (
          <>
            {' '}
            Si se repite, anota la referencia{' '}
            <code className="text-fg font-mono">{error.digest}</code>.
          </>
        )}
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className={buttonClass('primary', 'md')}
        >
          Reintentar
        </button>
        <Link href="/admin/control" className={buttonClass('outline', 'md')}>
          Ir al resumen
        </Link>
      </div>
    </div>
  );
}
