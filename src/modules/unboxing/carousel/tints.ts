import type { UnboxingSceneSlug } from '../index';

/**
 * Color del halo de cada perfume en el carrusel de la portada, sacado de los
 * materiales de su frasco (products/*.ts): el metal de sus aros o del collarín,
 * el rosa de Yara, el ámbar del líquido de Khamrah y el azul de Iconic.
 */
export const HALO_TINTS: Record<UnboxingSceneSlug, string> = {
  asad: '#c9a24a',
  yara: '#e9b9c3',
  'club-de-nuit-intense-man-le': '#a9adbb',
  khamrah: '#c4702f',
  'asad-bourbon': '#9b7a5e',
  'asad-elixir': '#8e8e92',
  'yara-elixir': '#d9a28f',
  'yara-moi': '#d6b46a',
  'club-de-nuit-intense': '#a3a6ae',
  'club-de-nuit-iconic': '#3b6fe0',
};

/** Oro de la marca (--color-gold): halo de un perfume sin color propio. */
export const DEFAULT_TINT = '#a8844f';

/** Mismo valor que --color-night (three.js no lee variables CSS). */
export const NIGHT = '#0d0c0b';
