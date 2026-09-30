import { BufferAttribute, type BufferGeometry } from 'three';
import type { FrontProjection } from '../products/schema';

/**
 * Proyección frontal ortográfica: asigna a cada vértice (mm, origen en el centro
 * de la base) el píxel del draft que le corresponde. Como la geometría se midió
 * sobre el mismo draft, la etiqueta cae en su sitio sin recortes manuales.
 */
export function projectFront<G extends BufferGeometry>(
  geo: G,
  p: FrontProjection,
): G {
  const pos = geo.getAttribute('position');
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (p.centerXPx + pos.getX(i) * p.pxPerMm) / p.widthPx;
    uv[i * 2 + 1] = 1 - (p.baseYPx - pos.getY(i) * p.pxPerMm) / p.heightPx;
  }
  geo.setAttribute('uv', new BufferAttribute(uv, 2));
  return geo;
}

/**
 * UV de un PlaneGeometry(1, 1) llevadas a un cuadrilátero del draft
 * (sup.-izq., sup.-der., inf.-der., inf.-izq.), para placas vistas casi de frente.
 */
export function mapPlaneToQuad<G extends BufferGeometry>(
  geo: G,
  quad: readonly (readonly [number, number])[],
  widthPx: number,
  heightPx: number,
): G {
  const [tl, tr, br, bl] = quad as [
    readonly [number, number],
    readonly [number, number],
    readonly [number, number],
    readonly [number, number],
  ];
  // Orden de vértices de PlaneGeometry(1, 1, 1, 1): sup.-izq., sup.-der., inf.-izq., inf.-der.
  const corners = [tl, tr, bl, br];
  const uv = new Float32Array(8);
  corners.forEach(([x, y], i) => {
    uv[i * 2] = x / widthPx;
    uv[i * 2 + 1] = 1 - y / heightPx;
  });
  geo.setAttribute('uv', new BufferAttribute(uv, 2));
  return geo;
}

/**
 * Funde los bordes laterales de una «piel» de torno con alfa por vértice, para que
 * la textura no termine en un corte seco al girar. `arc` y `fade` en radianes.
 */
export function fadeLatheEdges<G extends BufferGeometry>(
  geo: G,
  arc: number,
  fade: number,
): G {
  const pos = geo.getAttribute('position');
  const color = new Float32Array(pos.count * 4);
  for (let i = 0; i < pos.count; i++) {
    const phi = Math.abs(Math.atan2(pos.getX(i), pos.getZ(i)));
    const t = Math.min(1, Math.max(0, (arc - phi) / fade));
    color.set([1, 1, 1, t * t * (3 - 2 * t)], i * 4);
  }
  geo.setAttribute('color', new BufferAttribute(color, 4));
  return geo;
}
