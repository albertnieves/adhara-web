/**
 * Escena de unboxing (piloto, enfoque C). La vista es de cliente y pesa
 * (three.js): la ficha la importa solo cuando el cliente pide verla
 * (`loadUnboxingViewer`), nunca en el servidor ni en la carga de la página.
 */
export const UNBOXING_SCENES = [
  'asad',
  'yara',
  'club-de-nuit-intense-man-le',
  'khamrah',
] as const;
export type UnboxingSceneSlug = (typeof UNBOXING_SCENES)[number];
export type { UnboxingLabels, UnboxingViewerProps } from './UnboxingViewer';
export { loadUnboxingViewer, useWebGL } from './client';

/** Slug de escena válido o null (products.unboxing_scene puede ser cualquier texto). */
export function findSceneSlug(
  slug: string | null | undefined,
): UnboxingSceneSlug | null {
  return UNBOXING_SCENES.includes(slug as UnboxingSceneSlug)
    ? (slug as UnboxingSceneSlug)
    : null;
}
