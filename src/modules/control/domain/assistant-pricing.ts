/**
 * Precios de la API de Anthropic en dólares por millón de tokens, para
 * estimar el coste del asistente en la consola. Fuente: tabla de modelos de
 * la API de Anthropic consultada el 06/10/2026. La lectura de caché es 0,1 ×
 * la entrada salvo donde la tabla da otro precio (Opus 5.5, Sonnet 5.5 y
 * Fable 5.1). El registro de uso no guarda la escritura de caché, así que la
 * estimación queda algo por debajo del coste real.
 */
export const PRICING_SOURCE =
  'Precios de la API de Anthropic (tabla de modelos del 06/10/2026), en USD por millón de tokens.';

export type ModelPrice = {
  inputUsd: number;
  outputUsd: number;
  cacheReadUsd: number;
};

export const MODEL_PRICES: Readonly<Record<string, ModelPrice>> = {
  'claude-opus-5-5': { inputUsd: 4, outputUsd: 20, cacheReadUsd: 0.2 },
  'claude-opus-5': { inputUsd: 5, outputUsd: 25, cacheReadUsd: 0.5 },
  'claude-opus-4-8': { inputUsd: 5, outputUsd: 25, cacheReadUsd: 0.5 },
  'claude-sonnet-5-5': { inputUsd: 2, outputUsd: 10, cacheReadUsd: 0.2 },
  'claude-fable-5-1': { inputUsd: 10, outputUsd: 50, cacheReadUsd: 0.25 },
  'claude-haiku-5-5': { inputUsd: 0.1, outputUsd: 0.5, cacheReadUsd: 0.01 },
};

export type TokenUsage = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
};

/**
 * Coste estimado en micro-dólares enteros (1 USD = 1 000 000), o null si el
 * modelo no está en la tabla (no se inventa un precio).
 */
export function usageCostMicroUsd(usage: TokenUsage): number | null {
  const price = MODEL_PRICES[usage.model];
  if (!price) return null;
  // Precio por millón de tokens × tokens / 10^6 × 10^6 micro-dólares = precio × tokens.
  return Math.round(
    price.inputUsd * usage.inputTokens +
      price.outputUsd * usage.outputTokens +
      price.cacheReadUsd * usage.cacheReadTokens,
  );
}

/** 1234567 → «1,23 $». */
export function formatMicroUsd(micro: number | null): string {
  if (micro === null) return '—';
  return `${(micro / 1_000_000).toLocaleString('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: micro > 0 && micro < 10_000 ? 4 : 2,
  })} $`;
}
