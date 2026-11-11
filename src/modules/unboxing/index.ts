/**
 * Escena de unboxing (piloto, enfoque C). La vista es de cliente y pesa
 * (three.js): se carga con next/dynamic desde la ficha, nunca en el servidor.
 */
export const UNBOXING_SCENES = [
  'asad',
  'yara',
  'club-de-nuit-intense-man-le',
  'khamrah',
  'asad-bourbon',
  'asad-elixir',
  'yara-elixir',
  'yara-moi',
  'club-de-nuit-intense',
  'club-de-nuit-iconic',
] as const;
export type UnboxingSceneSlug = (typeof UNBOXING_SCENES)[number];
export type { UnboxingLabels } from './UnboxingViewer';

/** Slug de escena válido o null (products.unboxing_scene puede ser cualquier texto). */
export function findSceneSlug(
  slug: string | null | undefined,
): UnboxingSceneSlug | null {
  return UNBOXING_SCENES.includes(slug as UnboxingSceneSlug)
    ? (slug as UnboxingSceneSlug)
    : null;
}

/** Cuentas del carrusel de la portada (sin three.js: la escena va aparte). */
export {
  createRingControl,
  nearestIndex,
  releaseSteps,
  ringStep,
  shortestTarget,
} from './carousel/ring';
export type { RingControl } from './carousel/ring';
