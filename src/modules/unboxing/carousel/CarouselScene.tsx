'use client';

import { Environment, Lightformer, Sparkles, Stars } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import type { RefObject } from 'react';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type {
  Fog,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  SpotLight,
} from 'three';
import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  MathUtils,
  Object3D,
} from 'three';
import { detectHardwareWebGL } from '../env';
import type { UnboxingSceneSlug } from '../index';
import type { ProductConfig } from '../products';
import { findScene } from '../products';
import { BottleShape } from '../scene/Bottle';
import { productDims } from '../scene/dims';
import { SceneErrorBoundary } from '../SceneErrorBoundary';
import type { CameraFit, Rect, RingControl } from './ring';
import { fitCamera, frontness, nearestIndex, ringStep } from './ring';
import { DEFAULT_TINT, HALO_TINTS, NIGHT } from './tints';

/** Radio del anillo (1 unidad = 100 mm). */
const RADIUS = 1.3;
/** Borde de la peana, un poco más allá de los frascos. */
const PLINTH = RADIUS + 0.62;
const FOV = 28;
/** Cámara algo por encima: se ve la peana y el anillo en perspectiva. */
const ELEVATION = MathUtils.degToRad(7);
/** Punto que mira la cámara: media altura del frasco del frente. */
const LOOK_Y = 0.66;
/** Altura máxima de la cámara sobre LOOK_Y (los frascos miden 1,4). */
const CAMERA_TOP = 0.7;
const GOLD = '#a8844f';

type Props = {
  /** Escenas en el orden del carrusel (las de los perfumes publicados). */
  scenes: readonly string[];
  control: RefObject<RingControl>;
  /** Perfume al frente (con movimiento reducido, cuándo volver a pintar). */
  activeIndex: number;
  /** Hueco de la maqueta donde debe quedar el anillo. */
  slot: RefObject<HTMLElement | null>;
  /** false fuera de pantalla: no se pinta nada. */
  running: boolean;
  reduced: boolean;
  onReady: () => void;
  /** Sin WebGL o si la escena falla: la portada enseña fotos (nunca depende del 3D). */
  onUnavailable: () => void;
};

