import { Canvas, useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Timeline } from '../motion/timeline';
import type { ProductConfig } from '../products';
import { Bottle } from './Bottle';
import { Box } from './Box';
import { CameraRig } from './CameraRig';
import { productDims } from './dims';
import { GREY } from './materials';
import { Stage } from './Stage';

interface Props {
  product: ProductConfig;
  timeline: Timeline;
  grey: boolean;
  free: boolean;
  onFps: (fps: number) => void;
}

/** Avanza el reloj de la coreografía con el render loop. */
function TimelineDriver({ timeline }: { timeline: Timeline }) {
  // Se limita dt para que una pestaña en segundo plano no salte escenas enteras.
  useFrame((_, dt) => timeline.advance(Math.min(dt, 1 / 20)));
  return null;
}

function FpsMeter({ onFps }: { onFps: (fps: number) => void }) {
  const acc = useRef({ frames: 0, time: 0 });
  useFrame((_, dt) => {
    const a = acc.current;
    a.frames += 1;
    a.time += dt;
    if (a.time >= 0.5) {
      onFps(a.frames / a.time);
      a.frames = 0;
      a.time = 0;
    }
  });
  return null;
}

export function UnboxingScene({ product, timeline, grey, free, onFps }: Props) {
  const dims = productDims(product);
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ fov: timeline.spec.camera.fovDeg, near: 0.05, far: 60, position: [0, 1, 6] }}
      gl={{ antialias: true, alpha: true }}
      aria-label={`Escena 3D de ${product.name}`}
    >
      <TimelineDriver timeline={timeline} />
      <FpsMeter onFps={onFps} />
      <Stage shadowScale={Math.max(dims.box.height, dims.bottle.height) * 3} />
      <CameraRig dims={dims} timeline={timeline} free={free} />
      <Box dims={dims} timeline={timeline} color={grey ? GREY.box : product.boxColor} />
      <Bottle product={product} dims={dims} timeline={timeline} grey={grey} />
    </Canvas>
  );
}
