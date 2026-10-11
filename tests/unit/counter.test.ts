import { describe, expect, it } from 'vitest';
import type { CounterItem } from '@/modules/inventory';
import {
  MAX_LINE_QUANTITY,
  addToTicket,
  findByCode,
  linePrice,
  linesAboveRetail,
  linesWithoutStock,
  normalizeSearch,
  searchVariants,
  setLinePrice,
  setLineQuantity,
  ticketTotal,
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

describe('precio cobrado en el mostrador', () => {
  const byId = new Map([
    ['a', item({ variantId: 'a', priceCents: 4950 })],
    ['b', item({ variantId: 'b', priceCents: null })],
  ]);

  it('cada línea cobra el PVP salvo que se indique otro precio', () => {
    const lines = addToTicket(addToTicket([], 'a', 2), 'b');
    expect(linePrice(lines[0]!, byId.get('a'))).toBe(4950);
    const discounted = setLinePrice(lines, 'a', 3995);
    expect(linePrice(discounted[0]!, byId.get('a'))).toBe(3995);
    expect(setLinePrice(discounted, 'a', null)[0]!.unitPriceCents).toBeNull();
    // Cambiar unidades conserva el precio indicado.
    expect(addToTicket(discounted, 'a')[0]).toEqual({
      variantId: 'a',
      quantity: 3,
      unitPriceCents: 3995,
    });
  });

  it('total del ticket y líneas sin precio', () => {
    const lines = setLinePrice(
      addToTicket(addToTicket([], 'a', 2), 'b'),
      'a',
      4000,
    );
    expect(ticketTotal(lines, byId)).toEqual({
      totalCents: 8000,
      unpriced: ['b'],
    });
    expect(ticketTotal(setLinePrice(lines, 'b', 1500), byId)).toEqual({
      totalCents: 9500,
      unpriced: [],
    });
  });

  it('no se cobra por encima del PVP; sin PVP, cualquier precio', () => {
    const lines = setLinePrice(
      setLinePrice(addToTicket(addToTicket([], 'a'), 'b'), 'a', 49500),
      'b',
      99900,
    );
    expect(linesAboveRetail(lines, byId)).toEqual(['a']);
  });
});
