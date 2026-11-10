'use client';

import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'motion/react';
import type { PointerEvent } from 'react';
import { useState } from 'react';
import { Link } from '@/modules/i18n';
import type { DeckCard } from '../domain/collection-deck';
import { EASE } from './Hero';
import { ProductImage } from './ProductImage';

const SPRING = { stiffness: 140, damping: 20 };
/** Separación entre cartas: a la derecha y hacia el fondo. */
const STEP_X = 122;
const STEP_Z = 96;
/** Giro de las cartas en reposo: miran hacia el titular. */
const TURN = -20;

/**
 * Abanico 3D de la cabecera de la colección (DECISIONS §189): una fragancia
 * de cada casa, como cartas en perspectiva. Se reparten al cargar, flotan
 * despacio y el conjunto sigue un poco al cursor; la carta bajo el cursor (o
 * con el foco) sale del abanico, se pone de frente y enseña su nombre. Cada
 * carta enlaza a su ficha. Solo en pantallas anchas: en el resto, la rejilla
 * empieza antes.
 */
export function CollectionDeck({
  cards,
  label,
}: {
  cards: DeckCard[];
  /** Nombre de la lista para lectores de pantalla. */
  label: string;
}) {
  const reduced = useReducedMotion();
  const [active, setActive] = useState<number | null>(null);
  // Repartidas: desde entonces responden al cursor sin la espera del reparto.
  const [dealt, setDealt] = useState(false);
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const x = useSpring(pointerX, SPRING);
  const y = useSpring(pointerY, SPRING);
  const rotateY = useTransform(x, [-0.5, 0.5], [-5, 5]);
  const rotateX = useTransform(y, [-0.5, 0.5], [4, -4]);

  if (cards.length === 0) return null;

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (reduced || event.pointerType !== 'mouse') return;
    const box = event.currentTarget.getBoundingClientRect();
    pointerX.set((event.clientX - box.left) / box.width - 0.5);
    pointerY.set((event.clientY - box.top) / box.height - 0.5);
  };

  return (
    <div
      className="relative hidden h-80 [perspective:1500px] xl:block"
      onPointerMove={onPointerMove}
      onPointerLeave={() => {
        pointerX.set(0);
        pointerY.set(0);
      }}
    >
      <motion.ul
        aria-label={label}
        // El plano de la lista queda por delante de las cartas (van hacia el
        // fondo): sin esto se llevaría el cursor.
        className="pointer-events-none absolute inset-0 [transform-style:preserve-3d]"
        style={reduced ? undefined : { rotateX, rotateY }}
      >
        {cards.map((card, index) => {
          const on = active === index;
          return (
            <motion.li
              key={card.slug}
              className="absolute top-4 left-2 w-48 [transform-style:preserve-3d]"
              // Sin 3D (o al aplanarse), la primera carta queda encima.
              style={{ zIndex: on ? cards.length + 1 : cards.length - index }}
              initial={
                reduced
                  ? false
                  : {
                      opacity: 0,
                      x: index * STEP_X + 260,
                      z: -index * STEP_Z - 260,
                      rotateY: -72,
                    }
              }
              // La carta elegida sale recta hacia quien mira y se pone de frente.
              animate={{
                opacity: 1,
                x: index * STEP_X,
                y: on ? -10 : 0,
                z: on ? 110 : -index * STEP_Z,
                rotateY: on ? -4 : TURN,
              }}
              transition={
                reduced
                  ? { duration: 0 }
                  : dealt
                    ? { type: 'spring', stiffness: 150, damping: 21 }
                    : { duration: 1.5, delay: 0.25 + index * 0.13, ease: EASE }
              }
              onAnimationComplete={() => {
                if (index === cards.length - 1) setDealt(true);
              }}
            >
              <motion.div
                animate={reduced ? undefined : { y: [0, -7, 0] }}
                transition={{
                  duration: 7 + index * 1.4,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              >
                <Link
                  href={{
                    pathname: '/perfume/[slug]',
                    params: { slug: card.slug },
                  }}
                  aria-label={`${card.brand} ${card.name}`}
                  className="bg-stage pointer-events-auto relative block aspect-[4/5]"
                  style={{
                    boxShadow:
                      '0 36px 60px -34px color-mix(in oklab, var(--color-ink) 45%, transparent)',
                  }}
                  onPointerEnter={(event) => {
                    if (event.pointerType === 'mouse') setActive(index);
                  }}
                  onPointerLeave={() => setActive(null)}
                  onFocus={() => setActive(index)}
                  onBlur={() => setActive(null)}
                >
                  <span className="bg-stage absolute inset-4 block">
                    <ProductImage
                      media={card.media}
                      alt=""
                      brand={card.brand}
                      sizes="12rem"
                      priority={index < 2}
                    />
                  </span>
                  <span
                    aria-hidden
                    className={`bg-surface-raised ease-luxe absolute inset-x-0 bottom-0 block px-4 py-3 transition-opacity duration-(--duration-base) ${on ? 'opacity-100' : 'opacity-0'}`}
                  >
                    <span className="text-fg-muted text-2xs tracking-caps-lg block uppercase">
                      {card.brand}
                    </span>
                    <span className="font-display mt-0.5 line-clamp-1 block text-xl">
                      {card.name}
                    </span>
                  </span>
                </Link>
              </motion.div>
            </motion.li>
          );
        })}
      </motion.ul>
    </div>
  );
}
