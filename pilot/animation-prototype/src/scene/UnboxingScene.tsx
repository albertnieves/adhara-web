import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useRef } from 'react';
import type { Timeline } from '../motion/timeline';
import type { ProductConfig } from '../products';
import { Bottle } from './Bottle';
import { Box } from './Box';
import { CameraRig } from './CameraRig';
import { productDims } from './dims';
import { GREY_BOX } from './materials';
import { Stage } from './Stage';

/** Mismo valor que --bg en styles.css. */
const SCENE_BG = '#f6f4f0';

interface Props {
  product: ProductConfig;
  timeline: Timeline;
  grey: boolean;
  /** Plantillas rotuladas en las caras de la caja sin foto. */
  boxTemplates: boolean;
  free: boolean;
  onFps: (stats: FrameStats) => void;
}

export interface FrameStats {
  fps: number;
  /** Draw calls y triángulos del último fotograma (coste de la escena, sin depender de la GPU). */
  calls: number;
  triangles: number;
}

/** Avanza el reloj de la coreografía con el render loop. */
function TimelineDriver({ timeline }: { timeline: Timeline }) {
  // Se limita dt para que una pestaña en segundo plano no salte escenas enteras.
  useFrame((_, dt) => timeline.advance(Math.min(dt, 1 / 20)));
  return null;
}

/** Solo en dev: expone la escena para los scripts de revisión (capturas). */
function DevExpose() {
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    (window as unknown as { __scene?: unknown }).__scene = scene;
  }, [scene]);
  return null;
}

function FpsMeter({ onFps }: { onFps: (stats: FrameStats) => void }) {
  const acc = useRef({ frames: 0, time: 0 });
  useFrame(({ gl }, dt) => {
    const a = acc.current;
    a.frames += 1;
    a.time += dt;
    if (a.time >= 0.5) {
      onFps({
        fps: a.frames / a.time,
        calls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
      });
      a.frames = 0;
      a.time = 0;
    }
  });
  return null;
}

export function UnboxingScene({ product, timeline, grey, boxTemplates, free, onFps }: Props) {
  const dims = productDims(product);
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ fov: timeline.spec.camera.fovDeg, near: 0.05, far: 60, position: [0, 1, 6] }}
      gl={{ antialias: true }}
      aria-label={`Escena 3D de ${product.name}`}
    >
      {/*
        Fondo = --bg de styles.css. Sin fondo propio, el vidrio (transmission)
        refracta un canvas transparente y se ve blanco opaco.
      */}
      <color attach="background" args={[SCENE_BG]} />
      <TimelineDriver timeline={timeline} />
      {import.meta.env.DEV && <DevExpose />}
      <FpsMeter onFps={onFps} />
      <Stage shadowScale={Math.max(dims.box.height, dims.bottle.height) * 3} />
      <CameraRig dims={dims} timeline={timeline} free={free} />
      {/* Las imágenes cargan con Suspense: mientras tanto no se pinta esa pieza. */}
      <Suspense fallback={null}>
        <Box
          box={product.box}
          dims={dims}
          timeline={timeline}
          grey={grey}
          greyColor={GREY_BOX}
          templates={boxTemplates}
        />
      </Suspense>
      <Suspense fallback={null}>
        <Bottle product={product} dims={dims} timeline={timeline} grey={grey} />
      </Suspense>
    </Canvas>
  );
}
