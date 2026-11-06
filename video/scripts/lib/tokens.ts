// Lectura y validación de design-system/tokens.json (formato DTCG del W3C).
// Las reglas son las de design-system/anti-patterns.md que se pueden comprobar
// sin mirar un fotograma: contraste AA, colores de marca, familias, escala
// modular, rejilla, iconos y movimiento.

export const EXT = 'com.latelierdudesert.video';

export type FlatToken = {
  path: string;
  type: string | undefined;
  value: unknown;
  extensions: Record<string, unknown> | undefined;
};
export type TokenMap = ReadonlyMap<string, FlatToken>;
export type Rgba = { r: number; g: number; b: number; a: number };
export type ContrastResult = {
  fg: string;
  bg: string;
  ratio: number;
  min: number;
  ok: boolean;
  use: string;
};
export type TokenReport = {
  status: string;
  errors: string[];
  warnings: string[];
  contrast: ContrastResult[];
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function ownExtensions(node: Record<string, unknown>) {
  const all = node.$extensions;
  if (!isRecord(all)) return undefined;
  const mine = all[EXT];
  return isRecord(mine) ? mine : undefined;
}

/** Aplana el árbol: cada token por su ruta, con el `$type` heredado del grupo. */
export function flattenTokens(tree: unknown): Map<string, FlatToken> {
  const tokens = new Map<string, FlatToken>();
  const walk = (node: unknown, path: string[], inherited?: string): void => {
    if (!isRecord(node)) return;
    const type = typeof node.$type === 'string' ? node.$type : inherited;
    if ('$value' in node) {
      const key = path.join('.');
      tokens.set(key, {
        path: key,
        type,
        value: node.$value,
        extensions: ownExtensions(node),
      });
      return;
    }
    for (const [key, child] of Object.entries(node)) {
      if (!key.startsWith('$')) walk(child, [...path, key], type);
    }
  };
  walk(tree, []);
  return tokens;
}

/** Extensiones de un grupo (no de un token): `font.size`, `icon`… */
export function groupExtensions(
  tree: unknown,
  path: string,
): Record<string, unknown> | undefined {
  let node: unknown = tree;
  for (const key of path ? path.split('.') : []) {
    if (!isRecord(node)) return undefined;
    node = node[key];
  }
  return isRecord(node) ? ownExtensions(node) : undefined;
}

const ALIAS = /^\{([^{}]+)\}$/;
const INLINE_ALIAS = /\{([^{}]+)\}/g;

/** Resuelve `{ruta.del.token}` hasta un valor final. */
export function resolve(
  tokens: TokenMap,
  value: unknown,
  seen: ReadonlySet<string> = new Set(),
): unknown {
  if (typeof value !== 'string') return value;
  const match = ALIAS.exec(value);
  if (!match?.[1]) return value;
  const ref = match[1];
  if (seen.has(ref)) throw new Error(`Referencia circular en {${ref}}`);
  const token = tokens.get(ref);
  if (!token) throw new Error(`Referencia a un token que no existe: {${ref}}`);
  return resolve(tokens, token.value, new Set([...seen, ref]));
}

/** Sustituye las referencias que aparecen dentro de un texto. */
export function interpolate(tokens: TokenMap, text: string): string {
  return text.replace(INLINE_ALIAS, (_, ref: string) =>
    String(resolve(tokens, `{${ref}}`)),
  );
}

export function tokenExists(tokens: TokenMap, ref: string): boolean {
  const match = ALIAS.exec(ref);
  return Boolean(match?.[1] && tokens.has(match[1]));
}

export function parsePx(value: unknown): number {
  const match =
    typeof value === 'string' ? /^(-?\d+(?:\.\d+)?)px$/.exec(value) : null;
  if (!match?.[1])
    throw new Error(`Se esperaba una medida en px: ${String(value)}`);
  return Number(match[1]);
}

export function parseMs(value: unknown): number {
  const match =
    typeof value === 'string' ? /^(\d+(?:\.\d+)?)(ms|s)$/.exec(value) : null;
  if (!match?.[1])
    throw new Error(`Se esperaba una duración en ms o s: ${String(value)}`);
  return Number(match[1]) * (match[2] === 's' ? 1000 : 1);
}

export function parseColor(value: unknown): Rgba {
  const match =
    typeof value === 'string'
      ? /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})?$/i.exec(value)
      : null;
  if (!match?.[1] || !match[2] || !match[3]) {
    throw new Error(
      `Se esperaba un color #rrggbb o #rrggbbaa: ${String(value)}`,
    );
  }
  return {
    r: parseInt(match[1], 16),
    g: parseInt(match[2], 16),
    b: parseInt(match[3], 16),
    a: match[4] ? parseInt(match[4], 16) / 255 : 1,
  };
}

