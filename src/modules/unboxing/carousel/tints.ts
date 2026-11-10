import type { UnboxingSceneSlug } from '../index';

/**
 * Color del halo de cada perfume en el carrusel de la portada, sacado de los
 * materiales de su frasco (products/*.ts): el oro del medallón de Asad, el
 * rosa de Yara, el metal de Club de Nuit y el ámbar del líquido de Khamrah.
 */
export const HALO_TINTS: Record<UnboxingSceneSlug, string> = {
  asad: '#c9a24a',
  yara: '#e9b9c3',
  'club-de-nuit-intense-man-le': '#a9adbb',
  khamrah: '#c4702f',
};

/** Oro de la marca (--color-gold): halo de un perfume sin color propio. */
export const DEFAULT_TINT = '#a8844f';

/** Mismo valor que --color-night (three.js no lee variables CSS). */
export const NIGHT = '#0d0c0b';
