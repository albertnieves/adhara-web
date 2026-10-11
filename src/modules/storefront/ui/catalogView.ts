import { useSyncExternalStore } from 'react';

/**
 * Vista de las rejillas de perfumes en el móvil: `grid`, dos columnas de
 * tarjetas compactas (por defecto), o `large`, una columna con la tarjeta
 * grande. Desde 640 px las dos vistas son iguales.
 */
export type CatalogView = 'grid' | 'large';

export const DEFAULT_CATALOG_VIEW: CatalogView = 'grid';

/*
 * La elección vive en memoria, no en el navegador: se conserva al ir a una
 * ficha y volver, y la colección y el catálogo olfativo la comparten; una
 * recarga vuelve a la cuadrícula. Así no añade cookies ni almacenamiento a la
 * política de cookies.
 */
let current: CatalogView = DEFAULT_CATALOG_VIEW;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function setCatalogView(view: CatalogView) {
  current = view;
  for (const listener of listeners) listener();
}

export function useCatalogView() {
  const view = useSyncExternalStore(
    subscribe,
    () => current,
    () => DEFAULT_CATALOG_VIEW,
  );
  return [view, setCatalogView] as const;
}

/**
 * Rejilla de la colección y del catálogo olfativo. En el móvil, dos columnas
 * con poco aire en `grid`; desde 640 px, 2, 3 y 4 columnas en ambas vistas.
 */
export function productGridClass(view: CatalogView) {
  return view === 'grid'
    ? 'grid grid-cols-2 gap-x-3 gap-y-10 sm:gap-x-6 sm:gap-y-16 lg:grid-cols-3 xl:grid-cols-4'
    : 'grid gap-x-6 gap-y-16 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
}
