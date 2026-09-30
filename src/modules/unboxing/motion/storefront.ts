import { MotionSpecSchema, motionSpec } from './spec';

/**
 * Coreografía de la ficha de producto: la misma del piloto, con más aire en el
 * encuadre inicial y el frasco centrado al final (la información del perfume
 * vive en su propia columna).
 */
export const storefrontMotionSpec = MotionSpecSchema.parse({
  ...motionSpec,
  id: 'unboxing-storefront-v1',
  // El contenedor es más bajo que la pantalla completa del piloto: más aire
  // arriba para que la solapa abierta no se corte.
  s0Rest: {
    ...motionSpec.s0Rest,
    camera: { ...motionSpec.s0Rest.camera, fill: 0.5 },
  },
  s4Panel: {
    ...motionSpec.s4Panel,
    desktop: { shiftX: 0, shiftY: 0, fill: 0.74 },
    mobile: { shiftX: 0, shiftY: 0, fill: 0.68 },
  },
});
