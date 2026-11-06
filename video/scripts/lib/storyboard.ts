// Forma y reglas de storyboard/<slug>.json, la fuente de verdad de duraciones
// y textos del resto del flujo.
import type { TokenMap } from './tokens.ts';
import {
  flattenTokens,
  groupExtensions,
  isRecord,
  parseMs,
  parsePx,
} from './tokens.ts';

export const FORMATS = ['vertical', 'horizontal'] as const;
export type FormatId = (typeof FORMATS)[number];
const ALIGNS = ['start', 'end', 'center'] as const;
const SIDES = ['start', 'end'] as const;
const SOURCES = ['image-to-video', 'motion-2d', 'three'] as const;
const CLAIM_TARGETS = ['figure', 'statement'] as const;
const CLAIM_STATUS = ['needs_source', 'sourced'] as const;
const MOTION_TARGETS = [
  'label',
  'figure',
  'statement',
  'icon',
  'logo',
  'camera',
] as const;
const MOTION_TYPES = ['rise', 'fade', 'drift'] as const;
const TRANSITIONS = ['cut', 'dissolve', 'fade-to-background'] as const;
/** LTX genera clips de 4 a 8 s por fotograma clave. */
export const IMAGE_TO_VIDEO_SECONDS = { min: 4, max: 8 } as const;

export type Claim = {
  id: string;
  text: string;
  appliesTo: (typeof CLAIM_TARGETS)[number];
  status: (typeof CLAIM_STATUS)[number];
  source: string | null;
};
export type Motion = {
  target: (typeof MOTION_TARGETS)[number];
  type: (typeof MOTION_TYPES)[number];
  duration: string;
  easing: string;
  purpose: string;
};
export type Transition = {
  type: (typeof TRANSITIONS)[number];
  duration: string | null;
  easing: string | null;
};
export type Layout = { text: [number, number]; focal: (typeof SIDES)[number] };
export type Scene = {
  id: string;
  title: string;
  objective: string;
  durationSeconds: number;
  onScreen: {
    label: string;
    figure: string | null;
    statement: string;
    align: (typeof ALIGNS)[number];
  };
  claims: Claim[];
  visual: {
    source: (typeof SOURCES)[number];
    reference: string;
    camera: string;
    prompt: string;
  };
  layout: Record<FormatId, Layout>;
  icon: string | null;
  signoff: { logo: boolean; caption: string } | null;
  motion: Motion[];
  transitionOut: Transition | null;
  audio: { music: string; sfx: string | null };
};
export type Storyboard = {
  slug: string;
  status: 'propuesta' | 'aprobado';
  title: string;
  brief: string;
  locale: 'es' | 'ca' | 'en';
  spine: { job: string; audience: string; cta: string };
  fps: number;
  formats: Array<{ id: FormatId; width: number; height: number }>;
  voiceover: string | null;
  scenes: Scene[];
};
export type StoryboardReport = {
  slug: string;
  status: string;
  totalSeconds: number;
  scenes: number;
  errors: string[];
  warnings: string[];
};
export type CheckOptions = {
  /** Nombre esperado por el archivo (`storyboard/<slug>.json`). */
  slug: string;
  /** Si se da, comprueba que el icono existe en Lucide. */
  iconExists?: (name: string) => boolean;
};

type Obj = Record<string, unknown>;

