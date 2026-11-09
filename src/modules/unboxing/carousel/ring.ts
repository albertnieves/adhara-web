/*
 * Cuentas del carrusel de la portada: un anillo de frascos que gira sobre el
 * eje vertical. Sin three.js, para que la tienda las use sin cargar la escena
 * y las pruebas las comprueben.
 *
 * El frasco i está en el ángulo i · paso del anillo; el anillo gira θ. Un
 * frasco queda al frente cuando su ángulo más θ es 0 (mirando a la cámara).
 */

const TAU = Math.PI * 2;

/** Ángulo entre dos frascos vecinos. */
export function ringStep(count: number) {
  return count > 0 ? TAU / count : 0;
}

/** Giro del anillo que deja el frasco `index` al frente (sin vueltas). */
export function frontAngle(index: number, count: number) {
  return -index * ringStep(count);
}

/** Índice (0…count−1) del frasco más cercano al frente con el anillo en `angle`. */
export function nearestIndex(angle: number, count: number) {
  if (count <= 0) return 0;
  const steps = Math.round(-angle / ringStep(count));
  return ((steps % count) + count) % count;
}

/**
 * Giro que lleva el frasco `index` al frente por el camino más corto desde
 * `current`: el anillo no da una vuelta entera para ir del último al primero.
 */
export function shortestTarget(current: number, index: number, count: number) {
  const base = frontAngle(index, count);
  const turns = Math.round((current - base) / TAU);
  return base + turns * TAU;
}

/**
 * Cuánto mira un frasco a la cámara: 1 al frente, 0 de perfil o detrás.
 * Con él se dosifican el balanceo y la luz del frasco del frente.
 */
export function frontness(slotIndex: number, count: number, angle: number) {
  return Math.max(0, Math.cos(slotIndex * ringStep(count) + angle));
}

/**
 * Pasos que avanza el anillo al soltar un arrastre: lo arrastrado, redondeado
 * al frasco más cercano, y uno más si se ha lanzado con fuerza.
 * `dragAngle` positivo gira hacia el frasco anterior (arrastrar a la derecha).
 */
export function releaseSteps(
  dragAngle: number,
  velocity: number,
  count: number,
) {
  const step = ringStep(count);
  if (step === 0) return 0;
  // `|| 0` evita -0 al redondear un arrastre corto a la derecha.
  let steps = Math.round(-dragAngle / step) || 0;
  // Un lanzamiento corto (menos de medio frasco) también cambia de perfume.
  if (steps === 0 && Math.abs(velocity) > 0.6) steps = velocity > 0 ? -1 : 1;
  return steps;
}

/**
 * Estado compartido entre los controles de la tienda y la escena. La escena
 * lo lee en cada fotograma sin provocar renders de React.
 */
export type RingControl = {
  /** Giro al que va el anillo (continuo: puede pasar de una vuelta). */
  target: number;
  /** Giro añadido mientras se arrastra con el dedo o el ratón. */
  drag: number;
  /** Puntero sobre la sección (−1…1) para una leve paralaje de la cámara. */
  pointer: { x: number; y: number };
};

export function createRingControl(): RingControl {
  return { target: 0, drag: 0, pointer: { x: 0, y: 0 } };
}

export type Rect = { x: number; y: number; width: number; height: number };

export type CameraFit = {
  /** Distancia de la cámara al punto que mira. */
  distance: number;
  /** Desplazamiento del centro de la imagen (px), para setViewOffset. */
  offsetX: number;
  offsetY: number;
};

/**
 * Encaja el anillo en el hueco del escenario (`slot`, en px dentro del
 * lienzo). El frasco del frente ocupa `fill` del alto del hueco y los de los
 * lados caben a lo ancho (`sideReach`: hasta dónde llegan, en unidades, desde
 * el centro). La imagen se desplaza para que el anillo quede en el centro del
 * hueco aunque el lienzo ocupe toda la sección.
 */
export function fitCamera({
  canvas,
  slot,
  fovDeg,
  radius,
  bottleHeight,
  sideReach,
  fill = 0.62,
}: {
  canvas: { width: number; height: number };
  slot: Rect;
  fovDeg: number;
  radius: number;
  bottleHeight: number;
  sideReach: number;
  fill?: number;
}): CameraFit {
  const tan = Math.tan((fovDeg * Math.PI) / 360);
  const safeSlotH = Math.max(slot.height, 1);
  const safeSlotW = Math.max(slot.width, 1);
  // Alto: el frasco del frente está a `distance − radius` de la cámara.
  const byHeight =
    radius + (bottleHeight * canvas.height) / (2 * tan * fill * safeSlotH);
  // Ancho: los de los lados, a la distancia del centro del anillo.
  const byWidth = (sideReach * canvas.height) / (tan * safeSlotW);
  const distance = Math.max(byHeight, byWidth);
  return {
    distance,
    offsetX: slot.x + slot.width / 2 - canvas.width / 2,
    offsetY: slot.y + slot.height / 2 - canvas.height / 2,
  };
}