/** Halo: degradado radial generado una vez (sin descargar imágenes). */
function useHaloTexture() {
  const texture = useMemo(() => {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const g = ctx.createRadialGradient(
        size / 2,
        size / 2,
        0,
        size / 2,
        size / 2,
        size / 2,
      );
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.35, 'rgba(255,255,255,0.42)');
      g.addColorStop(0.7, 'rgba(255,255,255,0.1)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
    }
    return new CanvasTexture(canvas);
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

/** Encaja la cámara en el hueco del escenario y la mueve con el puntero. */
function Rig({
  slot,
  control,
  reduced,
}: {
  slot: RefObject<HTMLElement | null>;
  control: RefObject<RingControl>;
  reduced: boolean;
}) {
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const [rect, setRect] = useState<Rect | null>(null);
  const yaw = useRef(0);
  const pitch = useRef(0);

  useEffect(() => {
    const node = slot.current;
    if (!node) return;
    const measure = () => {
      const c = gl.domElement.getBoundingClientRect();
      const s = node.getBoundingClientRect();
      setRect({
        x: s.left - c.left,
        y: s.top - c.top,
        width: s.width,
        height: s.height,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    observer.observe(gl.domElement);
    // La fuente del titular puede llegar después y mover el hueco sin cambiar su tamaño.
    let active = true;
    void document.fonts?.ready.then(() => {
      if (active) measure();
    });
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [slot, gl, size.width, size.height]);

  const fit = useMemo(() => {
    if (!rect || size.width === 0 || size.height === 0) return null;
    const narrow = rect.width < 560;
    return fitCamera({
      canvas: size,
      slot: rect,
      fovDeg: FOV,
      radius: RADIUS,
      bottleHeight: 1.42,
      // En el móvil, los frascos de los lados pueden asomar cortados.
      sideReach: narrow ? RADIUS - 0.05 : RADIUS + 0.5,
      fill: narrow ? 0.7 : 0.6,
    });
  }, [rect, size]);

  // Al cambiar el encaje hace falta un fotograma (con movimiento reducido no hay bucle).
  useEffect(() => {
    if (fit) invalidate();
  }, [fit, invalidate]);

  const applied = useRef<CameraFit | null>(null);

  useFrame((state, delta) => {
    if (!fit) return;
    const camera = state.camera as PerspectiveCamera;
    if (applied.current !== fit) {
      applied.current = fit;
      camera.fov = FOV;
      camera.setViewOffset(
        state.size.width,
        state.size.height,
        -fit.offsetX,
        -fit.offsetY,
        state.size.width,
        state.size.height,
      );
      camera.updateProjectionMatrix();
      const fog = state.scene.fog as Fog | null;
      if (fog) {
        // Los frascos de atrás se funden con la noche; el del frente, no.
        fog.near = fit.distance - RADIUS * 0.4;
        fog.far = fit.distance + RADIUS + 3.2;
      }
    }
    const dt = Math.min(delta, 1 / 20);
    const goalYaw = reduced ? 0 : control.current.pointer.x * 0.07;
    const goalPitch = reduced ? 0 : control.current.pointer.y * 0.03;
    yaw.current = MathUtils.damp(yaw.current, goalYaw, 2, dt);
    pitch.current = MathUtils.damp(pitch.current, goalPitch, 2, dt);
    const d = fit.distance;
    // Por debajo de los tapones: el frasco de atrás queda oculto tras el del
    // frente en vez de asomar por encima.
    const height = Math.min(
      d * Math.sin(ELEVATION + pitch.current),
      CAMERA_TOP,
    );
    const elevation = Math.asin(height / d);
    camera.position.set(
      d * Math.sin(yaw.current) * Math.cos(elevation),
      LOOK_Y + height,
      d * Math.cos(yaw.current) * Math.cos(elevation),
    );
    camera.lookAt(0, LOOK_Y, 0);
  });
  return null;
}

/** Los frascos en el anillo; el del frente se balancea despacio y el de atrás encoge. */
function Ring({
  products,
  control,
  reduced,
}: {
  products: ProductConfig[];
  control: RefObject<RingControl>;
  reduced: boolean;
}) {
  const ring = useRef<Group>(null);
  const spins = useRef<(Group | null)[]>([]);
  const angle = useRef<number | null>(null);
  const count = products.length;
  const step = ringStep(count);

  // Los frascos proyectan sombra sobre la peana (las texturas ya han cargado:
  // el Suspense de fuera espera a todo el anillo).
  useEffect(() => {
    ring.current?.traverse((node) => {
      if ((node as Mesh).isMesh) node.castShadow = true;
    });
  }, []);

  useFrame((state, delta) => {
    const g = ring.current;
    if (!g) return;
    const dt = Math.min(delta, 1 / 20);
    const { target, drag } = control.current;
    const goal = target + drag;
    // Al arrastrar sigue al dedo; al soltar llega despacio (curva luxe).
    const now =
      reduced || angle.current === null
        ? goal
        : MathUtils.damp(angle.current, goal, drag ? 16 : 2.4, dt);
    angle.current = now;
    g.rotation.y = now;
    const t = state.clock.elapsedTime;
    spins.current.forEach((spin, i) => {
      if (!spin) return;
      const f = frontness(i, count, now);
      spin.rotation.y = reduced ? 0 : Math.sin(t * 0.5 + i) * 0.28 * f ** 3;
      // El que pasa por detrás encoge un poco: queda oculto tras el del frente
      // en vez de asomar por los lados (los frascos no miden lo mismo de ancho).
      const back = Math.max(0, -Math.cos(i * step + now));
      spin.scale.setScalar(1 - 0.3 * back ** 2);
    });
  });

  return (
    <group ref={ring}>
      {products.map((product, i) => {
        const phi = i * step;
        const k = productDims(product).k;
        return (
          <group
            key={product.slug}
            position={[RADIUS * Math.sin(phi), 0, RADIUS * Math.cos(phi)]}
            rotation-y={phi}
          >
            <group
              ref={(node) => {
                spins.current[i] = node;
              }}
            >
              <group scale={k}>
                <BottleShape product={product} />
              </group>
            </group>
          </group>
        );
      })}
    </group>
  );
}

/** Peana lacada con el filo y la órbita de los frascos en oro. */
function Plinth() {
  return (
    <group>
      <mesh position-y={-0.035} receiveShadow>
        <cylinderGeometry args={[PLINTH, PLINTH + 0.02, 0.07, 128]} />
        {/* Mate: a ras de la cámara, una peana brillante refleja la luz y parece dorada. */}
        <meshStandardMaterial
          color="#13110e"
          roughness={0.85}
          metalness={0}
          envMapIntensity={0.12}
        />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position-y={0.001}>
        <torusGeometry args={[PLINTH, 0.007, 8, 160]} />
        <meshStandardMaterial
          color={GOLD}
          roughness={0.25}
          metalness={1}
          emissive={GOLD}
          emissiveIntensity={0.15}
        />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position-y={0.002}>
        <torusGeometry args={[RADIUS, 0.0035, 6, 160]} />
        <meshStandardMaterial
          color={GOLD}
          roughness={0.3}
          metalness={1}
          emissive={GOLD}
          emissiveIntensity={0.25}
        />
      </mesh>
      {/* Suelo del color de la noche: tapa las estrellas bajas sin verse. */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.07}>
        <circleGeometry args={[60, 64]} />
        <meshBasicMaterial color={NIGHT} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Halo detrás del anillo que toma el color del perfume del frente. */
function Halo({
  scenes,
  control,
  reduced,
}: {
  scenes: readonly string[];
  control: RefObject<RingControl>;
  reduced: boolean;
}) {
  const texture = useHaloTexture();
  const material = useRef<MeshBasicMaterial>(null);
  const goal = useMemo(() => new Color(), []);
  useFrame((_, delta) => {
    const m = material.current;
    if (!m) return;
    const index = nearestIndex(
      control.current.target + control.current.drag,
      scenes.length,
    );
    const slug = scenes[index] as UnboxingSceneSlug | undefined;
    goal.set((slug && HALO_TINTS[slug]) || DEFAULT_TINT);
    if (reduced) m.color.copy(goal);
    else m.color.lerp(goal, 1 - Math.exp(-2.2 * Math.min(delta, 1 / 20)));
  });
  return (
    // Se apaga antes de llegar al suelo: si no, el suelo lo corta en una línea.
    <mesh position={[0, 1.75, -RADIUS - 2.4]}>
      <planeGeometry args={[9, 4.6]} />
      <meshBasicMaterial
        ref={material}
        map={texture}
        transparent
        opacity={0.34}
        depthWrite={false}
        fog={false}
        toneMapped={false}
        blending={AdditiveBlending}
      />
    </mesh>
  );
}

/** Foco cálido sobre el frasco del frente: los demás quedan en penumbra. */
function KeyLight() {
  const light = useRef<SpotLight>(null);
  const target = useMemo(() => new Object3D(), []);
  useEffect(() => {
    target.position.set(0, 0.55, RADIUS);
    target.updateMatrixWorld();
    if (light.current) light.current.target = target;
  }, [target]);
  return (
    <spotLight
      ref={light}
      position={[0.6, 5.4, RADIUS + 2.6]}
      angle={0.3}
      penumbra={0.9}
      intensity={80}
      decay={2}
      color="#ffeedd"
      castShadow
      shadow-mapSize={[1024, 1024]}
      shadow-bias={-0.0004}
      shadow-normalBias={0.02}
    />
  );
}

/** Avisa cuando los frascos (y sus texturas) ya están en la escena. */
function Ready({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    onReady();
  }, [onReady]);
  return null;
}

/**
 * Con movimiento reducido la escena se pinta bajo demanda: un fotograma cada
 * vez que cambia el perfume del frente (el anillo salta, sin girar).
 */
function RedrawOn({ index }: { index: number }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    invalidate();
  }, [index, invalidate]);
  return null;
}

function Scene({
  products,
  control,
  activeIndex,
  slot,
  reduced,
  onReady,
}: {
  products: ProductConfig[];
  control: RefObject<RingControl>;
  activeIndex: number;
  slot: RefObject<HTMLElement | null>;
  reduced: boolean;
  onReady: () => void;
}) {
  return (
    <>
      <color attach="background" args={[NIGHT]} />
      <fog attach="fog" args={[NIGHT, 6, 16]} />
      <RedrawOn index={activeIndex} />
      <Rig slot={slot} control={control} reduced={reduced} />
      <hemisphereLight args={['#d9cbb5', NIGHT, 0.2]} />
      <directionalLight
        position={[0, 3.2, -4]}
        intensity={1.6}
        color="#e6c48a"
      />
      <directionalLight
        position={[-4, 1.5, 3]}
        intensity={0.25}
        color="#c9d2e0"
      />
      <KeyLight />
      <Environment resolution={256} frames={1} environmentIntensity={0.7}>
        <color attach="background" args={['#050404']} />
        <Lightformer
          form="rect"
          intensity={2.4}
          position={[0, 5, 2]}
          scale={[6, 2, 1]}
          target={[0, 0, 0]}
          color="#fff3e0"
        />
        <Lightformer
          form="rect"
          intensity={1.8}
          position={[-4.5, 1.6, 1.5]}
          scale={[0.6, 5, 1]}
          target={[0, 1, 0]}
          color="#f2d7a8"
        />
        <Lightformer
          form="rect"
          intensity={1.2}
          position={[4.5, 1.6, -0.5]}
          scale={[0.6, 5, 1]}
          target={[0, 1, 0]}
        />
        <Lightformer
          form="ring"
          intensity={0.8}
          position={[0, 2, -5]}
          scale={3}
          target={[0, 1, 0]}
          color="#d6bf98"
        />
      </Environment>
      <Stars
        radius={34}
        depth={26}
        count={900}
        factor={2.4}
        saturation={0}
        fade
        speed={reduced ? 0 : 0.5}
      />
      <Halo
        scenes={products.map((p) => p.slug)}
        control={control}
        reduced={reduced}
      />
      <Plinth />
      <Suspense fallback={null}>
        <Ring products={products} control={control} reduced={reduced} />
        <Ready onReady={onReady} />
      </Suspense>
      {/* Polvo dorado en el haz de luz: el perfume en el aire. */}
      <Sparkles
        count={36}
        position={[0, 1, RADIUS]}
        scale={[2.2, 1.9, 1.4]}
        size={2.2}
        speed={reduced ? 0 : 0.22}
        opacity={0.5}
        noise={0.6}
        color="#e8cf9f"
      />
    </>
  );
}

/**
 * Carrusel 3D de la portada: los frascos del piloto en una peana giratoria
 * de noche. Se carga con next/dynamic (three.js solo en el cliente) y deja de
 * pintar fuera de pantalla. Es decorativo (el contenedor va con aria-hidden):
 * el nombre, el precio y los controles son HTML.
 */
export default function CarouselScene({
  scenes,
  control,
  activeIndex,
  slot,
  running,
  reduced,
  onReady,
  onUnavailable,
}: Props) {
  const [webgl] = useState(detectHardwareWebGL);
  const [failed, setFailed] = useState(false);
  const products = useMemo(
    () =>
      scenes
        .map((slug) => findScene(slug))
        .filter((p): p is ProductConfig => Boolean(p)),
    [scenes],
  );
  const unavailable = !webgl || failed || products.length === 0;

  useEffect(() => {
    if (unavailable) onUnavailable();
  }, [unavailable, onUnavailable]);

  if (unavailable) return null;

  return (
    <SceneErrorBoundary fallback={null} onError={() => setFailed(true)}>
      <Canvas
        shadows="percentage"
        dpr={[1, 1.5]}
        // Con movimiento reducido solo se pinta cuando algo cambia.
        frameloop={!running ? 'never' : reduced ? 'demand' : 'always'}
        camera={{ fov: FOV, near: 0.1, far: 140, position: [0, 1.5, 9] }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <Scene
          products={products}
          control={control}
          activeIndex={activeIndex}
          slot={slot}
          reduced={reduced}
          onReady={onReady}
        />
      </Canvas>
    </SceneErrorBoundary>
  );
}
