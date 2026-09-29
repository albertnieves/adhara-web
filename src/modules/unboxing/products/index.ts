import { asad } from './asad';
import { clubDeNuitIntenseManLE } from './club-de-nuit-intense-man-le';
import { khamrah } from './khamrah';
import { yara } from './yara';
import type { ProductConfig } from './schema';

/*
 * Escenas disponibles (las del piloto). La ficha de un perfume usa la escena
 * indicada en products.unboxing_scene.
 * Odyssey Mandarin Sky: NO se incluye (bloqueado por C-02 edición y C-05 fuera de catálogo).
 */
export const scenes: readonly ProductConfig[] = [
  asad,
  yara,
  clubDeNuitIntenseManLE,
  khamrah,
];

export function findScene(slug: string): ProductConfig | undefined {
  return scenes.find((scene) => scene.slug === slug);
}

export type { ProductConfig } from './schema';
