import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PERMANENT_COLOR_EXCEPTIONS,
  PERMANENT_TEXT_SIZE_EXCEPTIONS,
} from './design-guard-exceptions';

/*
 * Criterios 1 y 3 de la Fase 2: los componentes solo usan colores de los
 * tokens y una escala tipográfica cerrada. La escena 3D (modules/unboxing)
 * queda fuera; el resto de excepciones está en design-guard-exceptions.ts.
 */

const ROOT = new URL('../../', import.meta.url).pathname;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) ? [relative(ROOT, path)] : [];
  });
}

const FILES = sourceFiles(join(ROOT, 'src')).filter(
  (file) =>
    !file.startsWith('src/modules/unboxing/') &&
    !file.endsWith('database.types.ts'),
);

const PALETTE =
  'white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
const RULES = {
  color: [
    /#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?\b/g,
    /\b(?:rgba?|hsla?)\(/g,
    new RegExp(
      `\\b(?:bg|text|border|ring|fill|stroke|from|to|via|outline|decoration|divide|placeholder|shadow)-(?:${PALETTE})(?:-\\d+)?\\b`,
      'g',
    ),
    /-\[#/g,
  ],
  /** Niebla como texto: 2,3:1 sobre marfil. Se usa text-fg-muted. */
  niebla: [/\btext-mist\b/g],
  /** Cualquier tamaño arbitrario: px, rem, pt, clamp()… (los colores van aparte). */
  tamano: [/\btext-\[(?!#)/g],
  tracking: [/\btracking-\[/g],
};

/** Clases de componente anteriores a la biblioteca (criterio 4, DS-11). */
const LEGACY_CLASSES = [
  'btn',
  'btn-primary',
  'btn-outline',
  'panel-btn',
  'panel-btn-primary',
  'panel-btn-sm',
  'input',
  'panel-card',
  'field',
  'eyebrow',
];

/**
 * Colores de la capa de paleta: fuera de los tokens se usan los semánticos
 * (fg, surface, border, accent…), que cambian con el tono. Solo se permite
 * `stage`, el fondo de la escena de producto.
 */
const PALETTE_TOKENS =
  'ivory|paper|sand|ink|ink-soft|night|night-raised|smoke|mist|line|line-strong|line-dark|line-strong-dark|gold|gold-deep|gold-soft|oud|indigo-night|forest';
const PALETTE_UTILITY = new RegExp(
  `(?<![\\w-])(?:[a-z0-9-]+:)*(?:bg|text|border|border-[tblrxy]|ring|fill|stroke|from|to|via|outline|decoration|divide|placeholder|shadow|accent|caret)-(?:${PALETTE_TOKENS})(?:/\\d+)?(?![\\w-])`,
  'g',
);

/** Clases escritas en `className` (literal o plantilla) de cada archivo. */
function classNames(text: string) {
  return [
    ...text.matchAll(/className="([^"]*)"/g),
    ...text.matchAll(/className=\{`([^`]*)`\}/g),
  ].flatMap((m) => m[1]!.split(/\s+/).filter(Boolean));
}

function counts(patterns: RegExp[]) {
  const result: Record<string, number> = {};
  for (const file of FILES) {
    const text = readFileSync(join(ROOT, file), 'utf8');
    const n = patterns.reduce(
      (sum, pattern) => sum + (text.match(pattern)?.length ?? 0),
      0,
    );
    if (n > 0) result[file] = n;
  }
  return result;
}

/** Los usos deben coincidir exactamente con la lista: ni más ni menos. */
function compare(
  actual: Record<string, number>,
  allowed: Record<string, number>,
) {
  const files = new Set([...Object.keys(actual), ...Object.keys(allowed)]);
  return [...files]
    .filter((file) => (actual[file] ?? 0) !== (allowed[file] ?? 0))
    .map(
      (file) =>
        `${file}: ${actual[file] ?? 0} usos (la lista dice ${allowed[file] ?? 0})`,
    );
}

describe('guardas del sistema de diseño', () => {
  it('sin colores fuera de los tokens (criterio 1)', () => {
    const permanent = Object.fromEntries(
      Object.entries(PERMANENT_COLOR_EXCEPTIONS).map(([f, e]) => [f, e.count]),
    );
    expect(compare(counts(RULES.color), permanent)).toEqual([]);
  });

  it('globals.css solo escribe colores al definir tokens', () => {
    const css = readFileSync(join(ROOT, 'src/app/globals.css'), 'utf8');
    const loose = css
      .split('\n')
      .filter(
        (line) =>
          (/#[0-9a-fA-F]{3,8}\b/.test(line) || /\brgba?\(/.test(line)) &&
          !/^\s*--color-[a-z0-9-]+:\s*#[0-9a-fA-F]{6};/.test(line) &&
          !line.includes('data:image/svg+xml'),
      );
    expect(loose).toEqual([]);
  });

  it('sin clases sueltas del sistema anterior (criterio 4)', () => {
    const legacy = new Set(LEGACY_CLASSES);
    const found = FILES.flatMap((file) =>
      classNames(readFileSync(join(ROOT, file), 'utf8'))
        .filter((name) => legacy.has(name))
        .map((name) => `${file}: .${name}`),
    );
    expect(found).toEqual([]);
    const css = readFileSync(join(ROOT, 'src/app/globals.css'), 'utf8');
    const defined = LEGACY_CLASSES.filter((name) =>
      new RegExp(`\\.${name}(?![\\w-])`).test(css),
    );
    expect(defined).toEqual([]);
  });

  it('solo colores semánticos fuera de los tokens (DS-10 y DS-11)', () => {
    expect(counts([PALETTE_UTILITY])).toEqual({});
  });

  it('la niebla no se usa como color de texto', () => {
    expect(counts(RULES.niebla)).toEqual({});
  });

  it('tamaños de letra de la escala (criterio 3)', () => {
    const permanent = Object.fromEntries(
      Object.entries(PERMANENT_TEXT_SIZE_EXCEPTIONS).map(([f, e]) => [
        f,
        e.count,
      ]),
    );
    expect(compare(counts(RULES.tamano), permanent)).toEqual([]);
  });

  it('espaciados de letra de la escala (criterio 3)', () => {
    expect(counts(RULES.tracking)).toEqual({});
  });

  it('globals.css usa la escala: espaciados con tokens y nada por debajo de 11 px', () => {
    const css = readFileSync(join(ROOT, 'src/app/globals.css'), 'utf8');
    const spacing = [...css.matchAll(/letter-spacing:\s*([^;]+);/g)]
      .map((m) => m[1]!.trim())
      .filter((value) => !/^var\(--tracking-[a-z-]+\)$/.test(value));
    expect(spacing).toEqual([]);
    const tooSmall = [...css.matchAll(/font-size:\s*([^;]+);/g)]
      .map((m) => m[1]!.trim())
      .filter((value) => {
        const rem = value.match(/^([0-9.]+)rem$/);
        const px = value.match(/^([0-9.]+)px$/);
        if (rem) return Number(rem[1]) < 0.6875;
        if (px) return Number(px[1]) < 11;
        return !/^var\(--text-[a-z0-9-]+\)$/.test(value);
      });
    expect(tooSmall).toEqual([]);
  });
});
