/*
 * Catálogo de los tokens de src/app/globals.css (Fase 2, DS-03): nombre y uso
 * de cada uno, y la matriz de contraste permitida. Los valores no se copian
 * aquí: la prueba los lee del CSS y la página de referencia, del navegador.
 * tests/unit/design-tokens.test.ts comprueba que este catálogo y el CSS
 * tienen exactamente los mismos tokens.
 */

export type ToneId = 'light' | 'dark' | 'oud' | 'indigo' | 'forest';

export type Tone = { id: ToneId; label: string; use: string };

/** Tonos: el claro por defecto y los oscuros con `data-tone`. */
export const TONES: readonly Tone[] = [
  {
    id: 'light',
    label: 'Claro',
    use: 'Tono por defecto de la tienda y el panel.',
  },
  {
    id: 'dark',
    label: 'Oscuro',
    use: 'Momentos editoriales (D2): portada, pie, menú móvil, menú del panel, banner de vista previa e informes.',
  },
  {
    id: 'oud',
    label: 'Oud',
    use: 'Oscuro de colección (D3), para la tienda a partir de la F5.',
  },
  {
    id: 'indigo',
    label: 'Índigo',
    use: 'Oscuro de colección (D3), para la tienda a partir de la F5.',
  },
  {
    id: 'forest',
    label: 'Bosque',
    use: 'Oscuro de colección (D3), para la tienda a partir de la F5.',
  },
];

export type ColorToken = { name: string; role: string };

/** Paleta de marca: define los semánticos y algunos casos de marca. */
export const PALETTE_COLORS: readonly ColorToken[] = [
  { name: 'ivory', role: 'Marfil. Fondo del tono claro.' },
  { name: 'paper', role: 'Papel. Tarjetas y campos en claro.' },
  { name: 'sand', role: 'Arena. Zonas hundidas en claro.' },
  { name: 'stage', role: 'Escenario. Fondo de las fotos y de la escena 3D.' },
  { name: 'ink', role: 'Tinta. Texto y botón principal.' },
  {
    name: 'ink-soft',
    role: 'Tinta suave. Botón principal al pasar el ratón (D4).',
  },
  { name: 'night', role: 'Noche. Fondo de los tonos oscuros.' },
  { name: 'night-raised', role: 'Noche elevada. Tarjetas en oscuro.' },
  { name: 'smoke', role: 'Humo. Texto atenuado en claro.' },
  {
    name: 'mist',
    role: 'Niebla. Texto atenuado en oscuro; sobre claro solo adorno.',
  },
  { name: 'line', role: 'Línea. Separadores en claro.' },
  { name: 'line-strong', role: 'Línea marcada. Bordes de controles en claro.' },
  { name: 'line-dark', role: 'Línea oscura. Separadores en oscuro.' },
  {
    name: 'line-strong-dark',
    role: 'Línea marcada oscura. Bordes de controles en oscuro.',
  },
  {
    name: 'gold',
    role: 'Dorado. Acento: líneas, estrella y estado activo; nunca fondo de texto (D4).',
  },
  { name: 'gold-deep', role: 'Dorado profundo. Texto dorado y foco en claro.' },
  {
    name: 'gold-soft',
    role: 'Dorado suave. Texto dorado y foco en oscuro; selección de texto.',
  },
  { name: 'oud', role: 'Oud tostado. Fondo del tono oud (D3).' },
  {
    name: 'indigo-night',
    role: 'Índigo nocturno. Fondo del tono índigo (D3).',
  },
  { name: 'forest', role: 'Verde muy oscuro. Fondo del tono bosque (D3).' },
];

