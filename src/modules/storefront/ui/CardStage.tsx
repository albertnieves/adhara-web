'use client';

import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'motion/react';
import type { PointerEvent, ReactNode } from 'react';
import type { ProductMedia } from '@/modules/catalog';
import { ProductImage } from './ProductImage';

const SPRING = { stiffness: 160, damping: 20, mass: 0.6 };

/**
 * Vitrina de una tarjeta de perfume (DECISIONS §189): el recuadro de la foto
 * se inclina en perspectiva hacia el cursor, la foto flota un poco por encima
 * (se desplaza con él) y un brillo recorre el fondo. Al pasar el cursor por la
 * tarjeta entera, la foto se acerca y, si hay una segunda (la caja), aparece
 * con un fundido. En pantallas táctiles no hay inclinación: la foto deriva con
 * el scroll (`scroll-drift`). Con «reducir movimiento», nada de esto.
 *
 * Va dentro de un enlace con la clase `group`.
 */
export function CardStage({
  media,
  alternate = null,
  alt,
  brand,
  sizes,
  priority = false,
  inset,
  children,
}: {
  media: ProductMedia | null;
  /** Segunda foto, que sustituye a la primera al pasar el cursor. */
  alternate?: ProductMedia | null;
  alt: string;
  brand: string;
  sizes: string;
  priority?: boolean;
  /** Margen de la foto dentro de la vitrina (clases `inset-*`). */
  inset: string;
  /** Insignias sobre la foto. */
  children?: ReactNode;
}) {
  const reduced = useReducedMotion();
  // Posición del cursor en la vitrina, de −0,5 a 0,5; 0 es el centro.
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const hover = useMotionValue(0);
  const x = useSpring(pointerX, SPRING);
  const y = useSpring(pointerY, SPRING);
  const lift = useSpring(hover, SPRING);
  // El lado del cursor se hunde, como al apoyar un dedo.
  const rotateX = useTransform(y, [-0.5, 0.5], [7, -7]);
  const rotateY = useTransform(x, [-0.5, 0.5], [-9, 9]);
  // La foto, por encima del fondo, se mueve hacia el cursor.
  const shiftX = useTransform(x, [-0.5, 0.5], [-9, 9]);
  const shiftY = useTransform(y, [-0.5, 0.5], [-9, 9]);
  const glareX = useTransform(x, [-0.5, 0.5], [10, 90]);
  const glareY = useTransform(y, [-0.5, 0.5], [5, 85]);
  const glare = useMotionTemplate`radial-gradient(48% 40% at ${glareX}% ${glareY}%, color-mix(in oklab, var(--color-paper) 55%, transparent), transparent 70%)`;
  // Suave: es un reflejo en el fondo, no debe lavar la foto.
  const glareOpacity = useTransform(lift, [0, 1], [0, 0.55]);
  const drop = useTransform(lift, [0, 1], [0, 30]);
  const blur = useTransform(lift, [0, 1], [0, 54]);
  const spread = useTransform(lift, [0, 1], [0, -28]);
  const shadow = useMotionTemplate`0 ${drop}px ${blur}px ${spread}px color-mix(in oklab, var(--color-ink) 32%, transparent)`;

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (reduced || event.pointerType !== 'mouse') return;
    const box = event.currentTarget.getBoundingClientRect();
    pointerX.set((event.clientX - box.left) / box.width - 0.5);
    pointerY.set((event.clientY - box.top) / box.height - 0.5);
    hover.set(1);
  };
  const onPointerLeave = () => {
    pointerX.set(0);
    pointerY.set(0);
    hover.set(0);
  };

  return (
    <div
      className="[perspective:1000px]"
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      <motion.div
        className="bg-stage relative aspect-[4/5] overflow-hidden"
        style={reduced ? undefined : { rotateX, rotateY, boxShadow: shadow }}
      >
        <motion.div
          className="absolute inset-0"
          style={reduced ? undefined : { x: shiftX, y: shiftY }}
        >
          <div className="scroll-drift absolute inset-0">
            <div
              // Fondo propio: al moverse, la capa se aísla y multiply necesita un fondo dentro.
              className={`bg-stage absolute ${inset} transition-[transform,opacity] duration-[1.6s] ease-(--ease-luxe) group-hover:scale-[1.05] ${alternate ? 'group-hover:opacity-0' : ''}`}
            >
              <ProductImage
                media={media}
                alt={alt}
                brand={brand}
                sizes={sizes}
                priority={priority}
              />
            </div>
            {alternate && (
              <div
                aria-hidden
                className={`bg-stage absolute ${inset} scale-[0.97] opacity-0 transition-[transform,opacity] duration-[1.6s] ease-(--ease-luxe) group-hover:scale-100 group-hover:opacity-100`}
              >
                <ProductImage
                  media={alternate}
                  alt=""
                  brand={brand}
                  sizes={sizes}
                />
              </div>
            )}
          </div>
        </motion.div>
        {!reduced && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ background: glare, opacity: glareOpacity }}
          />
        )}
        <span
          aria-hidden
          className="bg-accent absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 transition-transform duration-700 ease-(--ease-luxe) group-hover:scale-x-100"
        />
        {children}
      </motion.div>
    </div>
  );
}
