import type { ProductConfig } from '../products';
import { latheShoulderSize } from './bottles/latheShoulder';
import { MM } from './units';

/** Medidas del producto en unidades de escena (escala incluida). */
export function productDims(p: ProductConfig) {
  const k = MM * p.scale;
  const bottle = (() => {
    switch (p.bottle.archetype) {
      case 'lathe-shoulder':
        return latheShoulderSize(p.bottle);
    }
  })();
  const box = p.measurements.box;
  return {
    k,
    bottle: { height: bottle.heightMm * k, width: bottle.widthMm * k },
    box: { width: box.widthMm * k, height: box.heightMm * k, depth: box.depthMm * k },
    /** Grosor del cartón. */
    wall: 1.2 * k,
  };
}

export type ProductDims = ReturnType<typeof productDims>;
