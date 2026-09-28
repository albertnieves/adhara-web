import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { MeshStandardMaterial, type Group } from 'three';
import { sample, type Timeline } from '../motion/timeline';
import type { ProductDims } from './dims';

interface Props {
  dims: ProductDims;
  timeline: Timeline;
  color: string;
}

type V3 = [number, number, number];

/**
 * Caja procedural: fondo + 4 paredes (abierta por arriba) y una solapa superior
 * con bisagra en el canto trasero (grupo pivotado).
 */
export function Box({ dims, timeline, color }: Props) {
  const root = useRef<Group>(null);
  const flap = useRef<Group>(null);
  // Un único material para todas las caras: el fundido es uno solo.
  const material = useMemo(
    () => new MeshStandardMaterial({ color, roughness: 0.9, metalness: 0 }),
    [color],
  );
  useEffect(() => () => material.dispose(), [material]);

  const { width: W, height: H, depth: D } = dims.box;
  const t = dims.wall;

  useFrame(() => {
    const s = sample(timeline.spec, timeline.t);
    if (root.current) {
      root.current.position.y = -s.boxDrop * timeline.spec.s2Rise.boxDrop * H;
      root.current.visible = s.boxOpacity > 0.002;
    }
    if (flap.current) flap.current.rotation.x = s.flapAngle;
    const fading = s.boxOpacity < 0.999;
    material.opacity = s.boxOpacity;
    if (material.transparent !== fading) {
      material.transparent = fading;
      material.depthWrite = !fading;
      material.needsUpdate = true;
    }
  });

  const panel = (size: V3, pos: V3) => (
    <mesh position={pos} material={material} castShadow>
      <boxGeometry args={size} />
    </mesh>
  );

  return (
    <group ref={root}>
      {panel([W, t, D], [0, t / 2, 0])}
      {panel([W, H, t], [0, H / 2, D / 2 - t / 2])}
      {panel([W, H, t], [0, H / 2, -D / 2 + t / 2])}
      {panel([t, H, D - 2 * t], [-W / 2 + t / 2, H / 2, 0])}
      {panel([t, H, D - 2 * t], [W / 2 - t / 2, H / 2, 0])}
      <group ref={flap} position={[0, H, -D / 2]}>
        {panel([W, t, D], [0, t / 2, D / 2])}
        {/* Lengüeta que se mete por dentro de la pared frontal. */}
        {panel([W - 3 * t, D * 0.16, t], [0, -D * 0.08 + t, D - 2 * t])}
      </group>
    </group>
  );
}
