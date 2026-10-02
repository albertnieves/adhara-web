import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrastRatio, parseColor } from '@/modules/design/domain/contrast';
import {
  catalogVariables,
  fixedPairs,
  matrixPairs,
  TONES,
} from '@/modules/design/domain/tokens';
import type { ToneId } from '@/modules/design/domain/tokens';

/*
 * Criterio 2 de la Fase 2: todas las combinaciones permitidas de tokens
 * cumplen WCAG 2.2 AA en el tono claro y en los oscuros. Lee los tokens de
 * src/app/globals.css, así que no hay una segunda copia de los valores; la
 * matriz es la de src/modules/design, la misma que enseña /admin/diseno.
 */

const css = readFileSync(
  new URL('../../src/app/globals.css', import.meta.url),
  'utf8',
);

/** Contenido del bloque que abre `opener` (llaves equilibradas). */
function block(opener: string): string {
  const start = css.indexOf(opener);
  if (start === -1) throw new Error(`No está el bloque ${opener}`);
  let depth = 0;
  for (let i = css.indexOf('{', start); i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}' && --depth === 0)
      return css.slice(css.indexOf('{', start) + 1, i);
  }
  throw new Error(`Bloque sin cerrar: ${opener}`);
}

function colors(source: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const [, name, value] of source.matchAll(
    /--color-([a-z0-9-]+):\s*([^;]+);/g,
  ))
    map.set(name!, value!.trim());
  return map;
}

const theme = colors(block('@theme static {'));
const darkTones = colors(block("[data-tone='dark'],"));
const TONE_COLORS: Record<ToneId, Map<string, string>> = {
  light: new Map(),
  dark: darkTones,
  oud: new Map([...darkTones, ...colors(block("[data-tone='oud'] {"))]),
  indigo: new Map([...darkTones, ...colors(block("[data-tone='indigo'] {"))]),
  forest: new Map([...darkTones, ...colors(block("[data-tone='forest'] {"))]),
};

function resolve(name: string, tone: Map<string, string>, depth = 0): string {
  if (depth > 10) throw new Error(`Referencia circular en --color-${name}`);
  const value = tone.get(name) ?? theme.get(name);
  if (!value) throw new Error(`No existe --color-${name}`);
  const ref = value.match(/^var\(--color-([a-z0-9-]+)\)$/);
  if (ref) return resolve(ref[1]!, tone, depth + 1);
  if (!/^#[0-9a-f]{6}$/i.test(value))
    throw new Error(`--color-${name} debe ser un hexadecimal: ${value}`);
  return value;
}

function contrast(fg: string, bg: string, tone: Map<string, string>) {
  return contrastRatio(
    parseColor(resolve(fg, tone))!,
    parseColor(resolve(bg, tone))!,
  );
}

describe('contraste de los tokens (WCAG 2.2 AA)', () => {
  for (const { id, label } of TONES) {
    it(`tono ${label.toLowerCase()}: texto 4,5:1 y elementos gráficos 3:1`, () => {
      const tone = TONE_COLORS[id];
      const failures = [...matrixPairs(id), ...fixedPairs(id)]
        .map((pair) => ({ ...pair, ratio: contrast(pair.fg, pair.bg, tone) }))
        .filter(({ ratio, min }) => ratio < min)
        .map(
          ({ fg, bg, min, ratio }) =>
            `${fg} sobre ${bg}: ${ratio.toFixed(2)} < ${min}`,
        );
      expect(failures).toEqual([]);
    });
  }

  it('la niebla no sirve como texto sobre fondos claros', () => {
    // Por eso no es un token de texto: solo adornos o tonos oscuros.
    expect(contrast('mist', 'surface', TONE_COLORS.light)).toBeLessThan(4.5);
    expect(
      contrast('fg-muted', 'surface', TONE_COLORS.dark),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it('el foco se ve con 2 px', () => {
    expect(css).toMatch(
      /:focus-visible\s*{\s*outline:\s*2px solid var\(--color-focus\)/,
    );
  });
});

describe('catálogo de tokens (DS-03)', () => {
  it('tiene exactamente los tokens que declara globals.css', () => {
    // Declaraciones al principio de línea; las subpropiedades de Tailwind
    // (--text-2xs--line-height) van con su token.
    const declared = new Set(
      [...css.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)]
        .map((m) => m[1]!)
        .filter((name) => !name.slice(2).includes('--')),
    );
    const catalog = new Set(catalogVariables());
    expect([...declared].filter((v) => !catalog.has(v))).toEqual([]);
    expect([...catalog].filter((v) => !declared.has(v))).toEqual([]);
    expect(catalog.size).toBe(catalogVariables().length);
  });

  it('lee los colores en hexadecimal y los que calcula el navegador', () => {
    expect(parseColor('#F5F1EA')).toEqual([245, 241, 234]);
    expect(parseColor(' #0d0c0b ')).toEqual([13, 12, 11]);
    expect(parseColor('rgb(21, 19, 17)')).toEqual([21, 19, 17]);
    expect(parseColor('var(--color-ink)')).toBeNull();
    expect(parseColor('#fff')).toBeNull();
    const black = parseColor('#000000')!;
    const white = parseColor('#ffffff')!;
    expect(contrastRatio(black, white)).toBeCloseTo(21, 5);
    expect(contrastRatio(white, white)).toBe(1);
  });
});
