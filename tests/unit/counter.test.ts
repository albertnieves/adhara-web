import { describe, expect, it } from 'vitest';
import type { CounterItem } from '@/modules/inventory';
import {
  MAX_LINE_QUANTITY,
  addToTicket,
  findByCode,
  linesWithoutStock,
  normalizeSearch,
  searchVariants,
  setLineQuantity,
  ticketUnits,
} from '@/modules/inventory';

const item = (overrides: Partial<CounterItem>): CounterItem => ({
  variantId: 'v',
  productName: 'Perfume',
  brandName: 'Marca',
  variantLabel: '100 ml',
  sku: null,
  ean: null,
  priceCents: 4950,
  available: 3,
  ...overrides,
});

const items = [
  item({
    variantId: 'yara',
    productName: 'Yara',
    brandName: 'Lattafa',
    sku: 'LAT-YARA-100',
    ean: '6291108735411',
  }),
  item({
    variantId: 'yara-moi',
    productName: 'Yara Moi',
    brandName: 'Lattafa',
    sku: 'LAT-YARA-MOI',
  }),
  item({
    variantId: 'khamrah',
    productName: 'Khamrah Qahwa',
    brandName: 'Lattafa',
    available: 0,
  }),
  item({ variantId: 'club', productName: 'Club de Nuit', brandName: 'Armaf' }),
];

describe('búsqueda del mostrador', () => {
  it('ignora tildes y mayúsculas', () => {
    expect(normalizeSearch('  Désert  NUIT ')).toBe('desert nuit');
  });

  it('encuentra por palabras en marca y nombre', () => {
    expect(
      searchVariants(items, 'lattafa yara').map((i) => i.variantId),
    ).toEqual(['yara', 'yara-moi']);
    expect(searchVariants(items, 'club armaf')[0]?.variantId).toBe('club');
    expect(searchVariants(items, '   ')).toEqual([]);
  });

  it('el código exacto de un lector va primero', () => {
    expect(findByCode(items, '6291108735411')?.variantId).toBe('yara');
    expect(findByCode(items, 'lat-yara-moi')?.variantId).toBe('yara-moi');
    expect(findByCode(items, 'LAT')).toBeNull();
    expect(searchVariants(items, 'LAT-YARA-100')[0]?.variantId).toBe('yara');
  });
});

describe('líneas del ticket', () => {
  it('añadir el mismo formato suma unidades', () => {
    const lines = addToTicket(addToTicket([], 'yara'), 'yara', 2);
    expect(lines).toEqual([{ variantId: 'yara', quantity: 3 }]);
    expect(ticketUnits(addToTicket(lines, 'club'))).toBe(4);
  });

  it('cambiar la cantidad a 0 quita la línea y no pasa del máximo', () => {
    const lines = addToTicket([], 'yara');
    expect(setLineQuantity(lines, 'yara', 0)).toEqual([]);
    expect(setLineQuantity(lines, 'yara', 5000)[0]?.quantity).toBe(
      MAX_LINE_QUANTITY,
    );
    expect(setLineQuantity(lines, 'yara', 2.7)[0]?.quantity).toBe(2);
  });

  it('avisa de las líneas sin stock en una venta, no en una devolución', () => {
    const byId = new Map(items.map((i) => [i.variantId, i]));
    const lines = [
      { variantId: 'yara', quantity: 3 },
      { variantId: 'khamrah', quantity: 1 },
      { variantId: 'club', quantity: 4 },
    ];
    expect(linesWithoutStock(lines, byId, 'sale')).toEqual(['khamrah', 'club']);
    expect(linesWithoutStock(lines, byId, 'return')).toEqual([]);
  });
});
