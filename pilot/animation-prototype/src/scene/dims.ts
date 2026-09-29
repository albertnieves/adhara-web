import type { ProductConfig } from '../products';
import { latheShoulderSize } from './bottles/latheShoulder';
import { rectPrismSize } from './bottles/RectPrismBottle';
import { squareGlassSize } from './bottles/SquareGlassBottle';
import { MM } from './units';

/** Medidas del producto en unidades de escena (escala incluida). */
export function productDims(p: ProductConfig) {
  const k = MM * p.scale;
  const bottle = (() => {
    switch (p.bottle.archetype) {
      case 'lathe-shoulder':
        return latheShoulderSize(p.bottle);
      case 'rect-prism':
        return rectPrismSize(p.bottle);
      case 'square-glass':
        return squareGlassSize(p.bottle);
    }
  })();
  const box = p.box;
  return {
    k,
    bottle: {
      height: bottle.heightMm * k,
      width: bottle.widthMm * k,
      depth: bottle.depthMm * k,
    },
    box: { width: box.widthMm * k, height: box.heightMm * k, depth: box.depthMm * k },
    /** Grosor del cartón. */
    wall: 1.2 * k,
  };
}

export type ProductDims = ReturnType<typeof productDims>;
