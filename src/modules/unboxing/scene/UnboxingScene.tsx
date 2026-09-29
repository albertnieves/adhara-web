import { Canvas, useFrame } from '@react-three/fiber';
import { Suspense } from 'react';
import type { Timeline } from '../motion/timeline';
import type { ProductConfig } from '../products';
import { Bottle } from './Bottle';
import { Box } from './Box';
import { CameraRig } from './CameraRig';
import { productDims } from './dims';
import { GREY_BOX } from './materials';
import { Stage } from './Stage';

interface Props {
  product: ProductConfig;
  timeline: Timeline;
  /** Color de fondo: el mismo que el contenedor HTML de la ficha. */
  background: string;
  free: boolean;
  label: string;
}

/** Avanza el reloj de la coreografía con el render loop. */
function TimelineDriver({ timeline }: { timeline: Timeline }) {
  // Se limita dt para que una pestaña en segundo plano no salte escenas enteras.
  useFrame((_, dt) => timeline.advance(Math.min(dt, 1 / 20)));
  return null;
}

export function UnboxingScene({
  product,
  timeline,
  background,
  free,
  label,
}: Props) {
  const dims = productDims(product);
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{
        fov: timeline.spec.camera.fovDeg,
        near: 0.05,
        far: 60,
        position: [0, 1, 6],
      }}
      gl={{ antialias: true }}
      aria-label={label}
    >
      {/*
        Fondo = el del contenedor. Sin fondo propio, el vidrio (transmission)
        refracta un canvas transparente y se ve blanco opaco.
      */}
      <color attach="background" args={[background]} />
      <TimelineDriver timeline={timeline} />
      <Stage shadowScale={Math.max(dims.box.height, dims.bottle.height) * 3} />
      <CameraRig dims={dims} timeline={timeline} free={free} />
      {/* Las imágenes cargan con Suspense: mientras tanto no se pinta esa pieza. */}
      <Suspense fallback={null}>
        <Box
          box={product.box}
          dims={dims}
          timeline={timeline}
          grey={false}
          greyColor={GREY_BOX}
          templates={false}
        />
      </Suspense>
      <Suspense fallback={null}>
        <Bottle
          product={product}
          dims={dims}
          timeline={timeline}
          grey={false}
        />
      </Suspense>
    </Canvas>
  );
}
