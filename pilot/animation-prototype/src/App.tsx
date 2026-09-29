import { useCallback, useEffect, useRef, useState } from 'react';
import { motionSpec } from './motion/spec';
import { Timeline, type Phase } from './motion/timeline';
import { products } from './products';
import { UnboxingScene, type FrameStats } from './scene/UnboxingScene';
import { DebugDock } from './ui/DebugDock';
import { DraftBadge } from './ui/DraftBadge';
import { detectWebGL, usePrefersReducedMotion } from './ui/env';
import { Fallback } from './ui/Fallback';
import { ProductPanel } from './ui/ProductPanel';
import { SceneErrorBoundary } from './ui/SceneErrorBoundary';

const initialSlug = new URLSearchParams(window.location.search).get('p');

export function App() {
  const [timeline] = useState(() => new Timeline(motionSpec));
  // Solo en dev: permite capturar fotogramas deterministas (scripts de revisión).
  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as { __timeline?: Timeline }).__timeline = timeline;
  }, [timeline]);
  const [slug, setSlug] = useState(
    products.some((p) => p.slug === initialSlug) ? initialSlug! : products[0]!.slug,
  );
  const product = products.find((p) => p.slug === slug) ?? products[0]!;
  const [speed, setSpeed] = useState(1);
  const [grey, setGrey] = useState(
    () => new URLSearchParams(window.location.search).get('grey') === '1',
  );
  const [boxTemplates, setBoxTemplates] = useState(
    () => new URLSearchParams(window.location.search).get('templates') === '1',
  );
  const [simReduced, setSimReduced] = useState(false);
  const realReduced = usePrefersReducedMotion();
  const reduced = realReduced || simReduced;
  const [webglAvailable] = useState(detectWebGL);
  const [sceneFailed, setSceneFailed] = useState(false);
  const webgl = webglAvailable && !sceneFailed;
  const [phase, setPhase] = useState<Phase>('S0');
  const [panel, setPanel] = useState(false);
  const [dockOpen, setDockOpen] = useState(() => window.innerWidth >= 768);
  const fpsRef = useRef<HTMLSpanElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const costRef = useRef<HTMLSpanElement>(null);

  useEffect(
    () =>
      timeline.subscribe((m) => {
        if (m.type === 'phase') setPhase(m.phase);
        else if (m.type === 'reset') setPanel(false);
        else if (m.name === 'rotated') setPanel(true);
      }),
    [timeline],
  );

  useEffect(() => {
    timeline.speed = speed;
  }, [timeline, speed]);

  // Cada cambio de producto (o de reduced motion) vuelve a S0 y reproduce.
  // Con reduced motion: estado final directo, sin animación.
  useEffect(() => {
    timeline.reset();
    if (reduced || !webgl) {
      timeline.skipToEnd();
      return;
    }
    const id = window.setTimeout(
      () => timeline.play(),
      (motionSpec.s0Rest.autoplayDelay * 1000) / timeline.speed,
    );
    return () => window.clearTimeout(id);
  }, [timeline, slug, reduced, webgl]);

  const play = useCallback(() => {
    if (reduced) return timeline.skipToEnd();
    if (timeline.t >= timeline.total) timeline.restart();
    else timeline.play();
  }, [timeline, reduced]);
  const restart = useCallback(
    () => (reduced ? timeline.skipToEnd() : timeline.restart()),
    [timeline, reduced],
  );
  const skip = useCallback(() => timeline.skipToEnd(), [timeline]);

  const onFps = useCallback(
    ({ fps, calls, triangles }: FrameStats) => {
      if (fpsRef.current) fpsRef.current.textContent = fps.toFixed(0);
      if (costRef.current)
        costRef.current.textContent = `${calls} draw calls · ${(triangles / 1000).toFixed(1)}k tris`;
      if (timeRef.current) timeRef.current.textContent = timeline.t.toFixed(2);
    },
    [timeline],
  );

  const panelSeconds = reduced ? 0 : motionSpec.s4Panel.duration / speed;
  const fallback = <Fallback product={product} />;

  return (
    <div className="app" data-reduced={reduced}>
      <DebugDock
        products={products}
        slug={slug}
        onSlug={setSlug}
        onPlay={play}
        onRestart={restart}
        onSkip={skip}
        speed={speed}
        onSpeed={setSpeed}
        grey={grey}
        onGrey={setGrey}
        boxTemplates={boxTemplates}
        onBoxTemplates={setBoxTemplates}
        simReduced={simReduced}
        onSimReduced={setSimReduced}
        realReduced={realReduced}
        webgl={webgl}
        phase={phase}
        fpsRef={fpsRef}
        timeRef={timeRef}
        costRef={costRef}
        open={dockOpen}
        onOpen={setDockOpen}
      />
      <main className="stage" data-phase={phase}>
        <div className="stage__canvas">
          {webgl ? (
            <SceneErrorBoundary fallback={fallback} onError={() => setSceneFailed(true)}>
              <UnboxingScene
                key={product.slug}
                product={product}
                timeline={timeline}
                grey={grey}
                boxTemplates={boxTemplates}
                free={phase === 'S5'}
                onFps={onFps}
              />
            </SceneErrorBoundary>
          ) : (
            fallback
          )}
        </div>
        <DraftBadge />
        {webgl && phase === 'S5' && (
          <button type="button" className="replay" onClick={restart}>
            Repetir
          </button>
        )}
        <ProductPanel
          product={product}
          visible={panel || !webgl}
          enterSeconds={panelSeconds}
        />
      </main>
    </div>
  );
}