/** Mezcla un color con alfa sobre un fondo opaco, como lo pinta el vídeo. */
export function composite(top: Rgba, bottom: Rgba): Rgba {
  const mix = (t: number, b: number) => t * top.a + b * (1 - top.a);
  return {
    r: mix(top.r, bottom.r),
    g: mix(top.g, bottom.g),
    b: mix(top.b, bottom.b),
    a: 1,
  };
}

function linear(channel: number): number {
  const s = channel / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** Luminancia relativa de WCAG 2.x. */
export function luminance({ r, g, b }: Rgba): number {
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** Contraste WCAG del primer plano (con su alfa) sobre un fondo opaco. */
export function contrastRatio(fg: Rgba, bg: Rgba): number {
  const a = luminance(composite(fg, bg));
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function resolveColor(tokens: TokenMap, ref: unknown): Rgba {
  return parseColor(resolve(tokens, ref));
}

/** Contraste de una pareja; con `over`, el peor caso sobre cada color de debajo. */
export function pairContrast(
  tokens: TokenMap,
  fgRef: string,
  bgRef: string,
  over: readonly string[] = [],
): number {
  const fg = resolveColor(tokens, fgRef);
  const bg = resolveColor(tokens, bgRef);
  if (bg.a === 1) return contrastRatio(fg, bg);
  if (over.length === 0)
    throw new Error(`${bgRef} tiene transparencia: falta «over»`);
  return Math.min(
    ...over.map((under) => contrastRatio(fg, composite(bg, parseColor(under)))),
  );
}

const IMAGE_STYLE_KEYS = [
  'palette',
  'light',
  'lens',
  'texture',
  'grain',
  'negative',
] as const;

/** Bloque de estilo literal que llevan todos los prompts de imagen. */
export function buildStyleBlock(tokens: TokenMap): string {
  return IMAGE_STYLE_KEYS.map((key) => {
    const token = tokens.get(`image.${key}`);
    if (typeof token?.value !== 'string') throw new Error(`Falta image.${key}`);
    return interpolate(tokens, token.value);
  }).join('\n');
}

function childrenOf(tokens: TokenMap, prefix: string): FlatToken[] {
  return [...tokens.values()].filter((t) => t.path.startsWith(`${prefix}.`));
}

function sameRgb(a: Rgba, b: Rgba): boolean {
  return a.r === b.r && a.g === b.g && a.b === b.b;
}

export function checkTokens(tree: unknown): TokenReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const contrast: ContrastResult[] = [];
  const tokens = flattenTokens(tree);
  const guard = (rule: string, check: () => void) => {
    try {
      check();
    } catch (error) {
      errors.push(
        `${rule}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  const root = groupExtensions(tree, '');
  const status = typeof root?.status === 'string' ? root.status : '';
  if (status !== 'propuesta' && status !== 'aprobado') {
    errors.push(
      'Estado: $extensions.status debe ser «propuesta» o «aprobado».',
    );
  } else if (status === 'propuesta') {
    warnings.push('Los tokens están en propuesta: falta tu aprobación.');
  }

  // Referencias: todas deben existir.
  for (const token of tokens.values()) {
    guard(`Referencia en ${token.path}`, () => {
      const values = isRecord(token.value)
        ? Object.values(token.value)
        : [token.value];
      for (const value of values) resolve(tokens, value);
    });
  }

  // Color: 3 o 4 de marca; los roles solo usan esos colores (con alfa si hace falta).
  const brand = childrenOf(tokens, 'color.brand');
  if (brand.length < 3 || brand.length > 4) {
    errors.push(
      `Color: hay ${brand.length} colores de marca; deben ser 3 o 4.`,
    );
  }
  guard('Color', () => {
    const palette = brand.map((t) => parseColor(t.value));
    for (const role of childrenOf(tokens, 'color.role')) {
      if (!palette.some((c) => sameRgb(c, resolveColor(tokens, role.value)))) {
        errors.push(`Color: ${role.path} no es un color de marca.`);
      }
    }
  });

  // Contraste.
  const pairs = Array.isArray(root?.contrast) ? root.contrast : [];
  if (pairs.length === 0)
    errors.push('Contraste: no hay parejas que comprobar.');
  for (const pair of pairs) {
    if (
      !isRecord(pair) ||
      typeof pair.fg !== 'string' ||
      typeof pair.bg !== 'string'
    ) {
      errors.push('Contraste: pareja mal formada.');
      continue;
    }
    const { fg, bg } = pair;
    const min = typeof pair.min === 'number' ? pair.min : 4.5;
    const over = Array.isArray(pair.over) ? pair.over.map(String) : [];
    guard(`Contraste ${fg} / ${bg}`, () => {
      const ratio = pairContrast(tokens, fg, bg, over);
      contrast.push({
        fg,
        bg,
        ratio,
        min,
        ok: ratio >= min,
        use: String(pair.use ?? ''),
      });
      if (ratio < min) {
        errors.push(
          `Contraste: ${fg} sobre ${bg} da ${ratio.toFixed(2)}:1 (< ${min}:1).`,
        );
      }
    });
  }

  // Tipografía: como máximo dos familias, de Fontsource; escala modular explícita.
  const families = childrenOf(tokens, 'font.family');
  if (families.length < 1 || families.length > 2) {
    errors.push(`Tipografía: hay ${families.length} familias; como máximo 2.`);
  }
  for (const family of families) {
    const npm = family.extensions?.npm;
    if (typeof npm !== 'string' || !npm.startsWith('@fontsource/')) {
      errors.push(
        `Tipografía: ${family.path} debe instalarse con @fontsource (sin CDN).`,
      );
    }
  }
  guard('Escala tipográfica', () => {
    const scale = groupExtensions(tree, 'font.size');
    const base = Number(scale?.base);
    const ratio = Number(scale?.ratio);
    if (!(base > 0 && ratio > 1))
      throw new Error('falta base o ratio en font.size');
    const steps = childrenOf(tokens, 'font.size').map((t) => ({
      path: t.path,
      step: Number(t.extensions?.step),
      px: parsePx(t.value),
    }));
    for (const { path, step, px } of steps) {
      const expected = Math.round(base * ratio ** step);
      if (!Number.isInteger(step) || Math.abs(px - expected) > 1) {
        errors.push(
          `Escala tipográfica: ${path} = ${px}px; el paso ${step} da ${expected}px.`,
        );
      }
    }
    const sorted = [...steps].sort((a, b) => a.step - b.step);
    if (sorted.some((s, i) => i > 0 && s.px <= (sorted[i - 1]?.px ?? 0))) {
      errors.push('Escala tipográfica: los tamaños no crecen con el paso.');
    }
  });
  for (const style of childrenOf(tokens, 'typography')) {
    const value = isRecord(style.value) ? style.value : {};
    const family = String(value.fontFamily ?? '');
    const size = String(value.fontSize ?? '');
    if (
      !family.startsWith('{font.family.') ||
      !size.startsWith('{font.size.')
    ) {
      errors.push(
        `Tipografía: ${style.path} debe usar una familia y un tamaño de la escala.`,
      );
    }
  }

  // Rejilla: 12 columnas de ancho entero en cada formato.
  for (const format of ['vertical', 'horizontal']) {
    guard(`Rejilla ${format}`, () => {
      const get = (key: string) => tokens.get(`grid.${format}.${key}`)?.value;
      const columns = Number(get('columns'));
      const width = parsePx(get('width'));
      const column =
        (width -
          2 * parsePx(get('margin')) -
          (columns - 1) * parsePx(get('gutter'))) /
        columns;
      if (columns !== 12)
        errors.push(
          `Rejilla: ${format} tiene ${columns} columnas; deben ser 12.`,
        );
      if (!Number.isInteger(column) || column <= 0) {
        errors.push(
          `Rejilla: ${format} da columnas de ${column}px; deben ser enteras.`,
        );
      }
    });
  }

  // Iconos: Lucide, rejilla de 24, tamaño múltiplo de la rejilla y lista de prohibidos.
  guard('Iconos', () => {
    const icon = groupExtensions(tree, 'icon');
    if (icon?.library !== 'lucide')
      errors.push('Iconos: la librería debe ser Lucide.');
    if (!Array.isArray(icon?.forbidden) || icon.forbidden.length === 0) {
      errors.push('Iconos: falta la lista de iconos prohibidos.');
    }
    const grid = parsePx(tokens.get('icon.grid')?.value);
    const size = parsePx(tokens.get('icon.size')?.value);
    const stroke = Number(tokens.get('icon.stroke-width')?.value);
    if (grid !== 24)
      errors.push(`Iconos: la rejilla es ${grid}px; debe ser 24px.`);
    if (size % grid !== 0)
      errors.push(`Iconos: ${size}px no es múltiplo de la rejilla.`);
    if (!(stroke > 0 && stroke <= 3))
      errors.push(`Iconos: trazo ${stroke} fuera de (0, 3].`);
  });

  // Movimiento: duraciones de 300 a 700 ms y curvas sin rebote ni sobrepaso.
  const durations = childrenOf(tokens, 'motion.duration');
  if (durations.length === 0) errors.push('Movimiento: no hay duraciones.');
  for (const duration of durations) {
    guard(`Movimiento ${duration.path}`, () => {
      const ms = parseMs(duration.value);
      if (ms < 300 || ms > 700) {
        errors.push(
          `Movimiento: ${duration.path} = ${ms}ms; debe estar entre 300 y 700.`,
        );
      }
    });
  }
  for (const easing of childrenOf(tokens, 'motion.easing')) {
    const curve = easing.value;
    const valid =
      Array.isArray(curve) &&
      curve.length === 4 &&
      curve.every((n) => typeof n === 'number' && n >= 0 && n <= 1);
    if (!valid) {
      errors.push(
        `Movimiento: ${easing.path} debe ser [x1, y1, x2, y2] con los cuatro entre 0 y 1 (sin rebote).`,
      );
    }
  }
  const budget = Number(tokens.get('motion.budget.per-scene')?.value);
  if (!(Number.isInteger(budget) && budget >= 1 && budget <= 3)) {
    errors.push('Movimiento: motion.budget.per-scene debe ser 1, 2 o 3.');
  }

  // Texto en pantalla y estilo de imagen.
  for (const key of ['text.max-words', 'text.reading.words-per-second']) {
    if (!(Number(tokens.get(key)?.value) > 0))
      errors.push(`Texto: falta ${key}.`);
  }
  guard('Texto', () => parseMs(tokens.get('text.reading.min-hold')?.value));
  guard('Estilo de imagen', () => buildStyleBlock(tokens));

  return { status, errors, warnings, contrast };
}
