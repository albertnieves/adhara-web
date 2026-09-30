import type { BasisPoints, Cents } from '@/lib/money';
import { BASIS_POINTS, divideHalfEven, parseEuros } from '@/lib/money';
import type { Audience, Concentration } from './product';
import { slugify } from './product';

/*
 * Importación de catálogo desde CSV (p. ej. extraído del PDF del proveedor).
 * Todo es puro para poder probarlo: leer el CSV, validar filas y planificar
 * qué se crea. La acción de servidor vuelve a planificar antes de aplicar.
 *
 * Reglas: nunca se sobrescribe un PVP existente (un cambio de PVP pasa por la
 * revisión Ómnibus del editor); de un perfume existente solo se completan
 * campos vacíos; todo lo nuevo se crea como borrador.
 */

export const MAX_IMPORT_ROWS = 2000;

// --- CSV --------------------------------------------------------------------

/** Separador más frecuente fuera de comillas en la cabecera (Excel en España usa «;»). */
function detectDelimiter(text: string): string {
  const header = text.split(/\r?\n/, 1)[0] ?? '';
  const counts = { ';': 0, ',': 0, '\t': 0 };
  let quoted = false;
  for (const char of header) {
    if (char === '"') quoted = !quoted;
    else if (!quoted && char in counts) counts[char as keyof typeof counts]++;
  }
  const [best] = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return best && best[1] > 0 ? best[0] : ',';
}

/** CSV con comillas dobles (RFC 4180), BOM y saltos CRLF. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, '');
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"' && field === '') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ''));
}

// --- Columnas y valores -----------------------------------------------------

export const IMPORT_COLUMNS = [
  'marca',
  'nombre',
  'concentracion',
  'ml',
  'formato',
  'pvp',
  'coste',
  'sku',
  'ean',
  'publico',
  'origen',
] as const;
export type ImportColumn = (typeof IMPORT_COLUMNS)[number];

function normalizeKey(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const COLUMN_ALIASES: Record<string, ImportColumn> = {
  marca: 'marca',
  casa: 'marca',
  brand: 'marca',
  nombre: 'nombre',
  perfume: 'nombre',
  producto: 'nombre',
  name: 'nombre',
  concentracion: 'concentracion',
  concentration: 'concentracion',
  tipo: 'concentracion',
  ml: 'ml',
  tamano: 'ml',
  volumen: 'ml',
  capacidad: 'ml',
  size: 'ml',
  formato: 'formato',
  etiqueta: 'formato',
  label: 'formato',
  pvp: 'pvp',
  precio: 'pvp',
  'precio venta publico': 'pvp',
  price: 'pvp',
  coste: 'coste',
  cost: 'coste',
  'precio coste': 'coste',
  'precio compra': 'coste',
  compra: 'coste',
  mayorista: 'coste',
  'precio mayorista': 'coste',
  sku: 'sku',
  referencia: 'sku',
  ref: 'sku',
  ean: 'ean',
  'codigo de barras': 'ean',
  barcode: 'ean',
  publico: 'publico',
  genero: 'publico',
  audience: 'publico',
  origen: 'origen',
  fuente: 'origen',
  pagina: 'origen',
  source: 'origen',
};

const CONCENTRATION_ALIASES: Record<string, Concentration> = {
  edp: 'EDP',
  'eau de parfum': 'EDP',
  edt: 'EDT',
  'eau de toilette': 'EDT',
  edc: 'EDC',
  'eau de cologne': 'EDC',
  cologne: 'EDC',
  parfum: 'PARFUM',
  'pure parfum': 'PARFUM',
  extrait: 'EXTRAIT',
  'extrait de parfum': 'EXTRAIT',
  oil: 'OIL',
  aceite: 'OIL',
  'aceite perfumado': 'OIL',
  'perfume oil': 'OIL',
  attar: 'OIL',
};

const AUDIENCE_ALIASES: Record<string, Audience> = {
  mujer: 'women',
  femenino: 'women',
  women: 'women',
  female: 'women',
  hombre: 'men',
  masculino: 'men',
  men: 'men',
  male: 'men',
  unisex: 'unisex',
  mixto: 'unisex',
};

/** «49,90», «49.90 €», «1.299,00» → céntimos. */
export function parsePrice(value: string): Cents | null {
  let text = value.replace(/[€\s]/g, '');
  if (text.includes('.') && text.includes(',')) text = text.replace(/\./g, '');
  return parseEuros(text);
}

