import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect } from 'react';
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
  /** La coreografía avanza: se pinta cada fotograma. Quieta, solo al cambiar algo. */
  animating: boolean;
  label: string;
}

/**
 * Con frameloop="demand" r3f solo pinta cuando algo lo pide: al parar la
 * coreografía o al dejar libre la cámara hace falta un fotograma más.
 */
function Repaint({ animating, free }: { animating: boolean; free: boolean }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => invalidate(), [invalidate, animating, free]);
  return null;
}

/** Resolución máxima: 1,5 en pantallas de móvil y tableta (menos píxeles que pintar), 2 en el resto. */
function maxDpr() {
  return window.matchMedia('(max-width: 1023px)').matches ? 1.5 : 2;
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
  animating,
  label,
}: Props) {
  const dims = productDims(product);
  return (
    <Canvas
      dpr={[1, maxDpr()]}
      frameloop={animating ? 'always' : 'demand'}
      camera={{
        fov: timeline.spec.camera.fovDeg,
        near: 0.05,
        far: 60,
        position: [0, 1, 6],
      }}
      gl={{ antialias: true }}
      role="img"
      aria-label={label}
    >
      {/*
        Fondo = el del contenedor. Sin fondo propio, el vidrio (transmission)
        refracta un canvas transparente y se ve blanco opaco.
      */}
      <color attach="background" args={[background]} />
      <TimelineDriver timeline={timeline} />
      <Repaint animating={animating} free={free} />
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
