import type { Ref } from 'react';
import type { Phase } from '../motion/timeline';
import type { ProductConfig } from '../products';

export const PHASE_LABEL: Record<Phase, string> = {
  S0: 'S0 · reposo',
  S1: 'S1 · apertura',
  S2: 'S2 · ascenso',
  S3: 'S3 · giro',
  S4: 'S4 · panel',
  S5: 'S5 · libre',
};

interface Props {
  products: readonly ProductConfig[];
  slug: string;
  onSlug: (slug: string) => void;
  onPlay: () => void;
  onRestart: () => void;
  onSkip: () => void;
  speed: number;
  onSpeed: (v: number) => void;
  grey: boolean;
  onGrey: (v: boolean) => void;
  simReduced: boolean;
  onSimReduced: (v: boolean) => void;
  realReduced: boolean;
  webgl: boolean;
  phase: Phase;
  fpsRef: Ref<HTMLSpanElement>;
  timeRef: Ref<HTMLSpanElement>;
  open: boolean;
  onOpen: (v: boolean) => void;
}

/** Controles de revisión. Viven fuera de la escena y no forman parte de la PDP. */
export function DebugDock(p: Props) {
  return (
    <section className="dock" data-open={p.open} aria-label="Controles de revisión">
      <div className="dock__bar">
        <strong className="dock__title">Revisión</strong>
        <span className="dock__phase" data-testid="phase">
          {PHASE_LABEL[p.phase]}
        </span>
        <span className="dock__metric dock__metric--time">
          t <span ref={p.timeRef}>0.00</span> s
        </span>
        <span className="dock__metric">
          <span ref={p.fpsRef} data-testid="fps">
            –
          </span>{' '}
          fps
        </span>
        <button type="button" className="dock__toggle" onClick={() => p.onOpen(!p.open)}>
          {p.open ? 'Ocultar' : 'Controles'}
        </button>
      </div>
      {p.open && (
        <div className="dock__body">
          <label className="field">
            Producto
            <select value={p.slug} onChange={(e) => p.onSlug(e.target.value)}>
              {p.products.map((x) => (
                <option key={x.slug} value={x.slug}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
          <div className="btns">
            <button type="button" onClick={p.onPlay}>
              Reproducir
            </button>
            <button type="button" onClick={p.onRestart}>
              Repetir
            </button>
            <button type="button" onClick={p.onSkip}>
              Saltar al final
            </button>
          </div>
          <label className="field field--range">
            Velocidad <output>{p.speed.toFixed(2)}×</output>
            <input
              type="range"
              min={0.25}
              max={2}
              step={0.25}
              value={p.speed}
              onChange={(e) => p.onSpeed(Number(e.target.value))}
            />
          </label>
          <label className="check">
            <input type="checkbox" checked={p.grey} onChange={(e) => p.onGrey(e.target.checked)} />
            Formas grises
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={p.simReduced}
              onChange={(e) => p.onSimReduced(e.target.checked)}
            />
            Simular reduced motion
          </label>
          <p className="dock__info">
            {p.realReduced && 'prefers-reduced-motion activo en el sistema · '}
            {p.webgl ? 'WebGL disponible' : 'Sin WebGL: fallback'}
          </p>
        </div>
      )}
    </section>
  );
}
