import { describe, expect, it } from 'vitest';
import { storefrontMotionSpec } from '@/modules/unboxing/motion/storefront';
import {
  Timeline,
  type TimelineMessage,
} from '@/modules/unboxing/motion/timeline';

/*
 * La escena solo se repinta sin parar mientras avanza la coreografía
 * (DECISIONS §187): el reloj avisa al empezar y al parar, una vez cada vez.
 */
function playingMessages(timeline: Timeline) {
  const seen: boolean[] = [];
  timeline.subscribe((message: TimelineMessage) => {
    if (message.type === 'playing') seen.push(message.playing);
  });
  return seen;
}

describe('reloj de la escena 3D', () => {
  it('avisa al empezar y al llegar al final', () => {
    const timeline = new Timeline(storefrontMotionSpec);
    const seen = playingMessages(timeline);
    timeline.play();
    timeline.play();
    expect(seen).toEqual([true]);
    for (let i = 0; i < 1000 && timeline.playing; i++) timeline.advance(0.05);
    expect(timeline.t).toBe(timeline.total);
    expect(seen).toEqual([true, false]);
  });

  it('repetir vuelve a avisar y saltar al final lo para', () => {
    const timeline = new Timeline(storefrontMotionSpec);
    const seen = playingMessages(timeline);
    timeline.skipToEnd();
    expect(seen).toEqual([]);
    timeline.restart();
    expect(seen).toEqual([true]);
    timeline.skipToEnd();
    expect(seen).toEqual([true, false]);
    // Ya en el final, play no hace nada.
    timeline.play();
    expect(seen).toEqual([true, false]);
  });
});
