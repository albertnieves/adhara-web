import { cardClass, Skeleton } from '@/components/ui';

/** Mientras carga una sección del panel: estructura tenue, sin saltos. */
export default function PanelLoading() {
  return (
    <div role="status" aria-busy="true" aria-label="Cargando">
      <div className="border-border mb-10 border-b pb-8">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-4 h-10 w-72" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className={cardClass({ className: 'h-32' })} />
        ))}
      </div>
    </div>
  );
}
