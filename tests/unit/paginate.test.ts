import { describe, expect, it } from 'vitest';
import { PAGE_SIZE, chunk, fetchAll } from '@/lib/supabase/paginate';

describe('fetchAll', () => {
  it('pide tramos de 1000 hasta que uno viene incompleto', async () => {
    const total = PAGE_SIZE * 2 + 5;
    const calls: [number, number][] = [];
    const rows = await fetchAll(async (from, to) => {
      calls.push([from, to]);
      const data = Array.from(
        { length: Math.max(0, Math.min(to, total - 1) - from + 1) },
        (_, i) => from + i,
      );
      return { data, error: null };
    });
    expect(rows).toHaveLength(total);
    expect(calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it('propaga el error de la consulta', async () => {
    await expect(
      fetchAll(async () => ({ data: null, error: { message: 'falló' } })),
    ).rejects.toThrow('falló');
  });

  it('trocea listas de ids', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([])).toEqual([]);
  });
});
