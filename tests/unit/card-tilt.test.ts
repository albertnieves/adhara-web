import { describe, expect, it } from 'vitest';
import type { Axis } from '@/modules/storefront/ui/card-tilt';
import {
  atRest,
  stepAxis,
  tiltStyles,
} from '@/modules/storefront/ui/card-tilt';

/*
 * Muelle de la vitrina de las tarjetas (DECISIONS §200): mismas
 * correspondencias que tenía con `motion` y un muelle sin rebote que se
 * asienta en el cursor.
 */

describe('tiltStyles', () => {
  it('en el centro y sin elevar no inclina ni da sombra', () => {
    const { stage, photo, glare } = tiltStyles(0, 0, 0);
    expect(stage.transform).toBe('rotateX(0deg) rotateY(0deg)');
    expect(stage.boxShadow).toMatch(/^0 0px 0px 0px /);
    expect(photo.transform).toBe('translateX(0px) translateY(0px)');
    expect(glare.opacity).toBe('0');
    expect(glare.background).toContain('at 50% 45%');
  });

  it('con el cursor arriba a la derecha, los valores que daba motion', () => {
    // Cursor al 80 % del ancho y al 25 % del alto, elevada.
    const { stage, photo, glare } = tiltStyles(0.3, -0.25, 1);
    expect(stage.transform).toBe('rotateX(3.5deg) rotateY(5.4deg)');
    expect(stage.boxShadow).toMatch(/^0 30px 54px -28px /);
    expect(photo.transform).toBe('translateX(5.4px) translateY(-4.5px)');
    expect(glare.opacity).toBe('0.55');
    expect(glare.background).toContain('at 74% 25%');
  });

  it('no se sale de su recorrido, como useTransform', () => {
    const { stage, glare } = tiltStyles(2, -2, 3);
    expect(stage.transform).toBe('rotateX(7deg) rotateY(9deg)');
    expect(glare.opacity).toBe('0.55');
  });
});

describe('stepAxis', () => {
  const axis = (target: number): Axis => ({ value: 0, velocity: 0, target });

  it('llega al cursor sin pasarse (sin rebote)', () => {
    const a = axis(0.4);
    let max = 0;
    for (let frame = 0; frame < 120; frame++) {
      stepAxis(a, 1 / 60);
      max = Math.max(max, a.value);
    }
    expect(max).toBeLessThanOrEqual(0.4 + 1e-6);
    expect(a.value).toBeCloseTo(0.4, 3);
    expect(atRest(a)).toBe(true);
  });

  it('en un cuarto de segundo ya ha hecho casi todo el camino', () => {
    const a = axis(1);
    stepAxis(a, 0.25);
    expect(a.value).toBeGreaterThan(0.8);
    expect(atRest(a)).toBe(false);
  });

  it('da lo mismo en fotogramas largos que cortos', () => {
    const fast = axis(1);
    const slow = axis(1);
    for (let i = 0; i < 12; i++) stepAxis(fast, 1 / 120);
    for (let i = 0; i < 3; i++) stepAxis(slow, 1 / 30);
    expect(fast.value).toBeCloseTo(slow.value, 3);
  });
});
