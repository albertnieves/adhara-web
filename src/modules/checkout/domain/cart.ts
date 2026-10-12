/*
 * Cesta de la tienda en una cookie técnica (DECISIONS §136): solo formatos y
 * cantidades. Ni precios ni nombres: el servidor los vuelve a leer del
 * catálogo y la base los vuelve a validar al crear el pedido.
 */

export const CART_COOKIE = 'atelier_cesta';
/** Evento del navegador tras cambiar la cesta (la cabecera vuelve a contar). */
export const CART_EVENT = 'atelier:cesta';
/** 30 días: la cesta sigue ahí si vuelves otro día. */
export const CART_MAX_AGE = 60 * 60 * 24 * 30;
export const MAX_CART_LINES = 20;
/** Unidades de un mismo formato por pedido web. */
export const MAX_LINE_QUANTITY = 10;

export type CartLine = { variantId: string; quantity: number };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function isVariantId(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

/** «id:cantidad.id:cantidad»; lo que no se entiende se ignora. */
export function parseCart(value: string | null | undefined): CartLine[] {
  if (!value) return [];
  const lines: CartLine[] = [];
  for (const part of value.split('.')) {
    const [variantId, raw] = part.split(':');
    const quantity = Number(raw);
    if (!isVariantId(variantId) || !Number.isInteger(quantity) || quantity < 1)
      continue;
    const existing = lines.find((line) => line.variantId === variantId);
    if (existing) {
      existing.quantity = Math.min(
        existing.quantity + quantity,
        MAX_LINE_QUANTITY,
      );
    } else if (lines.length < MAX_CART_LINES) {
      lines.push({
        variantId,
        quantity: Math.min(quantity, MAX_LINE_QUANTITY),
      });
    }
  }
  return lines;
}

export function serializeCart(lines: readonly CartLine[]): string {
  return lines.map((line) => `${line.variantId}:${line.quantity}`).join('.');
}

export function cartCount(lines: readonly CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

export type AddResult =
  | { ok: true; lines: CartLine[] }
  | { ok: false; reason: 'full' | 'max_quantity' };

/** Suma una unidad (o `quantity`) sin pasar de los topes. */
export function addToCart(
  lines: readonly CartLine[],
  variantId: string,
  quantity = 1,
): AddResult {
  const existing = lines.find((line) => line.variantId === variantId);
  if (existing) {
    if (existing.quantity >= MAX_LINE_QUANTITY)
      return { ok: false, reason: 'max_quantity' };
    return {
      ok: true,
      lines: lines.map((line) =>
        line.variantId === variantId
          ? {
              ...line,
              quantity: Math.min(line.quantity + quantity, MAX_LINE_QUANTITY),
            }
          : line,
      ),
    };
  }
  if (lines.length >= MAX_CART_LINES) return { ok: false, reason: 'full' };
  return {
    ok: true,
    lines: [
      ...lines,
      {
        variantId,
        quantity: Math.min(Math.max(quantity, 1), MAX_LINE_QUANTITY),
      },
    ],
  };
}

/** Cambia la cantidad; 0 quita el formato de la cesta. */
export function setLineQuantity(
  lines: readonly CartLine[],
  variantId: string,
  quantity: number,
): CartLine[] {
  const clamped = Math.min(
    Math.max(Math.trunc(quantity), 0),
    MAX_LINE_QUANTITY,
  );
  return clamped === 0
    ? lines.filter((line) => line.variantId !== variantId)
    : lines.map((line) =>
        line.variantId === variantId ? { ...line, quantity: clamped } : line,
      );
}
