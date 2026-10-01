/**
 * Mostrador: ventas y devoluciones de la tienda física desde la tablet. El
 * panel no emite tickets ni guarda importes; descuenta unidades y guarda el
 * nº de ticket del TPV o de la caja. La venta se aplica en SQL todo o nada
 * (admin_record_store_sale); aquí se preparan las líneas y se avisa antes.
 */

export const COUNTER_KINDS = ['sale', 'return'] as const;
export type CounterKind = (typeof COUNTER_KINDS)[number];

export const COUNTER_KIND_LABELS: Readonly<Record<CounterKind, string>> = {
  sale: 'Venta',
  return: 'Devolución',
};

/** Límites de la función SQL (p_items ≤ 100 líneas; cantidad 1–100000). */
export const MAX_TICKET_LINES = 100;
export const MAX_LINE_QUANTITY = 999;
export const MAX_TICKET_REF = 60;

/** Lo mínimo para buscar un formato (mostrador, pedidos, proveedores). */
export type SearchableVariant = {
  variantId: string;
  productName: string;
  brandName: string;
  variantLabel: string;
  sku: string | null;
  ean: string | null;
};

export type CounterItem = SearchableVariant & {
  /** PVP con IVA, solo como referencia para quien atiende. */
  priceCents: number | null;
  available: number;
};

export type TicketLine = { variantId: string; quantity: number };

/** Minúsculas sin tildes ni espacios sobrantes, para buscar. */
export function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Código exacto (SKU o EAN), tal como lo teclea un lector de códigos. */
export function findByCode<T extends SearchableVariant>(
  items: readonly T[],
  code: string,
): T | null {
  const needle = code.trim().toLowerCase();
  if (!needle) return null;
  const matches = items.filter(
    (item) =>
      item.ean?.trim().toLowerCase() === needle ||
      item.sku?.trim().toLowerCase() === needle,
  );
  return matches.length === 1 ? matches[0]! : null;
}

/** Busca por palabras en marca, perfume, formato, SKU y EAN. */
export function searchVariants<T extends SearchableVariant>(
  items: readonly T[],
  query: string,
  limit = 12,
): T[] {
  const words = normalizeSearch(query).split(' ').filter(Boolean);
  if (words.length === 0) return [];
  const exact = findByCode(items, query);
  const found = items.filter((item) => {
    const haystack = normalizeSearch(
      `${item.brandName} ${item.productName} ${item.variantLabel} ${item.sku ?? ''} ${item.ean ?? ''}`,
    );
    return words.every((word) => haystack.includes(word));
  });
  const ordered = exact
    ? [exact, ...found.filter((item) => item !== exact)]
    : found;
  return ordered.slice(0, limit);
}

export function addToTicket(
  lines: readonly TicketLine[],
  variantId: string,
  quantity = 1,
): TicketLine[] {
  const existing = lines.find((line) => line.variantId === variantId);
  if (existing) {
    return lines.map((line) =>
      line.variantId === variantId
        ? {
            ...line,
            quantity: Math.min(line.quantity + quantity, MAX_LINE_QUANTITY),
          }
        : line,
    );
  }
  if (lines.length >= MAX_TICKET_LINES) return [...lines];
  return [
    ...lines,
    { variantId, quantity: Math.min(quantity, MAX_LINE_QUANTITY) },
  ];
}

/** Cambia la cantidad de una línea; 0 o menos la quita. */
export function setLineQuantity(
  lines: readonly TicketLine[],
  variantId: string,
  quantity: number,
): TicketLine[] {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return lines.filter((line) => line.variantId !== variantId);
  }
  const next = Math.min(Math.floor(quantity), MAX_LINE_QUANTITY);
  return lines.map((line) =>
    line.variantId === variantId ? { ...line, quantity: next } : line,
  );
}

export function ticketUnits(lines: readonly TicketLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

/**
 * Líneas de una venta que superan lo disponible según los datos mostrados.
 * Es un aviso previo: la comprobación definitiva es la de SQL, con bloqueo.
 */
export function linesWithoutStock(
  lines: readonly TicketLine[],
  items: ReadonlyMap<string, CounterItem>,
  kind: CounterKind,
): string[] {
  if (kind !== 'sale') return [];
  return lines
    .filter(
      (line) => line.quantity > (items.get(line.variantId)?.available ?? 0),
    )
    .map((line) => line.variantId);
}
