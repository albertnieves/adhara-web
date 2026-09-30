import { describe, expect, it } from 'vitest';
import type { ExistingCatalog } from '@/modules/catalog/domain/import';
import {
  parseCsv,
  parseMl,
  parsePrice,
  planImport,
  readImportRows,
} from '@/modules/catalog/domain/import';

describe('lectura de CSV', () => {
  it('detecta «;», respeta comillas y BOM, y omite filas vacías', () => {
    const csv =
      '﻿marca;nombre;pvp\r\nLattafa;"Yara; rosa";49,90\r\n\r\n"Marca ""X""";Asad;"1.299,00"\n';
    expect(parseCsv(csv)).toEqual([
      ['marca', 'nombre', 'pvp'],
      ['Lattafa', 'Yara; rosa', '49,90'],
      ['Marca "X"', 'Asad', '1.299,00'],
    ]);
  });

  it('usa la coma si la cabecera la usa', () => {
    expect(parseCsv('marca,nombre\nA,"B, C"')).toEqual([
      ['marca', 'nombre'],
      ['A', 'B, C'],
    ]);
  });

  it('interpreta precios y mililitros', () => {
    expect(parsePrice('49,90 €')).toBe(4990);
    expect(parsePrice('49.9')).toBe(4990);
    expect(parsePrice('1.299,00')).toBe(129900);
    expect(parsePrice('gratis')).toBeNull();
    expect(parseMl('100 ml')).toBe(100);
    expect(parseMl('100ML')).toBe(100);
    expect(parseMl('0')).toBeNull();
    expect(parseMl('cien')).toBeNull();
  });
});

describe('validación de filas', () => {
  it('acepta alias de columnas y valores en español', () => {
    const result = readImportRows(
      'Casa;Perfume;Tipo;Tamaño;Precio;Género;Página\nLattafa;Yara;Eau de Parfum;100 ml;34,90;Mujer;p. 12',
    );
    expect(result.fatal).toBeNull();
    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toMatchObject({
      line: 2,
      brand: 'Lattafa',
      name: 'Yara',
      concentration: 'EDP',
      sizeMl: 100,
      priceCents: 3490,
      audience: 'women',
      source: 'p. 12',
    });
  });

  it('exige marca y nombre en la cabecera', () => {
    expect(readImportRows('perfume;pvp\nYara;1').fatal).toMatch(/marca/);
  });

  it('informa de cada problema con su línea sin inventar valores', () => {
    const result = readImportRows(
      'marca;nombre;concentracion;ml;pvp;ean\n;Yara;;;;\nLattafa;Asad;Perfume;x;0;12',
    );
    expect(result.rows).toEqual([]);
    expect(result.errors).toEqual([
      { line: 2, message: 'falta la marca' },
      {
        line: 3,
        message:
          'concentración desconocida «Perfume»; ml no válido «x»; PVP no válido «0»; EAN no válido «12»',
      },
    ]);
  });

  it('aplica el origen por defecto a las filas sin origen', () => {
    const result = readImportRows(
      'marca;nombre;origen\nA;B;\nA;C;p. 3',
      'CATALOGO global 2026',
    );
    expect(result.rows.map((r) => r.source)).toEqual([
      'CATALOGO global 2026',
      'p. 3',
    ]);
  });
});

const EXISTING: ExistingCatalog = {
  brands: [{ id: 'b-lattafa', slug: 'lattafa', name: 'Lattafa' }],
  products: [
    {
      id: 'p-yara',
      brandId: 'b-lattafa',
      slug: 'yara',
      name: 'Yara',
      concentration: 'EDP',
      audience: null,
      sourceRef: null,
      variants: [
        {
          id: 'v-yara-100',
          sizeMl: 100,
          label: null,
          sku: 'LAT-YARA-100',
          priceCents: 3490,
          position: 0,
        },
      ],
    },
    {
      id: 'p-khamrah',
      brandId: 'b-lattafa',
      slug: 'khamrah',
      name: 'Khamrah',
      concentration: null,
      audience: null,
      sourceRef: 'caja',
      variants: [],
    },
  ],
};