/** Lector que acumula los errores de forma con su ruta. */
function reader(errors: string[]) {
  const obj = (value: unknown, at: string): Obj => {
    if (isRecord(value)) return value;
    errors.push(`${at}: se esperaba un objeto.`);
    return {};
  };
  const str = (o: Obj, key: string, at: string): string => {
    const value = o[key];
    if (typeof value === 'string' && value.trim()) return value;
    errors.push(`${at}.${key}: se esperaba un texto.`);
    return '';
  };
  const optStr = (o: Obj, key: string, at: string): string | null => {
    const value = o[key];
    if (value === null) return null;
    if (typeof value === 'string' && value.trim()) return value;
    errors.push(`${at}.${key}: se esperaba un texto o null.`);
    return null;
  };
  const num = (o: Obj, key: string, at: string): number => {
    const value = o[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    errors.push(`${at}.${key}: se esperaba un número.`);
    return 0;
  };
  const oneOf = <T extends string>(
    o: Obj,
    key: string,
    at: string,
    options: readonly T[],
  ): T => {
    const value = o[key];
    if (
      typeof value === 'string' &&
      (options as readonly string[]).includes(value)
    ) {
      return value as T;
    }
    errors.push(
      `${at}.${key}: debe ser ${options.map((v) => `«${v}»`).join(', ')}.`,
    );
    return options[0] as T;
  };
  const list = (o: Obj, key: string, at: string): unknown[] => {
    const value = o[key];
    if (Array.isArray(value)) return value;
    errors.push(`${at}.${key}: se esperaba una lista.`);
    return [];
  };
  return { obj, str, optStr, num, oneOf, list };
}

function parseScene(raw: unknown, at: string, errors: string[]): Scene {
  const r = reader(errors);
  const s = r.obj(raw, at);
  const onScreen = r.obj(s.onScreen, `${at}.onScreen`);
  const visual = r.obj(s.visual, `${at}.visual`);
  const layout = r.obj(s.layout, `${at}.layout`);
  const audio = r.obj(s.audio, `${at}.audio`);
  const parseLayout = (format: FormatId): Layout => {
    const where = `${at}.layout.${format}`;
    const l = r.obj(layout[format], where);
    const text = Array.isArray(l.text) ? l.text : [];
    const [start, end] = text;
    if (
      text.length !== 2 ||
      !Number.isInteger(start) ||
      !Number.isInteger(end)
    ) {
      errors.push(`${where}.text: se esperaban dos columnas [inicio, fin].`);
    }
    return {
      text: [Number(start), Number(end)],
      focal: r.oneOf(l, 'focal', where, SIDES),
    };
  };
  const signoff = s.signoff === null ? null : r.obj(s.signoff, `${at}.signoff`);
  const transition =
    s.transitionOut === null
      ? null
      : r.obj(s.transitionOut, `${at}.transitionOut`);
  return {
    id: r.str(s, 'id', at),
    title: r.str(s, 'title', at),
    objective: r.str(s, 'objective', at),
    durationSeconds: r.num(s, 'durationSeconds', at),
    onScreen: {
      label: r.str(onScreen, 'label', `${at}.onScreen`),
      figure: r.optStr(onScreen, 'figure', `${at}.onScreen`),
      statement: r.str(onScreen, 'statement', `${at}.onScreen`),
      align: r.oneOf(onScreen, 'align', `${at}.onScreen`, ALIGNS),
    },
    claims: r.list(s, 'claims', at).map((raw, i) => {
      const where = `${at}.claims[${i}]`;
      const c = r.obj(raw, where);
      return {
        id: r.str(c, 'id', where),
        text: r.str(c, 'text', where),
        appliesTo: r.oneOf(c, 'appliesTo', where, CLAIM_TARGETS),
        status: r.oneOf(c, 'status', where, CLAIM_STATUS),
        source: r.optStr(c, 'source', where),
      };
    }),
    visual: {
      source: r.oneOf(visual, 'source', `${at}.visual`, SOURCES),
      reference: r.str(visual, 'reference', `${at}.visual`),
      camera: r.str(visual, 'camera', `${at}.visual`),
      prompt: r.str(visual, 'prompt', `${at}.visual`),
    },
    layout: {
      vertical: parseLayout('vertical'),
      horizontal: parseLayout('horizontal'),
    },
    icon: r.optStr(s, 'icon', at),
    signoff: signoff && {
      logo: signoff.logo === true,
      caption: r.str(signoff, 'caption', `${at}.signoff`),
    },
    motion: r.list(s, 'motion', at).map((raw, i) => {
      const where = `${at}.motion[${i}]`;
      const m = r.obj(raw, where);
      return {
        target: r.oneOf(m, 'target', where, MOTION_TARGETS),
        type: r.oneOf(m, 'type', where, MOTION_TYPES),
        duration: r.str(m, 'duration', where),
        easing: r.str(m, 'easing', where),
        purpose: r.str(m, 'purpose', where),
      };
    }),
    transitionOut: transition && {
      type: r.oneOf(transition, 'type', `${at}.transitionOut`, TRANSITIONS),
      duration:
        transition.type === 'cut'
          ? null
          : r.str(transition, 'duration', `${at}.transitionOut`),
      easing:
        transition.type === 'cut'
          ? null
          : r.str(transition, 'easing', `${at}.transitionOut`),
    },
    audio: {
      music: r.str(audio, 'music', `${at}.audio`),
      sfx: r.optStr(audio, 'sfx', `${at}.audio`),
    },
  };
}

/** Lee la forma del storyboard; los errores de forma van a `errors`. */
export function parseStoryboard(raw: unknown, errors: string[]): Storyboard {
  const r = reader(errors);
  const s = r.obj(raw, 'storyboard');
  const spine = r.obj(s.spine, 'spine');
  return {
    slug: r.str(s, 'slug', 'storyboard'),
    status: r.oneOf(s, 'status', 'storyboard', [
      'propuesta',
      'aprobado',
    ] as const),
    title: r.str(s, 'title', 'storyboard'),
    brief: r.str(s, 'brief', 'storyboard'),
    locale: r.oneOf(s, 'locale', 'storyboard', ['es', 'ca', 'en'] as const),
    spine: {
      job: r.str(spine, 'job', 'spine'),
      audience: r.str(spine, 'audience', 'spine'),
      cta: r.str(spine, 'cta', 'spine'),
    },
    fps: r.num(s, 'fps', 'storyboard'),
    formats: r.list(s, 'formats', 'storyboard').map((raw, i) => {
      const f = r.obj(raw, `formats[${i}]`);
      return {
        id: r.oneOf(f, 'id', `formats[${i}]`, FORMATS),
        width: r.num(f, 'width', `formats[${i}]`),
        height: r.num(f, 'height', `formats[${i}]`),
      };
    }),
    voiceover: r.optStr(s, 'voiceover', 'storyboard'),
    scenes: r
      .list(s, 'scenes', 'storyboard')
      .map((raw, i) => parseScene(raw, `scenes[${i}]`, errors)),
  };
}

export type Grid = {
  width: number;
  height: number;
  columns: number;
  margin: number;
  gutter: number;
  column: number;
  safeTop: number;
  safeBottom: number;
  safeRight: number;
};

export function gridFor(tokens: TokenMap, format: FormatId): Grid {
  const px = (key: string) =>
    parsePx(tokens.get(`grid.${format}.${key}`)?.value);
  const columns = Number(tokens.get(`grid.${format}.columns`)?.value);
  const width = px('width');
  const margin = px('margin');
  const gutter = px('gutter');
  return {
    width,
    height: px('height'),
    columns,
    margin,
    gutter,
    column: (width - 2 * margin - (columns - 1) * gutter) / columns,
    safeTop: px('safe-top'),
    safeBottom: px('safe-bottom'),
    safeRight: px('safe-right'),
  };
}

/** Bordes en px de un bloque que ocupa las columnas [start, end]. */
export function columnSpan(grid: Grid, start: number, end: number) {
  const left = grid.margin + (start - 1) * (grid.column + grid.gutter);
  const right = grid.margin + end * grid.column + (end - 1) * grid.gutter;
  return { left, right, width: right - left };
}

/** Palabras que se leen: las que tienen al menos una letra o una cifra. */
export function countWords(text: string): number {
  return text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

export function sceneWords(scene: Scene): number {
  const { label, figure, statement } = scene.onScreen;
  return countWords([label, figure ?? '', statement].join(' '));
}

export function readingSeconds(tokens: TokenMap, words: number): number {
  const rate = Number(tokens.get('text.reading.words-per-second')?.value);
  const hold = parseMs(tokens.get('text.reading.min-hold')?.value) / 1000;
  return words / rate + hold;
}

function refIn(tokens: TokenMap, ref: string, group: string): boolean {
  const match = /^\{([^{}]+)\}$/.exec(ref);
  return Boolean(match?.[1]?.startsWith(`${group}.`) && tokens.has(match[1]));
}

/** Reglas del storyboard frente a los tokens y a anti-patterns.md. */
export function checkStoryboard(
  storyboard: Storyboard,
  tokenTree: unknown,
  options: CheckOptions,
): Omit<StoryboardReport, 'errors'> & { errors: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const tokens = flattenTokens(tokenTree);
  const { scenes } = storyboard;
  const maxWords = Number(tokens.get('text.max-words')?.value);
  const budget = Number(tokens.get('motion.budget.per-scene')?.value);
  const forbidden = groupExtensions(tokenTree, 'icon')?.forbidden;
  const forbiddenIcons = Array.isArray(forbidden) ? forbidden.map(String) : [];

  if (storyboard.slug !== options.slug) {
    errors.push(
      `El slug es «${storyboard.slug}» pero el archivo es ${options.slug}.json.`,
    );
  }
  if (storyboard.status === 'propuesta')
    warnings.push('El storyboard está en propuesta: falta tu aprobación.');
  if (!Number.isInteger(storyboard.fps) || storyboard.fps <= 0)
    errors.push('fps debe ser un entero positivo.');
  if (storyboard.formats.length === 0)
    errors.push('No hay formatos de salida.');
  for (const format of storyboard.formats) {
    const grid = gridFor(tokens, format.id);
    if (format.width !== grid.width || format.height !== grid.height) {
      errors.push(
        `Formato ${format.id}: ${format.width}×${format.height} no coincide con la rejilla de los tokens (${grid.width}×${grid.height}).`,
      );
    }
  }
  if (scenes.length === 0) errors.push('No hay escenas.');

  const ids = new Set<string>();
  scenes.forEach((scene, index) => {
    const at = `Escena ${index + 1} (${scene.id})`;
    const last = index === scenes.length - 1;
    if (ids.has(scene.id)) errors.push(`${at}: el id está repetido.`);
    ids.add(scene.id);
    if (!/^s\d+-[a-z0-9-]+$/.test(scene.id))
      errors.push(`${at}: el id debe ser s<n>-<nombre>.`);
    if (scene.visual.prompt !== `prompts/${scene.id}.md`) {
      errors.push(`${at}: el prompt debe ser prompts/${scene.id}.md.`);
    }

    // Duración: positiva y, si sale de LTX, de 4 a 8 s.
    if (!(scene.durationSeconds > 0))
      errors.push(`${at}: la duración debe ser positiva.`);
    const { min, max } = IMAGE_TO_VIDEO_SECONDS;
    if (
      scene.visual.source === 'image-to-video' &&
      (scene.durationSeconds < min || scene.durationSeconds > max)
    ) {
      errors.push(
        `${at}: un clip de LTX dura de ${min} a ${max} s, no ${scene.durationSeconds} s.`,
      );
    }

    // Texto: una idea y tiempo para leerla.
    const words = sceneWords(scene);
    if (words > maxWords)
      errors.push(`${at}: ${words} palabras en pantalla (máximo ${maxWords}).`);
    const reading = readingSeconds(tokens, words);
    if (reading > scene.durationSeconds) {
      errors.push(
        `${at}: leer ${words} palabras pide ${reading.toFixed(1)} s y la escena dura ${scene.durationSeconds} s.`,
      );
    }

    // Composición: columnas de la rejilla, sin invadir la zona segura derecha.
    for (const format of FORMATS) {
      const grid = gridFor(tokens, format);
      const [start, end] = scene.layout[format].text;
      if (!(start >= 1 && end <= grid.columns && start <= end)) {
        errors.push(
          `${at}: columnas ${start}–${end} fuera de la rejilla de ${grid.columns} (${format}).`,
        );
        continue;
      }
      const { right } = columnSpan(grid, start, end);
      if (right > grid.width - grid.safeRight) {
        errors.push(
          `${at}: el texto llega a ${right}px y la zona segura empieza en ${grid.width - grid.safeRight}px (${format}).`,
        );
      }
    }

    // Movimiento: pocos, con propósito y con valores de los tokens.
    if (scene.motion.length > budget) {
      errors.push(
        `${at}: ${scene.motion.length} movimientos (máximo ${budget}).`,
      );
    }
    for (const motion of scene.motion) {
      if (!refIn(tokens, motion.duration, 'motion.duration')) {
        errors.push(
          `${at}: «${motion.duration}» no es una duración de los tokens.`,
        );
      }
      if (!refIn(tokens, motion.easing, 'motion.easing')) {
        errors.push(`${at}: «${motion.easing}» no es una curva de los tokens.`);
      }
      if (motion.target === 'figure' && !scene.onScreen.figure) {
        errors.push(`${at}: mueve una cifra que no existe.`);
      }
      if (motion.target === 'icon' && !scene.icon)
        errors.push(`${at}: mueve un icono que no existe.`);
      if (motion.target === 'logo' && !scene.signoff?.logo)
        errors.push(`${at}: mueve un logo que no existe.`);
    }

    // Transición: con tokens; la última escena no funde con otra.
    const transition = scene.transitionOut;
    if (transition && transition.type !== 'cut') {
      if (
        !transition.duration ||
        !refIn(tokens, transition.duration, 'motion.duration')
      ) {
        errors.push(
          `${at}: la transición necesita una duración de los tokens.`,
        );
      }
      if (
        !transition.easing ||
        !refIn(tokens, transition.easing, 'motion.easing')
      ) {
        errors.push(`${at}: la transición necesita una curva de los tokens.`);
      }
    }
    if (last && transition?.type === 'dissolve')
      errors.push(`${at}: la última escena no puede fundir con otra.`);
    if (!last && transition?.type === 'fade-to-background') {
      warnings.push(
        `${at}: un fundido al fondo a mitad del clip se verá como un corte en negro.`,
      );
    }

    // Iconos: Lucide, ninguno prohibido.
    if (scene.icon) {
      if (forbiddenIcons.includes(scene.icon))
        errors.push(`${at}: el icono «${scene.icon}» está prohibido.`);
      if (options.iconExists && !options.iconExists(scene.icon)) {
        errors.push(`${at}: «${scene.icon}» no es un icono de Lucide.`);
      }
    }

    // Datos: cada cifra con su afirmación; sin fuente, aviso.
    if (
      scene.onScreen.figure &&
      !scene.claims.some((c) => c.appliesTo === 'figure')
    ) {
      errors.push(
        `${at}: la cifra «${scene.onScreen.figure}» no tiene afirmación asociada.`,
      );
    }
    for (const claim of scene.claims) {
      if (claim.status === 'sourced' && !claim.source) {
        errors.push(`${at}: «${claim.id}» dice tener fuente pero no la da.`);
      }
      if (claim.status === 'needs_source') {
        warnings.push(
          `${at}: «${claim.text}» no tiene fuente; no se renderizará hasta tenerla.`,
        );
      }
    }
  });

  const centered = scenes.filter((s) => s.onScreen.align === 'center').length;
  if (centered > 1)
    errors.push(`Hay ${centered} escenas centradas; como máximo una.`);
  if (storyboard.voiceover === null) {
    warnings.push('Sin locución: no hay subtítulos que generar.');
  }

  return {
    slug: storyboard.slug,
    status: storyboard.status,
    totalSeconds: scenes.reduce((sum, s) => sum + s.durationSeconds, 0),
    scenes: scenes.length,
    errors,
    warnings,
  };
}

/** Forma + reglas. Si la forma falla, no se aplican las reglas. */
export function validateStoryboard(
  raw: unknown,
  tokenTree: unknown,
  options: CheckOptions,
): { storyboard: Storyboard | null; report: StoryboardReport } {
  const shapeErrors: string[] = [];
  const storyboard = parseStoryboard(raw, shapeErrors);
  if (shapeErrors.length > 0) {
    return {
      storyboard: null,
      report: {
        slug: options.slug,
        status: '',
        totalSeconds: 0,
        scenes: 0,
        errors: shapeErrors,
        warnings: [],
      },
    };
  }
  return {
    storyboard,
    report: checkStoryboard(storyboard, tokenTree, options),
  };
}