/** «100», «100 ml», «100ML» → 100. */
export function parseMl(value: string): number | null {
  const match = /^(\d{1,4})\s*(ml)?$/i.exec(value.trim());
  if (!match) return null;
  const ml = Number(match[1]);
  return ml >= 1 && ml <= 5000 ? ml : null;
}

export type ImportRow = {
  line: number;
  brand: string;
  name: string;
  concentration: Concentration | null;
  sizeMl: number | null;
  label: string | null;
  priceCents: Cents | null;
  /** Coste neto (sin IVA); si el archivo lo trae con IVA, ya convertido. */
  costCents: Cents | null;
  sku: string | null;
  ean: string | null;
  audience: Audience | null;
  source: string | null;
};

export type RowError = { line: number; message: string };

export type ReadResult = {
  rows: ImportRow[];
  errors: RowError[];
  /** Error de estructura (sin cabecera válida, demasiadas filas…). */
  fatal: string | null;
  unknownColumns: string[];
};

/**
 * Lee el CSV con cabecera; «origen» por defecto para filas sin él. Si los
 * costes del archivo incluyen IVA (`costVatBp` > 0), se pasan a netos.
 */
export function readImportRows(
  csv: string,
  defaultSource: string | null = null,
  { costVatBp = 0 }: { costVatBp?: BasisPoints } = {},
): ReadResult {
  const table = parseCsv(csv);
  const empty = { rows: [], errors: [], unknownColumns: [] };
  const [header, ...body] = table;
  if (!header) return { ...empty, fatal: 'El archivo está vacío.' };
  const columns = header.map((cell) => COLUMN_ALIASES[normalizeKey(cell)]);
  const unknownColumns = header.filter((_, i) => !columns[i]);
  if (!columns.includes('marca') || !columns.includes('nombre')) {
    return {
      ...empty,
      unknownColumns,
      fatal:
        'La primera fila debe tener al menos las columnas «marca» y «nombre».',
    };
  }
  if (body.length > MAX_IMPORT_ROWS) {
    return {
      ...empty,
      unknownColumns,
      fatal: `Máximo ${MAX_IMPORT_ROWS} filas por importación.`,
    };
  }

  const rows: ImportRow[] = [];
  const errors: RowError[] = [];
  body.forEach((cells, index) => {
    const line = index + 2;
    const get = (column: ImportColumn) => {
      const i = columns.indexOf(column);
      return i === -1 ? '' : (cells[i] ?? '').trim().replace(/\s+/g, ' ');
    };
    const problems: string[] = [];
    const brand = get('marca');
    const name = get('nombre');
    if (!brand) problems.push('falta la marca');
    if (!name) problems.push('falta el nombre');
    if (brand.length > 80 || name.length > 120)
      problems.push('texto demasiado largo');
    if (name && !slugify(name))
      problems.push('el nombre no sirve para una dirección web');

    const concentrationText = get('concentracion');
    const concentration = concentrationText
      ? (CONCENTRATION_ALIASES[normalizeKey(concentrationText)] ?? null)
      : null;
    if (concentrationText && !concentration) {
      problems.push(`concentración desconocida «${concentrationText}»`);
    }
    const mlText = get('ml');
    const sizeMl = mlText ? parseMl(mlText) : null;
    if (mlText && sizeMl === null) problems.push(`ml no válido «${mlText}»`);
    const priceText = get('pvp');
    const priceCents = priceText ? parsePrice(priceText) : null;
    if (priceText && (priceCents === null || priceCents <= 0)) {
      problems.push(`PVP no válido «${priceText}»`);
    }
    const costText = get('coste');
    const costGross = costText ? parsePrice(costText) : null;
    if (costText && costGross === null) {
      problems.push(`coste no válido «${costText}»`);
    }
    const costCents =
      costGross === null
        ? null
        : costVatBp > 0
          ? divideHalfEven(costGross * BASIS_POINTS, BASIS_POINTS + costVatBp)
          : costGross;
    const ean = get('ean').replace(/\s/g, '');
    if (ean && !/^\d{8,14}$/.test(ean)) problems.push(`EAN no válido «${ean}»`);
    const audienceText = get('publico');
    const audience = audienceText
      ? (AUDIENCE_ALIASES[normalizeKey(audienceText)] ?? null)
      : null;
    if (audienceText && !audience) {
      problems.push(`público desconocido «${audienceText}»`);
    }
    const label = get('formato');
    const sku = get('sku');
    if (label.length > 60 || sku.length > 60)
      problems.push('formato o SKU demasiado largo');
    const source = get('origen') || defaultSource?.trim() || '';

    if (problems.length > 0) {
      errors.push({ line, message: problems.join('; ') });
      return;
    }
    rows.push({
      line,
      brand,
      name,
      concentration,
      sizeMl,
      label: label || null,
      priceCents,
      costCents,
      sku: sku || null,
      ean: ean || null,
      audience,
      source: source ? source.slice(0, 200) : null,
    });
  });
  return { rows, errors, fatal: null, unknownColumns };
}

