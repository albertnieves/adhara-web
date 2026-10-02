/*
 * Contraste WCAG 2.2 (1.4.3 y 1.4.11). Lo usan la prueba de los tokens, que
 * lee src/app/globals.css, y la página de referencia, que lee los valores que
 * aplica el navegador en cada tono.
 */

export type Rgb = readonly [number, number, number];

/**
 * Lee `#rrggbb` o un color sRGB calculado por el navegador, con canales de 0
 * a 255. Cualquier otro formato devuelve null.
 */
export function parseColor(value: string): Rgb | null {
  const text = value.trim();
  const hex = text.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (hex)
    return [
      parseInt(hex[1]!, 16),
      parseInt(hex[2]!, 16),
      parseInt(hex[3]!, 16),
    ];
  const channels = text.startsWith('rgb') ? text.match(/\d+(?:\.\d+)?/g) : null;
  if (!channels || channels.length < 3) return null;
  return [Number(channels[0]), Number(channels[1]), Number(channels[2])];
}

/** Luminancia relativa. */
export function luminance([r, g, b]: Rgb): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Relación de contraste entre dos colores, de 1 a 21. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** «5,21:1», con coma decimal. */
export function formatRatio(ratio: number): string {
  return `${ratio.toLocaleString('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}:1`;
}
