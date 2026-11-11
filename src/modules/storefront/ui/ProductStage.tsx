'use client';

import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'motion/react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { Button } from '@/components/ui';
import type { ProductMedia } from '@/modules/catalog';
import {
  loadUnboxingViewer,
  useWebGL,
  type UnboxingViewerProps,
} from '@/modules/unboxing';
import { ProductImage } from './ProductImage';
import { trackProductEvent } from './TrackEvent';

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
        <ul className="-mt-3 flex justify-center gap-3 pb-3">
          {media.map((item, i) => (
            <li key={item.url}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`${i + 1} / ${media.length}`}
                aria-pressed={i === index}
                // La raya es fina, pero el botón mide 44 px de alto para el dedo.
                className="group flex h-11 w-10 items-center"
              >
                <span
                  className={`block h-px w-full transition-colors duration-500 ${i === index ? 'bg-fg' : 'bg-border group-hover:bg-fg-muted'}`}
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type Mode = 'photos' | 'loading' | 'scene' | 'failed';

/** Descarga anticipada del visor; si falla, ya lo dirá el clic. */
const prefetch = () => void loadUnboxingViewer().catch(() => {});

/**
 * Escenario de la ficha: siempre abre con las fotos (lo primero que se pinta).
 * Si el perfume tiene escena 3D y el navegador tiene WebGL, «Abrir la caja en
 * 3D» trae three.js y la escena solo entonces (DECISIONS §190); sin WebGL o si
 * falla, se quedan las fotos.
 */
export function ProductStage({
  scene,
  media,
  name,
  brand,
  trackSlug = null,
}: {
  scene: string | null;
  media: ProductMedia[];
  name: string;
  brand: string;
  /**
   * Slug del perfume para contar (anónimo) que se ha abierto su escena 3D;
   * null en la vista previa del personal, que no se mide.
   */
  trackSlug?: string | null;
}) {
  const t = useTranslations('product');
  const webgl = useWebGL();
  const [mode, setMode] = useState<Mode>('photos');
  const [Viewer, setViewer] =
    useState<ComponentType<UnboxingViewerProps> | null>(null);
  const openArea = useRef<HTMLDivElement>(null);
  const returnFocus = useRef(false);

  // Al volver a las fotos con el teclado, el foco vuelve al botón que abrió la escena.
  useEffect(() => {
    if (mode !== 'photos' || !returnFocus.current) return;
    returnFocus.current = false;
    openArea.current?.querySelector('button')?.focus();
  }, [mode]);

  const open = () => {
    setMode('loading');
    loadUnboxingViewer().then(
      (module) => {
        setViewer(() => module.default);
        setMode('scene');
      },
      () => setMode('failed'),
    );
  };

  if (scene && Viewer && mode === 'scene')
    return (
      <Frame>
        <Viewer
          scene={scene}
          background={STAGE_COLOR}
          labels={{
            scene: t('scene', { name }),
            replay: t('sceneReplay'),
            dragHint: t('sceneDrag'),
            close: t('sceneClose'),
          }}
          onClose={() => {
            returnFocus.current = true;
            setMode('photos');
          }}
          onFailed={() => setMode('failed')}
          onSeen={
            trackSlug
              ? () => trackProductEvent(trackSlug, 'unboxing')
              : undefined
          }
        />
      </Frame>
    );

  return (
    <Frame>
      <Gallery media={media} name={name} brand={brand} />
      {scene && webgl && (
        <div
          ref={openArea}
          // Encima de la foto y de los puntos de la galería, sin mover nada al aparecer.
          className={`absolute inset-x-0 flex flex-col items-center gap-2 px-5 ${media.length > 1 ? 'bottom-16' : 'bottom-6'}`}
        >
          {mode === 'failed' ? (
            <p role="status" className="text-fg-muted text-sm">
              {t('sceneFailed')}
            </p>
          ) : (
            <Button
              size="sm"
              loading={mode === 'loading'}
              loadingLabel={t('sceneLoading')}
              onClick={open}
              // Al acercarse al botón ya se empieza a descargar.
              onPointerEnter={prefetch}
              onFocus={prefetch}
            >
              {t('sceneOpen')}
            </Button>
          )}
        </div>
      )}
    </Frame>
  );
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="bg-stage relative h-[72svh] min-h-[26rem] w-full lg:h-[calc(100svh-4.5rem)]">
      {children}
    </div>
  );
}
