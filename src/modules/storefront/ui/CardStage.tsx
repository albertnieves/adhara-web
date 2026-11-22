'use client';

import { useEffect, useRef } from 'react';
import type { PointerEvent, ReactNode } from 'react';
import type { ProductMedia } from '@/modules/catalog';
import { ProductImage } from './ProductImage';
import { createTilt } from './card-tilt';
import type { Tilt } from './card-tilt';

/**
 * Vitrina de una tarjeta de perfume (DECISIONS §189): el recuadro de la foto
 * se inclina en perspectiva hacia el cursor, la foto flota un poco por encima
 * (se desplaza con él) y un brillo recorre el fondo. Al pasar el cursor por la
 * tarjeta entera, la foto se acerca y, si hay una segunda (la caja), aparece
 * con un fundido. En pantallas táctiles no hay inclinación: la foto deriva con
 * el scroll (`scroll-drift`). Con «reducir movimiento», nada de esto.
 *
 * La inclinación no hidrata nada (DECISIONS §200): sin cursor encima no hay
 * estado ni fotogramas; el muelle (`card-tilt.ts`) se crea con el primer
 * movimiento del ratón y escribe los estilos directamente mientras se mueve.
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
  const stage = useRef<HTMLDivElement>(null);
  const photo = useRef<HTMLDivElement>(null);
  const glare = useRef<HTMLDivElement>(null);
  const tilt = useRef<Tilt | null>(null);

  useEffect(() => () => tilt.current?.stop(), []);

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!stage.current || !photo.current || !glare.current) return;
    tilt.current ??= createTilt({
      stage: stage.current,
      photo: photo.current,
      glare: glare.current,
    });
    const box = event.currentTarget.getBoundingClientRect();
    tilt.current.aim(
      (event.clientX - box.left) / box.width - 0.5,
      (event.clientY - box.top) / box.height - 0.5,
      1,
    );
  };
  const onPointerLeave = () => tilt.current?.aim(0, 0, 0);

  return (
    <div
      className="[perspective:1000px]"
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      <div
        ref={stage}
        className="bg-stage relative aspect-[4/5] overflow-hidden"
      >
        <div ref={photo} className="absolute inset-0">
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
        </div>
        <div
          ref={glare}
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0 motion-reduce:hidden"
        />
        <span
          aria-hidden
          className="bg-accent absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 transition-transform duration-700 ease-(--ease-luxe) group-hover:scale-x-100"
        />
        {children}
      </div>
    </div>
  );
}
