'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui';
import type { ProductMedia } from '@/modules/catalog';
import { Link } from '@/modules/i18n';
import { ProductImage } from './ProductImage';

export type HouseNiche = {
  slug: string;
  name: string;
  /** «3 perfumes», ya en el idioma de la página. */
  count: string;
  media: ProductMedia | null;
};

const ROMAN = [
  'I',
  'II',
  'III',
  'IV',
  'V',
  'VI',
  'VII',
  'VIII',
  'IX',
  'X',
  'XI',
  'XII',
  'XIII',
  'XIV',
  'XV',
  'XVI',
  'XVII',
  'XVIII',
  'XIX',
  'XX',
];

/**
 * Galería de casas de la portada (DECISIONS §192): cada casa es un nicho en
 * arco con uno de sus frascos, numerado como las salas de una colección. La
 * fila se desplaza con el dedo, el teclado o las flechas; no se mueve sola.
 */
export function HouseGallery({
  houses,
  labels,
}: {
  houses: HouseNiche[];
  labels: { rail: string; previous: string; next: string };
}) {
  const rail = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const measure = useCallback(() => {
    const el = rail.current;
    if (!el) return;
    setEdges({
      start: el.scrollLeft <= 4,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure, houses.length]);

  const move = (direction: 1 | -1) => {
    const el = rail.current;
    if (!el) return;
    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    el.scrollBy({
      left: direction * el.clientWidth * 0.8,
      behavior: reduced ? 'auto' : 'smooth',
    });
  };

  if (houses.length === 0) return null;
  const scrollable = !(edges.start && edges.end);

  return (
    <div className="relative">
      <ul
        ref={rail}
        onScroll={measure}
        aria-label={labels.rail}
        className="flex snap-x snap-mandatory scroll-px-5 [scrollbar-width:none] gap-5 overflow-x-auto scroll-smooth px-5 pb-6 sm:scroll-px-10 sm:gap-8 sm:px-10 [&::-webkit-scrollbar]:hidden"
      >
        {houses.map((house, index) => (
          <li
            key={house.slug}
            className="w-56 shrink-0 snap-start sm:w-64 lg:w-72"
          >
            <Link
              href={{ pathname: '/casas/[slug]', params: { slug: house.slug } }}
              className="group block"
            >
              <span className="bg-stage relative block aspect-[3/4] overflow-hidden rounded-t-full">
                <span className="absolute inset-0 block transition-transform duration-1000 ease-(--ease-luxe) group-hover:scale-105 group-focus-visible:scale-105">
                  <ProductImage
                    media={house.media}
                    alt=""
                    brand={house.name}
                    fit="cover"
                    sizes="(min-width: 1024px) 18rem, (min-width: 640px) 16rem, 14rem"
                  />
                </span>
                <span
                  aria-hidden
                  className="border-accent/50 group-hover:border-accent pointer-events-none absolute inset-2 block rounded-t-full border transition-colors duration-700"
                />
              </span>
              <span className="mt-6 block text-center">
                <span
                  aria-hidden
                  className="text-accent-fg text-2xs tracking-caps-lg block"
                >
                  {ROMAN[index] ?? index + 1}
                </span>
                <span className="font-display tracking-caps mt-2 block text-2xl uppercase">
                  {house.name}
                </span>
                <span
                  aria-hidden
                  className="bg-accent mx-auto mt-3 block h-px w-8 transition-all duration-700 ease-(--ease-luxe) group-hover:w-20 group-focus-visible:w-20"
                />
                <span className="text-fg-muted tracking-caps-sm mt-3 block text-xs uppercase">
                  {house.count}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {scrollable && (
        <div className="mt-4 flex justify-center gap-3">
          {(
            [
              [-1, labels.previous, edges.start],
              [1, labels.next, edges.end],
            ] as const
          ).map(([direction, label, disabled]) => (
            <button
              key={direction}
              type="button"
              aria-label={label}
              disabled={disabled}
              onClick={() => move(direction)}
              className="border-border-strong text-fg hover:border-fg flex size-11 items-center justify-center rounded-full border transition-colors disabled:opacity-30"
            >
              <Icon
                name="arrow"
                direction={direction === -1 ? 'left' : 'right'}
                className="size-4"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
