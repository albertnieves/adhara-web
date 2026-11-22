/**
 * Muelle de la vitrina de las tarjetas (CardStage, DECISIONS §200). Sustituye
 * a los valores animados de `motion`, que cada tarjeta creaba al hidratarse
 * (unos veinte, con sus suscripciones) aunque en un móvil nunca se movieran.
 * Aquí no hay nada hasta el primer movimiento del ratón, y los fotogramas
 * paran en cuanto la vitrina vuelve al reposo.
 *
 * Mismo muelle y mismas correspondencias que antes: rigidez 160, amortiguación
 * 20 y masa 0,6 (ζ ≈ 1,02, sin rebote); el cursor va de −0,5 a 0,5 en cada eje.
 */

export const SPRING = { stiffness: 160, damping: 20, mass: 0.6 } as const;

/** Paso de integración: 1 ms, muy por debajo de la duración de un fotograma. */
const STEP = 1 / 1000;
/** Un fotograma perdido (pestaña en segundo plano) no hace saltar el muelle. */
const MAX_FRAME = 1 / 15;
const REST = 0.0005;

export type Axis = { value: number; velocity: number; target: number };

/** Avanza un eje del muelle `seconds` segundos (Euler semiimplícito). */
export function stepAxis(axis: Axis, seconds: number): void {
  const { stiffness, damping, mass } = SPRING;
  for (let t = 0; t < seconds; t += STEP) {
    const dt = Math.min(STEP, seconds - t);
    const force =
      -stiffness * (axis.value - axis.target) - damping * axis.velocity;
    axis.velocity += (force / mass) * dt;
    axis.value += axis.velocity * dt;
  }
}

export function atRest(axis: Axis): boolean {
  return (
    Math.abs(axis.velocity) < REST && Math.abs(axis.value - axis.target) < REST
  );
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
/** Como `useTransform` de motion: de [−0,5, 0,5] (o [0, 1]) a [from, to], sin salirse. */
const map = (
  value: number,
  inMin: number,
  inMax: number,
  from: number,
  to: number,
) => from + (to - from) * clamp((value - inMin) / (inMax - inMin), 0, 1);
const round = (value: number) => Math.round(value * 1000) / 1000;

/** Estilos de la vitrina para una posición del muelle. */
export function tiltStyles(x: number, y: number, lift: number) {
  // El lado del cursor se hunde, como al apoyar un dedo.
  const rotateX = round(map(y, -0.5, 0.5, 7, -7));
  const rotateY = round(map(x, -0.5, 0.5, -9, 9));
  // La foto, por encima del fondo, se mueve hacia el cursor.
  const shiftX = round(map(x, -0.5, 0.5, -9, 9));
  const shiftY = round(map(y, -0.5, 0.5, -9, 9));
  const glareX = round(map(x, -0.5, 0.5, 10, 90));
  const glareY = round(map(y, -0.5, 0.5, 5, 85));
  const drop = round(map(lift, 0, 1, 0, 30));
  const blur = round(map(lift, 0, 1, 0, 54));
  const spread = round(map(lift, 0, 1, 0, -28));
  return {
    stage: {
      transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
      boxShadow: `0 ${drop}px ${blur}px ${spread}px color-mix(in oklab, var(--color-ink) 32%, transparent)`,
    },
    photo: { transform: `translateX(${shiftX}px) translateY(${shiftY}px)` },
    glare: {
      // Suave: es un reflejo en el fondo, no debe lavar la foto.
      opacity: String(round(map(lift, 0, 1, 0, 0.55))),
      background: `radial-gradient(48% 40% at ${glareX}% ${glareY}%, color-mix(in oklab, var(--color-paper) 55%, transparent), transparent 70%)`,
    },
  };
}

export type Tilt = {
  /** Lleva el muelle hacia el cursor (x, y) y la elevación (0 o 1). */
  aim: (x: number, y: number, lift: number) => void;
  stop: () => void;
};

export function createTilt(elements: {
  stage: HTMLElement;
  photo: HTMLElement;
  glare: HTMLElement;
}): Tilt {
  const axes = {
    x: { value: 0, velocity: 0, target: 0 },
    y: { value: 0, velocity: 0, target: 0 },
    lift: { value: 0, velocity: 0, target: 0 },
  };
  let frame: number | null = null;
  let last = 0;

  const paint = () => {
    const resting = Object.values(axes).every(
      (axis) => axis.target === 0 && atRest(axis),
    );
    if (resting) {
      // En reposo, como antes de pasar el cursor: sin estilos en línea.
      for (const el of Object.values(elements)) el.removeAttribute('style');
      return;
    }
    const styles = tiltStyles(axes.x.value, axes.y.value, axes.lift.value);
    Object.assign(elements.stage.style, styles.stage);
    Object.assign(elements.photo.style, styles.photo);
    Object.assign(elements.glare.style, styles.glare);
  };

  const tick = (now: number) => {
    const seconds = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    for (const axis of Object.values(axes)) stepAxis(axis, seconds);
    if (Object.values(axes).every(atRest)) {
      for (const axis of Object.values(axes)) {
        axis.value = axis.target;
        axis.velocity = 0;
      }
      frame = null;
    } else {
      frame = requestAnimationFrame(tick);
    }
    paint();
  };

  return {
    aim(x, y, lift) {
      axes.x.target = x;
      axes.y.target = y;
      axes.lift.target = lift;
      if (frame === null) {
        last = performance.now();
        frame = requestAnimationFrame(tick);
      }
    },
    stop() {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
    },
  };
}
