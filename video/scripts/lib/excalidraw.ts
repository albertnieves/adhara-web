// Storyboard → documento de Excalidraw: un frame por escena con la miniatura
// del 9:16 (zona segura, bloque de texto en sus columnas y sujeto) y la ficha de
// la escena. Determinista: mismos datos, mismo archivo.
import type { Scene, Storyboard } from './storyboard.ts';
import { columnSpan, gridFor, sceneWords } from './storyboard.ts';
import type { TokenMap } from './tokens.ts';
import { flattenTokens, resolve } from './tokens.ts';

type Element = Record<string, unknown>;
type TextOptions = {
  size: number;
  color: string;
  maxChars: number;
  frameId: string | null;
};

const FRAME_W = 1000;
const FRAME_GAP = 120;
const PAD = 32;
const THUMB_SCALE = 0.25;
const META_X = PAD + 1080 * THUMB_SCALE + 40;
const META_CHARS = 62;
/** Ancho medio de un carácter de Helvetica respecto al cuerpo, para medir el texto. */
const CHAR_WIDTH = 0.56;
const LINE_HEIGHT = 1.25;

/** FNV-1a: semillas estables a partir del id. */
function seed(text: string): number {
  let hash = 0x811c9dc5;
  for (const char of text) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return (hash % 2_147_483_646) + 1;
}

const round = (n: number) => Math.round(n * 100) / 100;

function element(
  id: string,
  type: string,
  box: { x: number; y: number; width: number; height: number },
  frameId: string | null,
  extra: Element,
): Element {
  return {
    id,
    type,
    x: round(box.x),
    y: round(box.y),
    width: round(box.width),
    height: round(box.height),
    angle: 0,
    strokeColor: '#0d0c0b',
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeWidth: 1,
    strokeStyle: 'solid',
    roughness: 0,
    opacity: 100,
    groupIds: [],
    frameId,
    roundness: null,
    seed: seed(id),
    version: 1,
    versionNonce: seed(`${id}#nonce`),
    isDeleted: false,
    boundElements: null,
    updated: 1,
    link: null,
    locked: false,
    ...extra,
  };
}

/** Parte el texto en líneas de como mucho `maxChars` sin cortar palabras. */
export function wrap(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (line && line.length + 1 + word.length > maxChars) {
        lines.push(line);
        line = word;
      } else {
        line = line ? `${line} ${word}` : word;
      }
    }
    lines.push(line);
  }
  return lines;
}

function text(
  id: string,
  x: number,
  y: number,
  content: string,
  o: TextOptions,
): Element {
  const lines = wrap(content, o.maxChars);
  const body = lines.join('\n');
  const longest = Math.max(...lines.map((line) => line.length));
  return element(
    id,
    'text',
    {
      x,
      y,
      width: longest * o.size * CHAR_WIDTH,
      height: lines.length * o.size * LINE_HEIGHT,
    },
    o.frameId,
    {
      strokeColor: o.color,
      text: body,
      originalText: body,
      fontSize: o.size,
      fontFamily: 2,
      textAlign: 'left',
      verticalAlign: 'top',
      containerId: null,
      autoResize: true,
      lineHeight: LINE_HEIGHT,
    },
  );
}

const color = (tokens: TokenMap, path: string) =>
  String(resolve(tokens, `{${path}}`));
const tokenName = (ref: string | null) =>
  ref ? (ref.slice(1, -1).split('.').at(-1) ?? ref) : '—';

