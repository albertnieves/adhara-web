import type { MotionSpec } from '../motion/spec';
import type { ProductDims } from './dims';

/** Altura de la base del frasco al principio (dentro de la caja) y al final del ascenso. */
export function risePositions(dims: ProductDims, spec: MotionSpec) {
  const start = dims.wall;
  const end = dims.box.height + spec.s2Rise.bottleLiftOverBox * dims.bottle.height;
  return { start, end, centerEnd: end + dims.bottle.height / 2 };
}