// --- Plan -------------------------------------------------------------------

export type ExistingVariant = {
  id: string;
  sizeMl: number | null;
  label: string | null;
  sku: string | null;
  priceCents: Cents | null;
  /** Coste vigente; undefined si no se conoce (sin permiso de costes). */
  costCents?: Cents | null;
  position: number;
};

export type ExistingProduct = {
  id: string;
  brandId: string;
  slug: string;
  name: string;
  concentration: string | null;
  audience: string | null;
  sourceRef: string | null;
  variants: ExistingVariant[];
};

export type ExistingCatalog = {
  brands: { id: string; slug: string; name: string }[];
  products: ExistingProduct[];
};

export type PriceAction =
  | { kind: 'none' }
  | { kind: 'set'; cents: Cents }
  | { kind: 'same' }
  | { kind: 'conflict'; currentCents: Cents; proposedCents: Cents };

export type CostAction =
  { kind: 'none' } | { kind: 'record'; cents: Cents } | { kind: 'same' };

export type PlannedRow = {
  line: number;
  brand: { key: string; name: string; existingId: string | null };
  product: {
    key: string;
    name: string;
    existingId: string | null;
    slug: string;
    /** Campos vacíos del perfume existente que se completan. */
    fill: Partial<{
      concentration: Concentration;
      audience: Audience;
      source_ref: string;
    }>;
    warnings: string[];
  };
  variant: {
    existingId: string | null;
    sizeMl: number | null;
    label: string | null;
    sku: string | null;
    ean: string | null;
    position: number;
  };
  price: PriceAction;
  cost: CostAction;
  row: ImportRow;
};

export type ImportPlan = {
  rows: PlannedRow[];
  errors: RowError[];
  summary: {
    newBrands: number;
    newProducts: number;
    filledProducts: number;
    newVariants: number;
    pricesToSet: number;
    priceConflicts: number;
    costsToRecord: number;
    unchanged: number;
    errors: number;
  };
};

function variantKey(sizeMl: number | null, label: string | null) {
  return `${sizeMl ?? ''}|${normalizeKey(label ?? '')}`;
}

