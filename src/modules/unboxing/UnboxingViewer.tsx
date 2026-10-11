'use client';

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from 'react';
import { detectWebGL, usePrefersReducedMotion } from './env';
import { storefrontMotionSpec } from './motion/storefront';
import type { Phase } from './motion/timeline';
import { Timeline } from './motion/timeline';
import { findScene } from './products';
import { UnboxingScene } from './scene/UnboxingScene';
import { SceneErrorBoundary } from './SceneErrorBoundary';

export type UnboxingLabels = {
  scene: string;
  replay: string;
  dragHint: string;
};

type Props = {
  scene: string;
  /** Color del contenedor (token --color-stage). */
  background: string;
  labels: UnboxingLabels;
  /** Imagen mostrada sin WebGL o si la escena falla: la compra nunca depende del 3D. */
  fallback: React.ReactNode;
  /**
   * Se llama una vez, la primera vez que la escena (con WebGL y sin fallo) se
   * ve en pantalla: la medición anónima de interés de la tienda.
   */
  onSeen?: () => void;
};

/**
 * Escena de unboxing del piloto en la ficha: se reproduce una vez al entrar
 * en pantalla; con prefers-reduced-motion se muestra directamente el final.
 */
export default function UnboxingViewer({
  scene,
  background,
  labels,
  fallback,
  onSeen,
}: Props) {
  const product = findScene(scene);
  const [timeline] = useState(() => new Timeline(storefrontMotionSpec));
  const [webgl] = useState(detectWebGL);
  const [failed, setFailed] = useState(false);
  const [phase, setPhase] = useState<Phase>('S0');
  const reduced = usePrefersReducedMotion();
  const container = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const seen = useRef(false);
  const notifySeen = useEffectEvent(() => onSeen?.());

  useEffect(
    () =>
      timeline.subscribe((message) => {
        if (message.type === 'phase') setPhase(message.phase);
      }),
    [timeline],
  );

  useEffect(() => {
    const node = container.current;
    if (!node || !product) return;
    if (reduced) {
      timeline.skipToEnd();
      return;
    }
    let timer: number | undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || started.current) return;
        started.current = true;
        timer = window.setTimeout(
          () => timeline.play(),
          timeline.spec.s0Rest.autoplayDelay * 1000,
        );
      },
      { threshold: 0.4 },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [timeline, reduced, product]);

  // onSeen va aparte de la reproducción: con movimiento reducido también cuenta.
  useEffect(() => {
    const node = container.current;
    if (!node || !product || seen.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || seen.current) return;
        seen.current = true;
        observer.disconnect();
        notifySeen();
      },
      { threshold: 0.4 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [product]);

  const replay = useCallback(() => {
    if (reduced) timeline.skipToEnd();
    else timeline.restart();
  }, [timeline, reduced]);

  if (!product || !webgl || failed) return <>{fallback}</>;

  return (
    <div ref={container} className="relative h-full w-full">
      <SceneErrorBoundary fallback={fallback} onError={() => setFailed(true)}>
        <UnboxingScene
          product={product}
          timeline={timeline}
          background={background}
          free={phase === 'S5'}
          label={labels.scene}
        />
      </SceneErrorBoundary>
      {phase === 'S5' && (
        <div className="text-smoke tracking-caps absolute inset-x-0 bottom-5 flex items-center justify-center gap-6 text-xs uppercase">
          <span aria-hidden className="hidden sm:inline">
            {labels.dragHint}
          </span>
          <button
            type="button"
            onClick={replay}
            className="link-underline text-ink"
          >
            {labels.replay}
          </button>
        </div>
      )}
    </div>
  );
}
