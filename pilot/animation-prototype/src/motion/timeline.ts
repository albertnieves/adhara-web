import { clamp01, easings, range01 } from './easing';
import type { MotionSpec } from './spec';

export type Phase = 'S0' | 'S1' | 'S2' | 'S3' | 'S4' | 'S5';
export type TimelineEventName = 'opened' | 'risen' | 'rotated' | 'done';
export type TimelineMessage =
  | { type: 'event'; name: TimelineEventName }
  | { type: 'phase'; phase: Phase }
  | { type: 'reset' };

/** Instantes (s) en los que termina cada escena, contados desde el inicio de S1. */
export function phaseEnds(spec: MotionSpec) {
  const opened = spec.s1Open.duration;
  const risen = opened + spec.s2Rise.duration;
  const rotated = risen + spec.s3Spin.duration;
  const done = rotated + spec.s4Panel.duration;
  return { opened, risen, rotated, done } as const;
}

export function phaseAt(spec: MotionSpec, t: number): Phase {
  const e = phaseEnds(spec);
  if (t <= 0) return 'S0';
  if (t < e.opened) return 'S1';
  if (t < e.risen) return 'S2';
  if (t < e.rotated) return 'S3';
  if (t < e.done) return 'S4';
  return 'S5';
}

/** Estado de la escena en el instante `t`. Función pura: mismo `t`, mismo fotograma. */
export interface SceneSample {
  phase: Phase;
  /** Progreso de la apertura 0–1 (con curva). */
  open: number;
  /** Ángulo de la solapa (rad). */
  flapAngle: number;
  /** Ascenso del frasco 0–1. */
  rise: number;
  /** Descenso de la caja 0–1. */
  boxDrop: number;
  boxOpacity: number;
  /** Mezcla de la cámara entre la pose S0 y la frontal 0–1. */
  camera: number;
  /** Giro del frasco (rad). Vale exactamente 0 fuera de S3: termina de frente. */
  spin: number;
  /** Desplazamiento del encuadre para el panel 0–1. */
  framing: number;
}

export function sample(spec: MotionSpec, t: number): SceneSample {
  const e = phaseEnds(spec);
  const open = easings[spec.s1Open.ease](range01(t, 0, e.opened));
  const riseLinear = range01(t, e.opened, e.risen);
  const rise = easings[spec.s2Rise.ease](riseLinear);
  const [fadeA, fadeB] = spec.s2Rise.boxFade;
  const spinP = range01(t, e.risen, e.rotated);
  const spin =
    spinP >= 1 ? 0 : easings[spec.s3Spin.ease](spinP) * Math.PI * 2 * spec.s3Spin.turns;
  const framing = easings[spec.s4Panel.ease](range01(t, e.rotated, e.done));

  return {
    phase: phaseAt(spec, t),
    open,
    flapAngle: ((spec.s1Open.flapAngleDeg * Math.PI) / 180) * open,
    rise,
    boxDrop: rise,
    boxOpacity: 1 - clamp01(range01(riseLinear, fadeA, fadeB)),
    camera: rise,
    spin,
    framing,
  };
}

/**
 * Reloj de la coreografía. No depende de React ni de three: lo avanza el
 * render loop (`advance`) y emite eventos al cruzar cada límite de escena.
 */
export class Timeline {
  t = 0;
  playing = false;
  speed = 1;
  private fired = new Set<TimelineEventName>();
  private lastPhase: Phase = 'S0';
  private listeners = new Set<(m: TimelineMessage) => void>();

  constructor(readonly spec: MotionSpec) {}

  get total() {
    return phaseEnds(this.spec).done;
  }

  subscribe(fn: (m: TimelineMessage) => void) {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }

  play() {
    if (this.t >= this.total) return;
    this.playing = true;
  }

  pause() {
    this.playing = false;
  }

  /** Vuelve a S0 y reproduce desde el principio. */
  restart() {
    this.reset();
    this.playing = true;
  }

  reset() {
    this.t = 0;
    this.playing = false;
    this.fired.clear();
    this.emit({ type: 'reset' });
    this.sync();
  }

  /** Salta al estado final (S5) disparando los eventos pendientes en orden. */
  skipToEnd() {
    this.t = this.total;
    this.playing = false;
    this.sync();
  }

  advance(dt: number) {
    if (!this.playing) return;
    this.t = Math.min(this.total, this.t + dt * this.speed);
    if (this.t >= this.total) this.playing = false;
    this.sync();
  }

  private sync() {
    const ends = phaseEnds(this.spec);
    for (const name of ['opened', 'risen', 'rotated', 'done'] as const) {
      if (this.t >= ends[name] && !this.fired.has(name)) {
        this.fired.add(name);
        this.emit({ type: 'event', name });
      }
    }
    const phase = phaseAt(this.spec, this.t);
    if (phase !== this.lastPhase) {
      this.lastPhase = phase;
      this.emit({ type: 'phase', phase });
    }
  }

  private emit(m: TimelineMessage) {
    for (const fn of this.listeners) fn(m);
  }
}
