/**
 * PostgREST de Supabase devuelve como mucho 1000 filas por petición. Para
 * listados que pueden crecer (catálogo, stock), `page` construye la consulta
 * de nuevo para cada tramo; debe tener un orden estable.
 */
export const PAGE_SIZE = 1000;

type PageResult<T> = PromiseLike<{
  data: T[] | null;
  error: { message: string } | null;
}>;

export async function fetchAll<T>(
  page: (from: number, to: number) => PageResult<T>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

/** Trocea una lista de ids para funciones que devuelven una fila por id. */
export function chunk<T>(items: readonly T[], size = 500): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}
