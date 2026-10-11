import { Skeleton } from '@/components/ui';

/**
 * Mientras carga una sección de la consola: la forma densa de sus pantallas
 * (cabecera, fila de cifras y un bloque de tabla o gráfico), sin saltos.
 */
export default function ConsoleLoading() {
  return (
    <div role="status" aria-busy="true" aria-label="Cargando">
      <div className="border-border mb-6 flex items-end justify-between border-b pb-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-64" />
        </div>
        <Skeleton className="h-11 w-36" />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="border-border bg-surface-raised flex h-24 flex-col gap-3 border px-4 py-3"
          >
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-28" />
          </div>
        ))}
      </div>
      <div className="border-border bg-surface-raised mt-6 flex flex-col gap-3 border p-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-4" />
        ))}
      </div>
    </div>
  );
}
