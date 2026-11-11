'use client';

import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'motion/react';
import type { PointerEvent } from 'react';
import { useEffect, useState } from 'react';
import { Eyebrow } from '@/components/ui';

export type ScentTier = { key: string; label: string; hint: string };

const SPRING = { stiffness: 120, damping: 18 };
const MARKS = ['I', 'II', 'III'];
/** Diámetro de cada piso (rem): se ensanchan de la salida al fondo. */
const SIZES = [9, 14, 19];
/** Altura de cada piso sobre el fondo (px). */
const LIFTS = [150, 75, 0];
/**
 * Segundos de una vuelta del punto de cada piso: la salida pasa en minutos,
 * el corazón dura horas y el fondo, el día entero.
 */
const ORBITS = [
  '[animation-duration:6s]',
  '[animation-duration:14s]',
  '[animation-duration:30s]',
];
/** Cada cuánto pasa la luz al piso siguiente (ms). */
const BEAT = 2600;

/**
 * Pirámide olfativa de la cabecera del catálogo olfativo (DECISIONS §189):
 * tres discos en perspectiva, de la salida al fondo, que flotan y siguen un
 * poco al cursor. La luz recorre los pisos de arriba abajo, como se va
 * abriendo un perfume, y se queda en el piso sobre el que está el cursor. La
 * figura es decorativa: los nombres y las explicaciones van en la lista.
 */
export function ScentTiers({ tiers }: { tiers: ScentTier[] }) {
  const reduced = useReducedMotion();
  const [held, setHeld] = useState<number | null>(null);
  const [beat, setBeat] = useState(0);
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const x = useSpring(pointerX, SPRING);
  const y = useSpring(pointerY, SPRING);
  const rotateY = useTransform(x, [-0.5, 0.5], [-10, 10]);
  const rotateX = useTransform(y, [-0.5, 0.5], [7, -7]);

  // Un compás de pausa entre vueltas (beat === tiers.length: ninguno).
  useEffect(() => {
    if (reduced || held !== null) return;
    const id = window.setInterval(
      () => setBeat((value) => (value + 1) % (tiers.length + 1)),
      BEAT,
    );
    return () => window.clearInterval(id);
  }, [reduced, held, tiers.length]);

  const active = held ?? (reduced || beat >= tiers.length ? null : beat);

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (reduced || event.pointerType !== 'mouse') return;
    const box = event.currentTarget.getBoundingClientRect();
    pointerX.set((event.clientX - box.left) / box.width - 0.5);
    pointerY.set((event.clientY - box.top) / box.height - 0.5);
  };

  return (
    <div
      className="border-border grid items-center gap-x-10 gap-y-8 border-t pt-6 xl:grid-cols-[20rem_minmax(0,1fr)] xl:border-t-0 xl:pt-0"
      onPointerMove={onPointerMove}
      onPointerLeave={() => {
        pointerX.set(0);
        pointerY.set(0);
      }}
    >
      <div
        aria-hidden
        className="relative mx-auto h-80 w-full max-w-xs [perspective:1100px]"
      >
        <motion.div
          className="absolute inset-0 [transform-style:preserve-3d]"
          style={reduced ? undefined : { rotateX, rotateY }}
        >
          <motion.div
            className="absolute inset-0 [transform-style:preserve-3d]"
            animate={reduced ? undefined : { y: [0, -8, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          >
            {/* El suelo de la figura: inclinado, los discos se ven como elipses apiladas. */}
            <div className="absolute top-[70%] left-1/2 size-0 [transform:rotateX(64deg)] [transform-style:preserve-3d]">
              {tiers.slice(0, 3).map((tier, index) => {
                const size = SIZES[index] ?? SIZES[0]!;
                const on = active === index;
                return (
                  <motion.div
                    key={tier.key}
                    className={`ease-luxe absolute rounded-full border transition-colors duration-(--duration-slow) ${
                      on
                        ? 'border-accent-fg bg-accent/40'
                        : 'border-accent/55 bg-accent/10'
                    }`}
                    style={{
                      width: `${size}rem`,
                      height: `${size}rem`,
                      left: `${-size / 2}rem`,
                      top: `${-size / 2}rem`,
                    }}
                    initial={false}
                    animate={{ z: (LIFTS[index] ?? 0) + (on ? 18 : 0) }}
                    transition={
                      reduced
                        ? { duration: 0 }
                        : { type: 'spring', stiffness: 110, damping: 15 }
                    }
                  >
                    {/* Aro interior: da grosor al disco, como la órbita de la peana de la portada. */}
                    <span className="border-accent/30 absolute inset-[12%] rounded-full border" />
                    <span
                      className={`absolute inset-0 animate-spin ${ORBITS[index] ?? ''}`}
                    >
                      <span className="bg-accent-fg absolute top-0 left-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full" />
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      </div>

      <ol className="grid gap-8 sm:grid-cols-3 xl:grid-cols-1 xl:gap-7">
        {tiers.map((tier, index) => (
          <li
            key={tier.key}
            className="flex gap-5"
            onPointerEnter={(event) => {
              if (event.pointerType === 'mouse') setHeld(index);
            }}
            onPointerLeave={() => setHeld(null)}
          >
            <span
              aria-hidden
              className="font-display text-accent-fg w-9 shrink-0 text-4xl font-light"
            >
              {MARKS[index]}
            </span>
            <div className="min-w-0">
              <Eyebrow as="h2">{tier.label}</Eyebrow>
              <span
                aria-hidden
                className={`bg-accent-fg ease-luxe mt-2 block h-px w-full origin-left transition-transform duration-(--duration-slow) ${active === index ? 'scale-x-100' : 'scale-x-0'}`}
              />
              <p className="text-fg-muted mt-2 text-sm leading-relaxed">
                {tier.hint}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
