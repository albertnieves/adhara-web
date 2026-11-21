'use client';

import { useEffect, useEffectEvent, useState } from 'react';
import { usePrefersReducedMotion } from './env';
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
  /** Volver a las fotos (cierra la escena y libera la tarjeta gráfica). */
  close: string;
};

export type UnboxingViewerProps = {
  scene: string;
  /** Color del contenedor (token --color-stage). */
  background: string;
  labels: UnboxingLabels;
  onClose: () => void;
  /** La escena no se pudo pintar: la ficha vuelve a las fotos (la compra nunca depende del 3D). */
  onFailed: () => void;
  /** Se llama una vez al abrirla: la medición anónima de interés de la tienda. */
  onSeen?: () => void;
};

/**
 * Escena de unboxing del piloto en la ficha. Solo existe cuando el cliente
 * la pide («Abrir la caja en 3D»): se reproduce al abrirla y, con
 * prefers-reduced-motion, muestra directamente el final. La ficha comprueba
 * antes que hay WebGL.
 */
export default function UnboxingViewer({
  scene,
  background,
  labels,
  onClose,
  onFailed,
  onSeen,
}: UnboxingViewerProps) {
  const product = findScene(scene);
  const [timeline] = useState(() => new Timeline(storefrontMotionSpec));
  const [phase, setPhase] = useState<Phase>('S0');
  const [playing, setPlaying] = useState(false);
  const reduced = usePrefersReducedMotion();
  const notifySeen = useEffectEvent(() => onSeen?.());
  const fail = useEffectEvent(() => onFailed());

  useEffect(
    () =>
      timeline.subscribe((message) => {
        if (message.type === 'phase') setPhase(message.phase);
        if (message.type === 'playing') setPlaying(message.playing);
      }),
    [timeline],
  );

  useEffect(() => {
    if (!product) {
      fail();
      return;
    }
    notifySeen();
  }, [product]);

  useEffect(() => {
    if (!product) return;
    if (reduced) {
      timeline.skipToEnd();
      return;
    }
    // Un instante con la caja cerrada antes de abrirla, como en la tienda.
    const timer = window.setTimeout(
      () => timeline.play(),
      timeline.spec.s0Rest.autoplayDelay * 1000,
    );
    return () => window.clearTimeout(timer);
  }, [timeline, reduced, product]);

  if (!product) return null;

  return (
    <div className="relative h-full w-full">
      <SceneErrorBoundary fallback={null} onError={onFailed}>
        <UnboxingScene
          product={product}
          timeline={timeline}
          background={background}
          free={phase === 'S5'}
          // Solo se repinta sin parar mientras se mueve la caja; quieta, al
          // girarla con el dedo o el ratón (ahorra batería en el móvil).
          animating={playing}
          label={labels.scene}
        />
      </SceneErrorBoundary>
      <button
        type="button"
        onClick={onClose}
        // El foco pasa aquí al abrir la escena: el botón que la abrió desaparece.
        autoFocus
        className="text-ink tracking-caps absolute top-3 right-3 inline-flex min-h-11 items-center px-2 text-xs uppercase underline-offset-4 hover:underline"
      >
        {labels.close}
      </button>
      {phase === 'S5' && (
        <div className="text-smoke tracking-caps absolute inset-x-0 bottom-5 flex items-center justify-center gap-6 text-xs uppercase">
          <span aria-hidden className="hidden sm:inline">
            {labels.dragHint}
          </span>
          <button
            type="button"
            onClick={() =>
              reduced ? timeline.skipToEnd() : timeline.restart()
            }
            className="link-underline text-ink"
          >
            {labels.replay}
          </button>
        </div>
      )}
    </div>
  );
}
