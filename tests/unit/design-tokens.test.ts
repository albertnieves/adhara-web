import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/*
 * Criterio 2 de la Fase 2: todas las combinaciones permitidas de tokens
 * cumplen WCAG 2.2 AA en el tono claro y en los oscuros. Lee los tokens de
 * src/app/globals.css, así que no hay una segunda copia de los valores.
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
const TONES: Record<string, Map<string, string>> = {
  claro: new Map(),
  oscuro: darkTones,
  oud: new Map([...darkTones, ...colors(block("[data-tone='oud'] {"))]),
  indigo: new Map([...darkTones, ...colors(block("[data-tone='indigo'] {"))]),
  bosque: new Map([...darkTones, ...colors(block("[data-tone='forest'] {"))]),
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

function luminance(hex: string) {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const SURFACES = ['surface', 'surface-raised', 'surface-sunken'];
/** Texto: 4,5:1 (WCAG 1.4.3). */
const TEXT = ['fg', 'fg-muted', 'accent-fg', 'danger', 'success', 'warning'];
/** Bordes de controles y foco: 3:1 en cualquier superficie (WCAG 1.4.11). */
const NON_TEXT = ['border-strong', 'focus'];
/**
 * El dorado de acento marca estados (activo, seleccionado) solo sobre la
 * superficie y la elevada; sobre arena o escenario es adorno (2,7–2,9:1).
 */
const ACCENT_SURFACES = ['surface', 'surface-raised'];

type Pair = { fg: string; bg: string; min: number };

function pairsFor(toneName: string): Pair[] {
  const bgs =
    toneName === 'claro' ? [...SURFACES, 'stage', 'sand'] : [...SURFACES];
  return [
    ...bgs.flatMap((bg) => TEXT.map((fg) => ({ fg, bg, min: 4.5 }))),
    ...bgs.flatMap((bg) => NON_TEXT.map((fg) => ({ fg, bg, min: 3 }))),
    ...ACCENT_SURFACES.map((bg) => ({ fg: 'accent', bg, min: 3 })),
    { fg: 'fg-inverse', bg: 'fg', min: 4.5 },
  ];
}

describe('contraste de los tokens (WCAG 2.2 AA)', () => {
  for (const [toneName, tone] of Object.entries(TONES)) {
    it(`tono ${toneName}: texto 4,5:1 y elementos gráficos 3:1`, () => {
      const failures = pairsFor(toneName)
        .map(({ fg, bg, min }) => ({
          fg,
          bg,
          min,
          ratio: contrast(resolve(fg, tone), resolve(bg, tone)),
        }))
        .filter(({ ratio, min }) => ratio < min)
        .map(
          ({ fg, bg, min, ratio }) =>
            `${fg} sobre ${bg}: ${ratio.toFixed(2)} < ${min}`,
        );
      expect(failures).toEqual([]);
    });
  }

  it('estados sobre su fondo suave y botones principales', () => {
    const light = TONES.claro!;
    const checks: [string, string][] = [
      ['danger', 'danger-soft'],
      ['success', 'success-soft'],
      ['warning', 'warning-soft'],
      ['ivory', 'ink'],
      ['ivory', 'ink-soft'],
      ['ink', 'gold-soft'],
    ];
    const failures = checks
      .map(
        ([fg, bg]) =>
          [fg, bg, contrast(resolve(fg, light), resolve(bg, light))] as const,
      )
      .filter(([, , ratio]) => ratio < 4.5)
      .map(([fg, bg, ratio]) => `${fg} sobre ${bg}: ${ratio.toFixed(2)}`);
    expect(failures).toEqual([]);
  });

  it('la niebla no sirve como texto sobre fondos claros', () => {
    // Por eso no es un token de texto: solo adornos o tonos oscuros.
    expect(
      contrast(resolve('mist', TONES.claro!), resolve('surface', TONES.claro!)),
    ).toBeLessThan(4.5);
    expect(
      contrast(
        resolve('fg-muted', TONES.oscuro!),
        resolve('surface', TONES.oscuro!),
      ),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it('el foco se ve con 2 px', () => {
    expect(css).toMatch(
      /:focus-visible\s*{\s*outline:\s*2px solid var\(--color-focus\)/,
    );
  });
});
