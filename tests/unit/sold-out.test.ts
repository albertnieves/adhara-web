import { describe, expect, it } from 'vitest';
import { availableFirst, soldOutProductIds } from '@/modules/catalog';
import type { StorefrontProduct } from '@/modules/catalog';

/* Agotados de la portada y la colección (DECISIONS §195). */

const product = (id: string, variants: string[]) =>
  ({ id, variants: variants.map((v) => ({ id: v })) }) as StorefrontProduct;

describe('soldOutProductIds', () => {
  const products = [
    product('a', ['a1']),
    product('b', ['b1', 'b2']),
    product('c', ['c1', 'c2']),
    product('d', []),
  ];

  it('agotado solo si todos sus formatos lo dicen', () => {
    const soldOut = soldOutProductIds(products, {
      a1: 'out_of_stock',
      b1: 'out_of_stock',
      b2: 'low_stock',
      c1: 'out_of_stock',
      c2: 'out_of_stock',
    });
    expect([...soldOut]).toEqual(['a', 'c']);
  });

  it('sin lectura de disponibilidad no esconde nada', () => {
    expect(soldOutProductIds(products, {}).size).toBe(0);
    expect(soldOutProductIds(products, { b1: 'out_of_stock' }).size).toBe(0);
  });
});

describe('availableFirst', () => {
  it('pone delante lo disponible y conserva el orden de cada grupo', () => {
    const list = ['a', 'b', 'c', 'd'].map((id) => ({ id }));
    expect(availableFirst(list, new Set(['a', 'c'])).map((p) => p.id)).toEqual([
      'b',
      'd',
      'a',
      'c',
    ]);
  });
});