/** Semánticos: los que usan los componentes; cada tono los redefine. */
export const SEMANTIC_COLORS: readonly ColorToken[] = [
  { name: 'surface', role: 'Fondo de la página o de la sección.' },
  { name: 'surface-raised', role: 'Tarjetas, campos y paneles.' },
  { name: 'surface-sunken', role: 'Zonas hundidas y bandas.' },
  { name: 'fg', role: 'Texto principal.' },
  { name: 'fg-muted', role: 'Texto secundario.' },
  { name: 'fg-inverse', role: 'Texto sobre un fondo del color fg.' },
  { name: 'border', role: 'Separadores y bordes de tarjetas.' },
  { name: 'border-strong', role: 'Bordes de controles (3:1).' },
  { name: 'accent', role: 'Acento: líneas y estado activo.' },
  { name: 'accent-fg', role: 'Texto dorado.' },
  { name: 'focus', role: 'Anillo de foco de 2 px.' },
  { name: 'danger', role: 'Errores y acciones destructivas.' },
  { name: 'danger-soft', role: 'Fondo de los avisos de error.' },
  { name: 'success', role: 'Confirmaciones.' },
  { name: 'success-soft', role: 'Fondo de las confirmaciones.' },
  { name: 'warning', role: 'Avisos.' },
  { name: 'warning-soft', role: 'Fondo de los avisos.' },
];

export type ContrastKind = 'text' | 'graphic';
export type ContrastPair = {
  fg: string;
  bg: string;
  min: number;
  kind: ContrastKind;
};

/** Fondos de la matriz: las tres superficies y, en claro, arena y escenario. */
export function backgroundsFor(tone: ToneId): string[] {
  const surfaces = ['surface', 'surface-raised', 'surface-sunken'];
  return tone === 'light' ? [...surfaces, 'stage', 'sand'] : surfaces;
}

/** Texto: 4,5:1 (WCAG 1.4.3). */
export const TEXT_COLORS = [
  'fg',
  'fg-muted',
  'accent-fg',
  'danger',
  'success',
  'warning',
] as const;

/** Bordes de controles y foco: 3:1 en cualquier fondo (WCAG 1.4.11). */
export const GRAPHIC_COLORS = ['border-strong', 'focus'] as const;

/**
 * El dorado de acento marca estados (activo, seleccionado) solo sobre la
 * superficie y la elevada; sobre arena o escenario es adorno (2,7–2,9:1).
 */
export const ACCENT_BACKGROUNDS = ['surface', 'surface-raised'] as const;

/** Matriz de colores de primer plano por fondo que deben cumplir AA. */
export function matrixPairs(tone: ToneId): ContrastPair[] {
  const bgs = backgroundsFor(tone);
  return [
    ...TEXT_COLORS.flatMap((fg) =>
      bgs.map((bg) => ({ fg, bg, min: 4.5, kind: 'text' as const })),
    ),
    ...GRAPHIC_COLORS.flatMap((fg) =>
      bgs.map((bg) => ({ fg, bg, min: 3, kind: 'graphic' as const })),
    ),
    ...ACCENT_BACKGROUNDS.map((bg) => ({
      fg: 'accent',
      bg,
      min: 3,
      kind: 'graphic' as const,
    })),
  ];
}

/** Combinaciones fijas: texto inverso y, en claro, estados y botones. */
export function fixedPairs(tone: ToneId): ContrastPair[] {
  const text = (fg: string, bg: string): ContrastPair => ({
    fg,
    bg,
    min: 4.5,
    kind: 'text',
  });
  const inverse = text('fg-inverse', 'fg');
  if (tone !== 'light') return [inverse];
  return [
    inverse,
    text('danger', 'danger-soft'),
    text('success', 'success-soft'),
    text('warning', 'warning-soft'),
    text('ivory', 'ink'),
    text('ivory', 'ink-soft'),
    text('ink', 'gold-soft'),
  ];
}

/** Colores que hay que leer en un tono para calcular sus combinaciones. */
export function colorsFor(tone: ToneId): string[] {
  const pairs = [...matrixPairs(tone), ...fixedPairs(tone)];
  return [...new Set(pairs.flatMap(({ fg, bg }) => [fg, bg]))];
}

export type Token = { variable: string; role: string };

export const FONT_TOKENS: readonly Token[] = [
  {
    variable: '--font-display',
    role: 'Cormorant Garamond (D1): titulares y cifras grandes.',
  },
  {
    variable: '--font-sans',
    role: 'Manrope (D1): texto, controles y versalitas.',
  },
];

export const TEXT_SIZE_TOKENS: readonly Token[] = [
  {
    variable: '--text-2xs',
    role: 'El tamaño mínimo (11 px): versalitas, etiquetas e insignias.',
  },
  {
    variable: '--text-display',
    role: 'Titular fluido de la portada: de 44 a 120 px según el ancho, con interlineado 0,95.',
  },
];