export function planImport(
  rows: ImportRow[],
  existing: ExistingCatalog,
  readErrors: RowError[] = [],
): ImportPlan {
  const errors = [...readErrors];
  const brandsByKey = new Map(existing.brands.map((b) => [slugify(b.name), b]));
  const productsByKey = new Map(
    existing.products.map((p) => [`${p.brandId}|${slugify(p.name)}`, p]),
  );
  const skuOwner = new Map<string, string>();
  for (const product of existing.products) {
    for (const variant of product.variants) {
      if (variant.sku) skuOwner.set(variant.sku.toLowerCase(), product.id);
    }
  }
  const usedSlugs = new Set(existing.products.map((p) => p.slug));
  const newProductSlugs = new Map<string, string>();
  const nextPosition = new Map<string, number>();
  const seenVariants = new Set<string>();
  const seenSkus = new Map<string, string>();
  const filled = new Set<string>();
  const firstRowOfNew = new Map<string, ImportRow>();
  const planned: PlannedRow[] = [];

  for (const row of rows) {
    const brandKey = slugify(row.brand);
    const brand = brandsByKey.get(brandKey) ?? null;
    const productKey = `${brand?.id ?? `new:${brandKey}`}|${slugify(row.name)}`;
    const product = productsByKey.get(productKey) ?? null;

    let slug = product?.slug ?? newProductSlugs.get(productKey);
    if (!slug) {
      const base = slugify(row.name);
      slug = base;
      for (let n = 2; usedSlugs.has(slug); n += 1) slug = `${base}-${n}`;
      usedSlugs.add(slug);
      newProductSlugs.set(productKey, slug);
    }

    const key = variantKey(row.sizeMl, row.label);
    if (seenVariants.has(`${productKey}#${key}`)) {
      errors.push({
        line: row.line,
        message: 'fila repetida en el archivo (mismo perfume y formato)',
      });
      continue;
    }
    if (row.sku) {
      const sku = row.sku.toLowerCase();
      const owner = skuOwner.get(sku);
      const firstUse = seenSkus.get(sku);
      if (
        (owner && owner !== product?.id) ||
        (firstUse && firstUse !== productKey)
      ) {
        errors.push({
          line: row.line,
          message: `el SKU ${row.sku} ya es de otro perfume`,
        });
        continue;
      }
      seenSkus.set(sku, productKey);
    }
    seenVariants.add(`${productKey}#${key}`);

    // Una fila sin ml, etiqueta ni SKU es «el formato» del perfume: si ya
    // tiene uno solo, se usa ese en lugar de crear otro sin tamaño.
    const bare = !row.sizeMl && !row.label && !row.sku;
    const variant =
      product?.variants.find(
        (v) =>
          (row.sku && v.sku?.toLowerCase() === row.sku.toLowerCase()) ||
          variantKey(v.sizeMl, v.label) === key,
      ) ??
      (bare && product?.variants.length === 1 ? product.variants[0] : null) ??
      null;

    let position = variant?.position ?? 0;
    if (!variant) {
      const start =
        nextPosition.get(productKey) ??
        (product
          ? Math.max(-1, ...product.variants.map((v) => v.position)) + 1
          : 0);
      position = start;
      nextPosition.set(productKey, start + 1);
    }

    const fill: PlannedRow['product']['fill'] = {};
    const warnings: string[] = [];
    if (product) {
      if (row.concentration) {
        if (!product.concentration) fill.concentration = row.concentration;
        else if (product.concentration !== row.concentration) {
          warnings.push(
            `concentración distinta: se mantiene ${product.concentration}`,
          );
        }
      }
      if (row.audience && !product.audience) fill.audience = row.audience;
      if (row.source && !product.sourceRef) fill.source_ref = row.source;
    } else {
      // Un perfume nuevo toma sus datos de la primera fila en que aparece.
      const first = firstRowOfNew.get(productKey);
      if (!first) firstRowOfNew.set(productKey, row);
      else if (row.concentration && row.concentration !== first.concentration) {
        warnings.push(
          `concentración distinta de la fila ${first.line}: se usa ${first.concentration ?? 'ninguna'}`,
        );
      }
    }

    let price: PriceAction = { kind: 'none' };
    if (row.priceCents !== null) {
      const current = variant?.priceCents ?? null;
      if (current === null) price = { kind: 'set', cents: row.priceCents };
      else if (current === row.priceCents) price = { kind: 'same' };
      else
        price = {
          kind: 'conflict',
          currentCents: current,
          proposedCents: row.priceCents,
        };
    }

    let cost: CostAction = { kind: 'none' };
    if (row.costCents !== null) {
      cost =
        variant?.costCents === row.costCents
          ? { kind: 'same' }
          : { kind: 'record', cents: row.costCents };
    }

    if (product && Object.keys(fill).length > 0 && !filled.has(product.id)) {
      filled.add(product.id);
    } else if (product && filled.has(product.id)) {
      // Los campos del perfume se completan una vez, con la primera fila.
      for (const field of Object.keys(fill))
        delete fill[field as keyof typeof fill];
    }

    planned.push({
      line: row.line,
      brand: {
        key: brandKey,
        name: brand?.name ?? row.brand,
        existingId: brand?.id ?? null,
      },
      product: {
        key: productKey,
        name: product?.name ?? row.name,
        existingId: product?.id ?? null,
        slug,
        fill,
        warnings,
      },
      variant: {
        existingId: variant?.id ?? null,
        sizeMl: row.sizeMl,
        label: row.label,
        sku: row.sku,
        ean: row.ean,
        position,
      },
      price,
      cost,
      row,
    });
  }

  const newBrands = new Set(
    planned.filter((r) => !r.brand.existingId).map((r) => r.brand.key),
  ).size;
  const newProducts = new Set(
    planned.filter((r) => !r.product.existingId).map((r) => r.product.key),
  ).size;
  return {
    rows: planned,
    errors: errors.sort((a, b) => a.line - b.line),
    summary: {
      newBrands,
      newProducts,
      filledProducts: filled.size,
      newVariants: planned.filter((r) => !r.variant.existingId).length,
      pricesToSet: planned.filter((r) => r.price.kind === 'set').length,
      priceConflicts: planned.filter((r) => r.price.kind === 'conflict').length,
      costsToRecord: planned.filter((r) => r.cost.kind === 'record').length,
      unchanged: planned.filter(
        (r) =>
          r.variant.existingId &&
          r.price.kind !== 'set' &&
          r.price.kind !== 'conflict' &&
          r.cost.kind !== 'record' &&
          Object.keys(r.product.fill).length === 0,
      ).length,
      errors: errors.length,
    },
  };
}
