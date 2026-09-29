/** Texto de relleno: el copy real se redacta y aprueba fuera del prototipo. */
export const PLACEHOLDER_DESCRIPTION =
  'Texto de ejemplo para medir el panel: aquí irá la descripción aprobada del producto, con una o dos frases sobre su carácter y su familia olfativa.';

/**
 * Caja sin fotos del kit: medidas supuestas (frasco + holgura), solapa superior y
 * cartón neutro. Nada de esto describe la caja real.
 */
export const BOX_PLACEHOLDER = {
  estimated: true,
  opening: 'top-flap',
  color: '#e2dbd0',
  insideColor: '#d6cfc3',
} as const;
