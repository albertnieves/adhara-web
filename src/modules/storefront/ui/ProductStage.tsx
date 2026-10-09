'use client';

import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'motion/react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { ProductMedia } from '@/modules/catalog';
import { ProductImage } from './ProductImage';

/** three.js solo en el cliente y solo en las fichas con escena. */
const UnboxingViewer = dynamic(
  () => import('@/modules/unboxing/UnboxingViewer'),
  { ssr: false },
);

/** Mismo valor que --color-stage (el canvas necesita el color literal). */
const STAGE_COLOR = '#efe9df';

function Gallery({
  media,
  name,
  brand,
}: {
  media: ProductMedia[];
  name: string;
  brand: string;
}) {
  const [index, setIndex] = useState(0);
  const current = media[index] ?? null;
  const reduced = useReducedMotion();
  // Inclinación suave que sigue al cursor (sin efecto con reduced motion).
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [5, -5]), {
    stiffness: 120,
    damping: 18,
  });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-7, 7]), {
    stiffness: 120,
    damping: 18,
  });
  return (
    <div className="flex h-full flex-col">
      <motion.div
        className="relative flex-1 [perspective:1200px]"
        onPointerMove={(event) => {
          if (reduced || event.pointerType !== 'mouse') return;
          const box = event.currentTarget.getBoundingClientRect();
          x.set((event.clientX - box.left) / box.width - 0.5);
          y.set((event.clientY - box.top) / box.height - 0.5);
        }}
        onPointerLeave={() => {
          x.set(0);
          y.set(0);
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={current?.url ?? 'empty'}
            // Fondo propio: al inclinar, la capa se aísla y multiply lo necesita.
            className="bg-stage absolute inset-8 sm:inset-14"
            style={reduced ? undefined : { rotateX, rotateY }}
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            <ProductImage
              media={current}
              alt={`${brand} ${name}`}
              brand={brand}
              sizes="(min-width: 1024px) 55vw, 100vw"
              priority
            />
          </motion.div>
        </AnimatePresence>
      </motion.div>
      {media.length > 1 && (
        <ul className="flex justify-center gap-3 pb-6">
          {media.map((item, i) => (
            <li key={item.url}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`${i + 1} / ${media.length}`}
                aria-pressed={i === index}
                className={`h-px w-10 transition-colors duration-500 ${i === index ? 'bg-fg' : 'bg-border hover:bg-fg-muted'}`}
              >
                <span className="block h-6 -translate-y-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ProductStage({
  scene,
  media,
  name,
  brand,
}: {
  scene: string | null;
  media: ProductMedia[];
  name: string;
  brand: string;
}) {
  const t = useTranslations('product');
  const gallery = <Gallery media={media} name={name} brand={brand} />;
  return (
    <div className="bg-stage relative h-[72svh] min-h-[26rem] w-full lg:h-[calc(100svh-4.5rem)]">
      {scene ? (
        <UnboxingViewer
          scene={scene}
          background={STAGE_COLOR}
          labels={{
            scene: t('scene', { name }),
            replay: t('sceneReplay'),
            dragHint: t('sceneDrag'),
          }}
          fallback={gallery}
        />
      ) : (
        gallery
      )}
    </div>
  );
}
