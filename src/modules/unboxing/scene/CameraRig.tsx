import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { PerspectiveCamera } from 'three';
import { Vector3 } from 'three';
import { lerp } from '../motion/easing';
import { sample, type Timeline } from '../motion/timeline';
import type { ProductDims } from './dims';
import { risePositions } from './rise';
import { deg } from './units';

/** Distancia a la que un objeto de alto h y ancho w ocupa `fill` del encuadre. */
function fitDistance(
  h: number,
  w: number,
  fill: number,
  fovDeg: number,
  aspect: number,
) {
  const t = Math.tan(deg(fovDeg) / 2);
  return Math.max(h / (fill * 2 * t), w / (fill * 2 * t * aspect));
}

function framingFor(timeline: Timeline, width: number) {
  const p = timeline.spec.s4Panel;
  return width < p.mobileBreakpointPx ? p.mobile : p.desktop;
}

/**
 * Cámara guiada por la coreografía (S0–S4). En S5 cede el control a
 * OrbitControls (sin pan, zoom y ángulo polar acotados).
 */
export function CameraRig({
  dims,
  timeline,
  free,
}: {
  dims: ProductDims;
  timeline: Timeline;
  free: boolean;
}) {
  const size = useThree((s) => s.size);
  const spec = timeline.spec;
  const rise = risePositions(dims, spec);
  const tmp = useMemo(
    () => ({ target: new Vector3(), pos: new Vector3() }),
    [],
  );
  // Al entrar en S5 (también si se salta directamente al final) se coloca la
  // cámara una vez en la pose final; después manda OrbitControls.
  const placedFree = useRef(false);
  useEffect(() => {
    if (!free) placedFree.current = false;
  }, [free]);

  // Objetos encuadrados: la caja en S0, el frasco a partir de S2.
  const boxObj = {
    h: dims.box.height * 1.15,
    w: Math.hypot(dims.box.width, dims.box.depth),
    y: dims.box.height * 0.55,
  };
  const bottleObj = {
    h: dims.bottle.height,
    w: dims.bottle.width,
    y: rise.centerEnd,
  };

  useFrame(({ camera }) => {
    const cam = camera as PerspectiveCamera;
    const s = sample(spec, timeline.t);
    const framing = framingFor(timeline, size.width);
    const aspect = size.width / size.height;

    // Durante S5 OrbitControls mueve la cámara; aquí solo se mantiene el encuadre.
    if (!free || !placedFree.current) {
      placedFree.current = free;
      const c = s.camera;
      const az = deg(
        lerp(spec.s0Rest.camera.azimuthDeg, spec.s2Rise.camera.azimuthDeg, c),
      );
      const el = deg(
        lerp(
          spec.s0Rest.camera.elevationDeg,
          spec.s2Rise.camera.elevationDeg,
          c,
        ),
      );
      const fill = lerp(
        lerp(spec.s0Rest.camera.fill, spec.s2Rise.camera.fill, c),
        framing.fill,
        s.framing,
      );
      const h = lerp(boxObj.h, bottleObj.h, c);
      const w = lerp(boxObj.w, bottleObj.w, c);
      tmp.target.set(0, lerp(boxObj.y, bottleObj.y, c), 0);
      const d = fitDistance(h, w, fill, spec.camera.fovDeg, aspect);
      tmp.pos.set(
        d * Math.cos(el) * Math.sin(az),
        d * Math.sin(el),
        d * Math.cos(el) * Math.cos(az),
      );
      cam.position.copy(tmp.target).add(tmp.pos);
      cam.lookAt(tmp.target);
    }

    cam.setViewOffset(
      size.width,
      size.height,
      framing.shiftX * size.width * s.framing,
      framing.shiftY * size.height * s.framing,
      size.width,
      size.height,
    );
  });

  if (!free) return null;
  const framing = framingFor(timeline, size.width);
  const d = fitDistance(
    bottleObj.h,
    bottleObj.w,
    framing.fill,
    spec.camera.fovDeg,
    size.width / size.height,
  );
  return (
    <OrbitControls
      target={[0, bottleObj.y, 0]}
      enablePan={false}
      minDistance={d / spec.s5Free.zoomMax}
      maxDistance={d / spec.s5Free.zoomMin}
      minPolarAngle={deg(spec.s5Free.polarMinDeg)}
      maxPolarAngle={deg(spec.s5Free.polarMaxDeg)}
    />
  );
}
