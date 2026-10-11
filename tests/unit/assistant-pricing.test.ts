import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  MODEL_PRICES,
  formatMicroUsd,
  usageCostMicroUsd,
} from '@/modules/control';

// El modelo del asistente se declara en un módulo solo de servidor.
const ASSISTANT_MODEL = /ASSISTANT_MODEL = '([^']+)'/.exec(
  readFileSync(
    new URL('../../src/modules/assistant/server/claude.ts', import.meta.url),
    'utf8',
  ),
)?.[1];

describe('coste estimado del asistente', () => {
  it('el modelo del asistente tiene precio', () => {
    expect(ASSISTANT_MODEL).toBeDefined();
    expect(MODEL_PRICES[ASSISTANT_MODEL!]).toBeDefined();
  });

  it('suma entrada, salida y lectura de caché de Opus 5.5', () => {
    // 1 M de entrada (4 $) + 0,5 M de salida (10 $) + 2 M de caché (0,40 $).
    expect(
      usageCostMicroUsd({
        model: 'claude-opus-5-5',
        inputTokens: 1_000_000,
        outputTokens: 500_000,
        cacheReadTokens: 2_000_000,
      }),
    ).toBe(14_400_000);
  });

  it('sin precio para un modelo desconocido', () => {
    expect(
      usageCostMicroUsd({
        model: 'modelo-inventado',
        inputTokens: 10,
        outputTokens: 10,
        cacheReadTokens: 0,
      }),
    ).toBeNull();
  });

  it('formatea en dólares', () => {
    expect(formatMicroUsd(14_400_000)).toBe('14,40 $');
    expect(formatMicroUsd(1_200)).toBe('0,0012 $');
    expect(formatMicroUsd(null)).toBe('—');
  });
});
