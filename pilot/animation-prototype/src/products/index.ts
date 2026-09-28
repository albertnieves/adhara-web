import { asad } from './asad';
import { yara } from './yara';
import type { ProductConfig } from './schema';

/*
 * Registro de productos del prototipo, en el orden del plan.
 * Odyssey Mandarin Sky: NO se incluye (bloqueado por C-02 edición y C-05 fuera de catálogo).
 * import { mandarinSky } from './mandarin-sky';
 */
export const products: readonly ProductConfig[] = [asad, yara];

export type { ProductConfig } from './schema';
