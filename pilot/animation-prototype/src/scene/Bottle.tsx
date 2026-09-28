import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { Group } from 'three';
import { lerp } from '../motion/easing';
import { sample, type Timeline } from '../motion/timeline';
import type { ProductConfig } from '../products';
import { buildLatheShoulder } from './bottles/latheShoulder';
import type { ProductDims } from './dims';
import { GREY, PbrMaterial } from './materials';
import { risePositions } from './rise';

interface Props {
  product: ProductConfig;
  dims: ProductDims;
  timeline: Timeline;
  grey: boolean;
}

export function Bottle({ product, dims, timeline, grey }: Props) {
  const ref = useRef<Group>(null);
  const geo = useMemo(() => buildLatheShoulder(product.bottle), [product.bottle]);
  useEffect(
    () => () => {
      for (const g of [geo.body, geo.cap, geo.neck, geo.bodyRing, geo.capRim, geo.medallion])
        g?.dispose();
    },
    [geo],
  );

  const { start, end } = risePositions(dims, timeline.spec);

  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const s = sample(timeline.spec, timeline.t);
    g.position.y = lerp(start, end, s.rise);
    g.rotation.y = s.spin;
  });

  const m = grey ? GREY : product.materials;

  return (
    <group ref={ref} position-y={start}>
      <group scale={dims.k}>
        <mesh geometry={geo.body} castShadow>
          <PbrMaterial config={m.body} />
        </mesh>
        <mesh geometry={geo.neck}>
          <PbrMaterial config={m.accent} />
        </mesh>
        <mesh geometry={geo.cap} castShadow>
          <PbrMaterial config={m.cap} />
        </mesh>
        {geo.bodyRing && (
          <mesh geometry={geo.bodyRing}>
            <PbrMaterial config={m.accent} />
          </mesh>
        )}
        {geo.capRim && (
          <mesh geometry={geo.capRim}>
            <PbrMaterial config={m.accent} />
          </mesh>
        )}
        {geo.medallion && (
          <mesh geometry={geo.medallion}>
            <PbrMaterial config={m.accent} />
          </mesh>
        )}
      </group>
    </group>
  );
}
