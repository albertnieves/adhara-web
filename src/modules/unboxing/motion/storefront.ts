import { MotionSpecSchema, motionSpec } from './spec';

/**
 * Coreografía de la ficha de producto: la misma del piloto, pero con el frasco
 * centrado al final (la información del perfume vive en su propia columna).
 */
export const storefrontMotionSpec = MotionSpecSchema.parse({
  ...motionSpec,
  id: 'unboxing-storefront-v1',
  s4Panel: {
    ...motionSpec.s4Panel,
    desktop: { shiftX: 0, shiftY: 0, fill: 0.74 },
    mobile: { shiftX: 0, shiftY: 0, fill: 0.68 },
  },
});