function plan(csv: string) {
  const read = readImportRows(csv, 'CATALOGO global 2026');
  return planImport(read.rows, EXISTING, read.errors);
}

describe('plan de importación', () => {
  it('reconoce lo existente y crea solo lo nuevo', () => {
    const result = plan(
      [
        'marca;nombre;concentracion;ml;pvp',
        'LATTAFA;yara;EDP;100;34,90',
        'Lattafa;Yara;EDP;50;24,90',
        'Lattafa;Khamrah;EDP;100;39,90',
        'Armaf;Club de Nuit Intense Man;EDT;105;',
      ].join('\n'),
    );
    expect(result.errors).toEqual([]);
    expect(result.summary).toMatchObject({
      newBrands: 1,
      newProducts: 1,
      filledProducts: 2,
      newVariants: 3,
      pricesToSet: 2,
      priceConflicts: 0,
      unchanged: 0,
    });
    const [yara100, yara50, khamrah, cdn] = result.rows;
    expect(yara100?.variant.existingId).toBe('v-yara-100');
    expect(yara100?.price).toEqual({ kind: 'same' });
    expect(yara100?.product.fill).toEqual({
      source_ref: 'CATALOGO global 2026',
    });
    expect(yara50?.variant).toMatchObject({ existingId: null, position: 1 });
    expect(yara50?.product.fill).toEqual({});
    expect(khamrah?.product.fill).toEqual({ concentration: 'EDP' });
    expect(khamrah?.price).toEqual({ kind: 'set', cents: 3990 });
    expect(cdn).toMatchObject({
      brand: { existingId: null, name: 'Armaf' },
      product: { existingId: null, slug: 'club-de-nuit-intense-man' },
      price: { kind: 'none' },
    });
  });

  it('nunca sobrescribe un PVP distinto: lo marca como conflicto', () => {
    const result = plan('marca;nombre;ml;pvp\nLattafa;Yara;100;29,90');
    expect(result.rows[0]?.price).toEqual({
      kind: 'conflict',
      currentCents: 3490,
      proposedCents: 2990,
    });
    expect(result.summary.priceConflicts).toBe(1);
  });

  it('no cambia una concentración ya fijada y lo avisa', () => {
    const result = plan('marca;nombre;concentracion;ml\nLattafa;Yara;EDT;100');
    expect(result.rows[0]?.product.fill).toEqual({
      source_ref: 'CATALOGO global 2026',
    });
    expect(result.rows[0]?.product.warnings).toEqual([
      'concentración distinta: se mantiene EDP',
    ]);
  });

  it('rechaza filas repetidas y SKU de otro perfume', () => {
    const result = plan(
      [
        'marca;nombre;ml;sku',
        'Lattafa;Asad;100;LAT-ASAD',
        'Lattafa;Asad;100;',
        'Lattafa;Khamrah;100;LAT-YARA-100',
        'Lattafa;Khamrah;50;LAT-ASAD',
      ].join('\n'),
    );
    expect(result.rows).toHaveLength(1);
    expect(result.errors.map((e) => e.line)).toEqual([3, 4, 5]);
  });

  it('da un nombre web único a perfumes homónimos de otra marca', () => {
    const result = plan(
      'marca;nombre;ml\nOtra casa;Yara;100\nOtra casa;Yara;50',
    );
    expect(result.rows.map((r) => r.product.slug)).toEqual([
      'yara-2',
      'yara-2',
    ]);
    expect(result.summary.newProducts).toBe(1);
  });

  it('avisa si un perfume nuevo trae concentraciones distintas', () => {
    const result = plan(
      'marca;nombre;concentracion;ml\nA;B;EDP;100\nA;B;EDT;50',
    );
    expect(result.rows[1]?.product.warnings).toEqual([
      'concentración distinta de la fila 2: se usa EDP',
    ]);
  });
});