function sceneSheet(scene: Scene): Array<[string, string]> {
  const { label, figure, statement, align } = scene.onScreen;
  const shown = [label, figure, `«${statement}»`].filter(Boolean).join(' · ');
  const alignment = {
    start: 'a la izquierda',
    end: 'a la derecha',
    center: 'centrado',
  }[align];
  const side = (focal: 'start' | 'end') =>
    focal === 'start' ? 'izquierda' : 'derecha';
  const { vertical, horizontal } = scene.layout;
  const rows: Array<[string, string]> = [
    ['Objetivo', scene.objective],
    ['En pantalla', `${shown} (${sceneWords(scene)} palabras, ${alignment})`],
    ['Referencia visual', scene.visual.reference],
    ['Cámara', scene.visual.camera],
    ['Origen', `${scene.visual.source} · ${scene.visual.prompt}`],
    [
      'Composición',
      `9:16 columnas ${vertical.text.join('–')}, sujeto a la ${side(vertical.focal)} · 16:9 columnas ${horizontal.text.join('–')}, sujeto a la ${side(horizontal.focal)}`,
    ],
    [
      'Movimiento',
      scene.motion
        .map(
          (m) =>
            `${m.target}: ${m.type} (${tokenName(m.duration)}, ${tokenName(m.easing)}) — ${m.purpose}`,
        )
        .join('\n'),
    ],
    [
      'Transición',
      scene.transitionOut
        ? `${scene.transitionOut.type} (${tokenName(scene.transitionOut.duration)}, ${tokenName(scene.transitionOut.easing)})`
        : 'ninguna',
    ],
    [
      'Audio',
      `Música: ${scene.audio.music}${scene.audio.sfx ? `\nEfecto: ${scene.audio.sfx}` : ''}`,
    ],
    ['Icono', scene.icon ? `Lucide «${scene.icon}»` : 'ninguno'],
  ];
  if (scene.signoff) {
    rows.push([
      'Cierre',
      `${scene.signoff.logo ? 'Logo + ' : ''}${scene.signoff.caption}`,
    ]);
  }
  rows.push([
    'Fuentes',
    scene.claims
      .map(
        (c) =>
          `${c.status === 'sourced' ? '✓' : '⚠ sin fuente'} · ${c.text}${c.source ? ` (${c.source})` : ''}`,
      )
      .join('\n') || 'no hay afirmaciones',
  ]);
  return rows;
}

function sceneElements(
  scene: Scene,
  index: number,
  x0: number,
  y0: number,
  tokens: TokenMap,
) {
  const frameId = `frame-${scene.id}`;
  const id = (part: string) => `${scene.id}-${part}`;
  const ink = color(tokens, 'color.brand.night');
  const ivory = color(tokens, 'color.brand.ivory');
  const gold = color(tokens, 'color.brand.gold');
  const grid = gridFor(tokens, 'vertical');
  const s = (n: number) => n * THUMB_SCALE;
  const thumb = {
    x: x0 + PAD,
    y: y0 + 84,
    width: s(grid.width),
    height: s(grid.height),
  };
  const items: Element[] = [];

  items.push(
    text(
      id('title'),
      x0 + PAD,
      y0 + PAD,
      `${index + 1} · ${scene.title} — ${scene.durationSeconds} s`,
      {
        size: 28,
        color: ink,
        maxChars: 60,
        frameId,
      },
    ),
  );
  items.push(
    element(id('canvas'), 'rectangle', thumb, frameId, {
      strokeColor: ink,
      backgroundColor: ink,
    }),
  );
  items.push(
    element(
      id('safe'),
      'rectangle',
      {
        x: thumb.x + s(grid.margin),
        y: thumb.y + s(grid.safeTop),
        width: s(grid.width - grid.margin - grid.safeRight),
        height: s(grid.height - grid.safeTop - grid.safeBottom),
      },
      frameId,
      { strokeColor: gold, strokeStyle: 'dotted', opacity: 70 },
    ),
  );

  // Sujeto en el lado focal, en la mitad superior.
  const focalLeft = scene.layout.vertical.focal === 'start';
  const radius = s(300);
  const cx = thumb.x + (focalLeft ? thumb.width * 0.3 : thumb.width * 0.7);
  const cy = thumb.y + thumb.height * 0.32;
  items.push(
    element(
      id('focal'),
      'ellipse',
      { x: cx - radius, y: cy - radius, width: radius * 2, height: radius * 2 },
      frameId,
      {
        strokeColor: gold,
        strokeStyle: 'dashed',
      },
    ),
  );
  items.push(
    text(id('focal-label'), cx - 22, cy - 8, 'sujeto', {
      size: 12,
      color: gold,
      maxChars: 20,
      frameId,
    }),
  );

  // Bloque de texto en sus columnas, encima de la zona segura inferior.
  const [start, end] = scene.layout.vertical.text;
  const span = columnSpan(grid, start, end);
  const zone = {
    x: thumb.x + s(span.left),
    y: thumb.y + thumb.height * 0.44,
    width: s(span.width),
    height: thumb.height * 0.56 - s(grid.safeBottom),
  };
  items.push(
    element(id('text-zone'), 'rectangle', zone, frameId, {
      strokeColor: ivory,
      strokeStyle: 'dashed',
      opacity: 60,
    }),
  );
  const zoneChars = Math.max(8, Math.floor(zone.width / (16 * CHAR_WIDTH)));
  let ty = zone.y + 8;
  const label = text(
    id('label'),
    zone.x + 6,
    ty,
    scene.onScreen.label.toUpperCase(),
    {
      size: 10,
      color: gold,
      maxChars: 40,
      frameId,
    },
  );
  items.push(label);
  ty += Number(label.height) + 4;
  if (scene.onScreen.figure) {
    const figure = text(id('figure'), zone.x + 6, ty, scene.onScreen.figure, {
      size: 40,
      color: ivory,
      maxChars: 12,
      frameId,
    });
    items.push(figure);
    ty += Number(figure.height) + 6;
  }
  items.push(
    text(id('statement'), zone.x + 6, ty, scene.onScreen.statement, {
      size: 16,
      color: ivory,
      maxChars: zoneChars,
      frameId,
    }),
  );

  // Ficha de la escena.
  let my = y0 + 84;
  for (const [heading, body] of sceneSheet(scene)) {
    const key = heading.toLowerCase().replaceAll(' ', '-');
    const h = text(id(`h-${key}`), x0 + META_X, my, heading.toUpperCase(), {
      size: 13,
      color: ink,
      maxChars: META_CHARS,
      frameId,
    });
    const b = text(
      id(`b-${key}`),
      x0 + META_X,
      my + Number(h.height) + 2,
      body,
      {
        size: 16,
        color: ink,
        maxChars: META_CHARS,
        frameId,
      },
    );
    items.push(h, b);
    my += Number(h.height) + Number(b.height) + 16;
  }

  const height = Math.max(thumb.y + thumb.height + PAD, my + PAD) - y0;
  return { frameId, items, height };
}

