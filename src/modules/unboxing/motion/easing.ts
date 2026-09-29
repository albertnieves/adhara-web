import type { EaseName } from './spec';

export const easings: Record<EaseName, (t: number) => number> = {
  linear: (t) => t,
  easeOutCubic: (t) => 1 - (1 - t) ** 3,
  easeInOutCubic: (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
  easeInOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  easeOutQuart: (t) => 1 - (1 - t) ** 4,
};

export const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Progreso 0–1 de `t` dentro del tramo [a, b]. */
export const range01 = (t: number, a: number, b: number) =>
  b <= a ? (t >= b ? 1 : 0) : clamp01((t - a) / (b - a));