export type TypeStep = { className: string; variable: string };

/**
 * Escala cerrada (criterio 3): text-2xs, los tamaños de Tailwind que usa la
 * aplicación y el titular fluido. No hay tamaños arbitrarios.
 */
export const TYPE_SCALE: readonly TypeStep[] = [
  { className: 'text-2xs', variable: '--text-2xs' },
  { className: 'text-xs', variable: '--text-xs' },
  { className: 'text-sm', variable: '--text-sm' },
  { className: 'text-base', variable: '--text-base' },
  { className: 'text-lg', variable: '--text-lg' },
  { className: 'text-xl', variable: '--text-xl' },
  { className: 'text-2xl', variable: '--text-2xl' },
  { className: 'text-3xl', variable: '--text-3xl' },
  { className: 'text-4xl', variable: '--text-4xl' },
  { className: 'text-5xl', variable: '--text-5xl' },
  { className: 'text-6xl', variable: '--text-6xl' },
  { className: 'text-7xl', variable: '--text-7xl' },
  { className: 'text-8xl', variable: '--text-8xl' },
  { className: 'text-display', variable: '--text-display' },
];

export const TRACKING_TOKENS: readonly Token[] = [
  {
    variable: '--tracking-display',
    role: 'Titulares en Cormorant: un poco más juntos.',
  },
  {
    variable: '--tracking-caps-sm',
    role: 'Versalitas compactas: insignias y botones pequeños.',
  },
  {
    variable: '--tracking-caps',
    role: 'Versalitas: etiquetas de tablas, del menú y de las tarjetas.',
  },
  { variable: '--tracking-caps-lg', role: 'Versalitas amplias: antetítulos.' },
];

export const LAYOUT_TOKENS: readonly Token[] = [
  {
    variable: '--container-page',
    role: 'Ancho máximo del contenido (max-w-page).',
  },
  {
    variable: '--section-y',
    role: 'Separación vertical entre secciones editoriales.',
  },
];

export const RADIUS_TOKENS: readonly Token[] = [
  {
    variable: '--radius-hairline',
    role: 'El único radio además de 0 (rounded-hairline).',
  },
];

export const DURATION_TOKENS: readonly Token[] = [
  {
    variable: '--duration-fast',
    role: 'Rápido: color y estado de controles y filas.',
  },
  {
    variable: '--duration-base',
    role: 'Base: paneles deslizantes, avisos y botones.',
  },
  {
    variable: '--duration-slow',
    role: 'Lento: subrayados y entradas editoriales.',
  },
];

export const EASE_TOKENS: readonly Token[] = [
  {
    variable: '--ease-luxe',
    role: 'La curva de la marca: arranca rápido y llega despacio.',
  },
];

export const ANIMATION_TOKENS: readonly Token[] = [
  { variable: '--animate-twinkle', role: 'Estrella que titila (portada).' },
  {
    variable: '--animate-sweep',
    role: 'Destello que recorre un elemento oscuro (.sheen).',
  },
  { variable: '--animate-marquee', role: 'Cinta continua de marcas.' },
  {
    variable: '--animate-scroll-cue',
    role: 'Indicador de desplazamiento de la portada.',
  },
];

export const LAYER_TOKENS: readonly Token[] = [
  { variable: '--z-header', role: 'Cabecera fija.' },
  { variable: '--z-overlay', role: 'Capas sobre el contenido.' },
  { variable: '--z-sheet', role: 'Panel deslizante.' },
  { variable: '--z-toast', role: 'Avisos: siempre encima.' },
];

/** Todas las variables del catálogo, para comprobarlo contra el CSS. */
export function catalogVariables(): string[] {
  return [
    ...[...PALETTE_COLORS, ...SEMANTIC_COLORS].map((c) => `--color-${c.name}`),
    ...[
      ...FONT_TOKENS,
      ...TEXT_SIZE_TOKENS,
      ...TRACKING_TOKENS,
      ...LAYOUT_TOKENS,
      ...RADIUS_TOKENS,
      ...DURATION_TOKENS,
      ...EASE_TOKENS,
      ...ANIMATION_TOKENS,
      ...LAYER_TOKENS,
    ].map((t) => t.variable),
  ];
}