export function buildExcalidraw(storyboard: Storyboard, tokenTree: unknown) {
  const tokens = flattenTokens(tokenTree);
  const ink = color(tokens, 'color.brand.night');
  const total = storyboard.scenes.reduce(
    (sum, s) => sum + s.durationSeconds,
    0,
  );
  const formats = storyboard.formats
    .map((f) => `${f.width}×${f.height}`)
    .join(' y ');
  const header = text(
    'storyboard-title',
    0,
    -150,
    `Storyboard · ${storyboard.title} · ${storyboard.slug} · ${storyboard.status} · ${total} s · ${formats} a ${storyboard.fps} fps\nObjetivo: ${storyboard.spine.job}`,
    { size: 24, color: ink, maxChars: 140, frameId: null },
  );

  const scenes = storyboard.scenes.map((scene, i) =>
    sceneElements(scene, i, i * (FRAME_W + FRAME_GAP), 0, tokens),
  );
  const height = Math.max(...scenes.map((s) => s.height));
  const elements: Element[] = [header];
  storyboard.scenes.forEach((scene, i) => {
    const built = scenes[i];
    if (!built) return;
    elements.push(...built.items);
    elements.push(
      element(
        built.frameId,
        'frame',
        { x: i * (FRAME_W + FRAME_GAP), y: 0, width: FRAME_W, height },
        null,
        {
          name: `${i + 1} · ${scene.title}`,
          strokeColor: '#bbb',
        },
      ),
    );
  });

  return {
    type: 'excalidraw',
    version: 2,
    source: 'adhara-web/video/scripts/storyboard.ts',
    elements,
    appState: {
      viewBackgroundColor: color(tokens, 'color.brand.ivory'),
      gridSize: null,
    },
    files: {},
  };
}
