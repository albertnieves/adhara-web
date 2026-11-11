import { asad } from './asad';
import { asadBourbon } from './asad-bourbon';
import { asadElixir } from './asad-elixir';
import { clubDeNuitIconic } from './club-de-nuit-iconic';
import { clubDeNuitIntense } from './club-de-nuit-intense';
import { clubDeNuitIntenseManLE } from './club-de-nuit-intense-man-le';
import { khamrah } from './khamrah';
import { yara } from './yara';
import { yaraElixir } from './yara-elixir';
import { yaraMoi } from './yara-moi';
import type { ProductConfig } from './schema';

/*
 * Escenas disponibles: las cuatro del piloto y seis más que reutilizan sus moldes
 * (DECISIONS §190). La ficha de un perfume usa la escena indicada en
 * products.unboxing_scene.
 * Odyssey Mandarin Sky: NO se incluye (bloqueado por C-02 edición y C-05 fuera de catálogo).
 */
export const scenes: readonly ProductConfig[] = [
  asad,
  yara,
  clubDeNuitIntenseManLE,
  khamrah,
  asadBourbon,
  asadElixir,
  yaraElixir,
  yaraMoi,
  clubDeNuitIntense,
  clubDeNuitIconic,
];

export function findScene(slug: string): ProductConfig | undefined {
  return scenes.find((scene) => scene.slug === slug);
}

export type { ProductConfig } from './schema';
