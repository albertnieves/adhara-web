import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Group } from 'three';
import { lerp } from '../motion/easing';
import { sample, type Timeline } from '../motion/timeline';
import type { ProductConfig } from '../products';
import { LatheBottle } from './bottles/LatheBottle';
import { RectPrismBottle } from './bottles/RectPrismBottle';
import { SquareGlassBottle } from './bottles/SquareGlassBottle';
import type { ProductDims } from './dims';
import { GREY } from './materials';
import { risePositions } from './rise';

interface Props {
  product: ProductConfig;
  dims: ProductDims;
  timeline: Timeline;
  grey: boolean;
}

/** Posición y giro vienen del timeline; la geometría, del arquetipo del producto. */
export function Bottle({ product, dims, timeline, grey }: Props) {
  const ref = useRef<Group>(null);
  const { start, end } = risePositions(dims, timeline.spec);

  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const s = sample(timeline.spec, timeline.t);
    g.position.y = lerp(start, end, s.rise);
    g.rotation.y = s.spin;
  });

  const m = grey ? GREY : product.materials;
  const front = grey ? null : product.frontTexture;
  const shape = product.bottle;

  return (
    <group ref={ref} position-y={start}>
      <group scale={dims.k}>
        {shape.archetype === 'lathe-shoulder' && <LatheBottle shape={shape} m={m} front={front} />}
        {shape.archetype === 'rect-prism' && <RectPrismBottle shape={shape} m={m} front={front} />}
        {shape.archetype === 'square-glass' && (
          <SquareGlassBottle shape={shape} m={m} grey={grey} />
        )}
      </group>
    </group>
  );
}
