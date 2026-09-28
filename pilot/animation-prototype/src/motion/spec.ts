import { z } from 'zod';

/**
 * Motion spec compartido por TODOS los productos (plan §2).
 * La coreografía es un dato: ningún componente contiene tiempos ni ángulos.
 * Tiempos en segundos, ángulos en grados, distancias relativas al tamaño del producto.
 */

export const EASINGS = [
  'linear',
  'easeOutCubic',
  'easeInOutCubic',
  'easeInOutSine',
  'easeOutQuart',
] as const;
const Ease = z.enum(EASINGS);
export type EaseName = z.infer<typeof Ease>;

const Seconds = z.number().positive();

/** Pose de cámara en coordenadas esféricas alrededor del objetivo. */
const CameraPose = z.object({
  azimuthDeg: z.number(),
  elevationDeg: z.number(),
  /** Fracción de la altura visible que ocupa el objeto encuadrado (0–1). */
  fill: z.number().min(0.1).max(1),
});

const Framing = z.object({
  /** Desplazamiento horizontal del encuadre (fracción del ancho; + = objeto a la izquierda). */
  shiftX: z.number().min(-0.5).max(0.5),
  /** Desplazamiento vertical del encuadre (fracción del alto; + = objeto arriba). */
  shiftY: z.number().min(-0.5).max(0.5),
  /** Relleno del frasco en S4/S5 (fracción de la altura visible). */
  fill: z.number().min(0.1).max(1),
});

export const MotionSpecSchema = z.object({
  id: z.string(),
  version: z.number().int().positive(),
  /** S0 · reposo: caja cerrada en 3/4 frontal. Retardo antes del autoplay. */
  s0Rest: z.object({
    camera: CameraPose,
    autoplayDelay: z.number().min(0),
  }),
  /** S1 · apertura de la solapa sobre la bisagra trasera. */
  s1Open: z.object({
    duration: Seconds,
    ease: Ease,
    flapAngleDeg: z.number().min(-180).max(0),
  }),
  /** S2 · ascenso: el frasco sube; la caja baja y se desvanece; la cámara pasa a frontal. */
  s2Rise: z.object({
    duration: Seconds,
    ease: Ease,
    /** Holgura bajo la base del frasco al final del ascenso, relativa a su altura. */
    bottleLiftOverBox: z.number().min(0),
    /** Descenso de la caja relativo a su altura. */
    boxDrop: z.number().min(0),
    /** Tramo (0–1) del ascenso en el que la caja se desvanece. */
    boxFade: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]),
    camera: CameraPose,
  }),
  /** S3 · giro: 360° exactos, termina de frente. */
  s3Spin: z.object({
    duration: Seconds,
    ease: Ease,
    turns: z.number().int().min(1),
  }),
  /** S4 · panel: la cámara desplaza el frasco y entra el panel HTML. */
  s4Panel: z.object({
    duration: Seconds,
    ease: Ease,
    desktop: Framing,
    mobile: Framing,
    mobileBreakpointPx: z.number().int().positive(),
  }),
  /** S5 · libre: giro manual limitado. */
  s5Free: z.object({
    zoomMin: z.number().positive(),
    zoomMax: z.number().positive(),
    polarMinDeg: z.number().min(0).max(180),
    polarMaxDeg: z.number().min(0).max(180),
  }),
  camera: z.object({ fovDeg: z.number().min(10).max(90) }),
});

export type MotionSpec = z.infer<typeof MotionSpecSchema>;

export const motionSpec: MotionSpec = MotionSpecSchema.parse({
  id: 'unboxing-v1',
  version: 1,
  s0Rest: {
    camera: { azimuthDeg: 32, elevationDeg: 16, fill: 0.62 },
    autoplayDelay: 0.8,
  },
  s1Open: { duration: 0.9, ease: 'easeOutCubic', flapAngleDeg: -115 },
  s2Rise: {
    duration: 1.2,
    ease: 'easeInOutCubic',
    bottleLiftOverBox: 0.08,
    boxDrop: 0.35,
    boxFade: [0.25, 0.9],
    camera: { azimuthDeg: 0, elevationDeg: 6, fill: 0.72 },
  },
  s3Spin: { duration: 2.4, ease: 'easeInOutSine', turns: 1 },
  s4Panel: {
    duration: 0.6,
    ease: 'easeOutCubic',
    desktop: { shiftX: 0.16, shiftY: 0, fill: 0.7 },
    mobile: { shiftX: 0, shiftY: 0.2, fill: 0.46 },
    mobileBreakpointPx: 768,
  },
  s5Free: { zoomMin: 0.8, zoomMax: 1.3, polarMinDeg: 55, polarMaxDeg: 105 },
  camera: { fovDeg: 30 },
});
