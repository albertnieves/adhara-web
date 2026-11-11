'use client';

import {
  AnimatePresence,
  motion,
  useAnimationFrame,
  useMotionValue,
  useReducedMotion,
} from 'motion/react';
import dynamic from 'next/dynamic';
import { useLocale, useTranslations } from 'next-intl';
import type { KeyboardEvent, PointerEvent } from 'react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { Eyebrow, Heading, Icon, Price, buttonClass } from '@/components/ui';
import type { StorefrontProduct } from '@/modules/catalog';
import { heroMedia, lowestPrice, variantLabel } from '@/modules/catalog';
import { Link, useRouter } from '@/modules/i18n';
import type { RingControl } from '@/modules/unboxing';
import {
  createRingControl,
  nearestIndex,
  releaseSteps,
  ringStep,
  shortestTarget,
  useHardwareWebGL,
} from '@/modules/unboxing';
import { EASE, RisingWords } from './Hero';
import { ProductImage } from './ProductImage';

/**
 * three.js solo en el cliente, con tarjeta gráfica y cuando la portada ya ha
 * cargado (DECISIONS §191): hasta entonces se ve la foto del perfume del frente.
 */
const CarouselScene = dynamic(
  () => import('@/modules/unboxing/carousel/CarouselScene'),
  { ssr: false },
);

/** Tiempo que cada perfume queda al frente antes de girar. */
const DWELL_MS = 6500;
/** Arrastrar el ancho entero del escenario gira algo menos de media vuelta. */
const DRAG_TURN = Math.PI * 0.85;

type Mode = 'loading' | 'ready' | 'fallback';

const REDUCED = '(prefers-reduced-motion: reduce)';

function subscribeReduced(onChange: () => void) {
  const query = window.matchMedia(REDUCED);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/**
 * «Reducir movimiento» que vale false en el servidor y al hidratar, y el
 * valor real justo después: el botón de pausa no queda con la etiqueta del
 * servidor.
 */
function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(REDUCED).matches,
    () => false,
  );
}

/**
 * Portada con carrusel 3D: los perfumes con escena giran en una peana de
 * noche; el del frente se presenta con su casa, formato, precio y enlace a la
 * ficha. Gira solo (salvo con «reducir movimiento»), se pausa al pasar el
 * cursor o al llevar el foco a los controles y se arrastra con el dedo. Sin
 * WebGL se ve la foto del perfume del frente con los mismos controles.
 */
export function HeroCarousel({
  eyebrow,
  title,
  lead,
  cta,
  slides,
}: {
  eyebrow: string;
  title: string;
  lead: string;
  cta: string;
  slides: StorefrontProduct[];
}) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  // Las entradas animadas siguen a motion; el giro y sus etiquetas, a una
  // lectura que coincide al hidratar (sin desajustes en el botón de pausa).
  const reduced = useReducedMotion() ?? false;
  const still = usePrefersReducedMotion();
  const count = slides.length;

  // Lo lee la escena en cada fotograma: una ref, no estado (sin renders).
  const control = useRef<RingControl>(createRingControl());
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<Mode>('loading');
  // Sin tarjeta gráfica no se descarga la escena: se quedan las fotos.
  const gpu = useHardwareWebGL();
  const [load3d, setLoad3d] = useState(false);
  // null: lo decide el sistema (con «reducir movimiento» no gira solo).
  const [paused, setPaused] = useState<boolean | null>(null);
  const playing = paused === null ? !still : !paused;
  const [visible, setVisible] = useState(true);
  const [held, setHeld] = useState({ hover: false, focus: false });
  const progress = useMotionValue(0);

  const section = useRef<HTMLElement>(null);
  const slot = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    x: number;
    lastX: number;
    lastT: number;
    velocity: number;
    moved: boolean;
  } | null>(null);

  // La escena llega cuando la portada ya se ve y el navegador está libre:
  // three.js no compite con el titular ni con la foto del frente.
  useEffect(() => {
    if (!gpu) return;
    let idle = 0;
    let timer = 0;
    const start = () => {
      if (typeof window.requestIdleCallback === 'function')
        idle = window.requestIdleCallback(() => setLoad3d(true), {
          timeout: 2500,
        });
      else timer = window.setTimeout(() => setLoad3d(true), 300);
    };
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true });
    return () => {
      window.removeEventListener('load', start);
      if (idle) window.cancelIdleCallback(idle);
      window.clearTimeout(timer);
    };
  }, [gpu]);

  // Fuera de pantalla ni gira ni se pinta.
  useEffect(() => {
    const node = section.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(Boolean(entry?.isIntersecting)),
      { threshold: 0.05 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const goTo = useCallback(
    (next: number) => {
      if (count === 0) return;
      const wrapped = ((next % count) + count) % count;
      control.current.target = shortestTarget(
        control.current.target,
        wrapped,
        count,
      );
      progress.set(0);
      setIndex(wrapped);
    },
    [control, count, progress],
  );

  const step = useCallback(
    (delta: number) => {
      if (count === 0) return;
      // Siempre en el sentido pedido, aunque sea la vuelta larga.
      control.current.target -= delta * ringStep(count);
      progress.set(0);
      setIndex(nearestIndex(control.current.target, count));
    },
    [control, count, progress],
  );

  const autoplay =
    playing && visible && !held.hover && !held.focus && count > 1;

  useAnimationFrame((_, delta) => {
    if (!autoplay || drag.current?.moved) return;
    const next = progress.get() + Math.min(delta, 100) / DWELL_MS;
    if (next >= 1) step(1);
    else progress.set(next);
  });

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    drag.current = {
      x: event.clientX,
      lastX: event.clientX,
      lastT: event.timeStamp,
      velocity: 0,
      moved: false,
    };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state) return;
    const dx = event.clientX - state.x;
    if (!state.moved && Math.abs(dx) > 6) {
      state.moved = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    if (!state.moved) return;
    const width = event.currentTarget.clientWidth || 1;
    const dt = Math.max(event.timeStamp - state.lastT, 1);
    state.velocity = (event.clientX - state.lastX) / dt;
    state.lastX = event.clientX;
    state.lastT = event.timeStamp;
    control.current.drag = (dx / width) * DRAG_TURN;
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    drag.current = null;
    if (!state || count === 0) return;
    if (state.moved) {
      const steps = releaseSteps(control.current.drag, state.velocity, count);
      const settled = control.current.target + control.current.drag;
      const next = (((index + steps) % count) + count) % count;
      control.current.drag = 0;
      control.current.target = shortestTarget(settled, next, count);
      progress.set(0);
      setIndex(next);
      return;
    }
    // Un toque: a los lados cambia de perfume; en el centro abre su ficha.
    const box = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width;
    if (x < 0.3) step(-1);
    else if (x > 0.7) step(1);
    else {
      const slide = slides[index];
      if (slide)
        router.push({
          pathname: '/perfume/[slug]',
          params: { slug: slide.slug },
        });
    }
  };

  const onPointerCancel = () => {
    drag.current = null;
    control.current.drag = 0;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      step(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      step(1);
    }
  };

  const onReady = useCallback(() => setMode('ready'), []);
  const onUnavailable = useCallback(() => setMode('fallback'), []);

  const slide = slides[index] ?? slides[0];
  if (!slide) return null;
  const price = lowestPrice(slide);
  const priced = slide.variants.filter((v) => v.priceCents !== null);
  const sizes = slide.variants.map(variantLabel).join(' · ');
  const detail = [
    slide.concentration ? t(`concentration.${slide.concentration}`) : null,
    sizes !== '—' ? sizes : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const href = {
    pathname: '/perfume/[slug]' as const,
    params: { slug: slide.slug },
  };

  return (
    <section
      ref={section}
      data-tone="dark"
      className="bg-surface text-fg relative isolate overflow-hidden"
      onPointerMove={(event) => {
        if (event.pointerType !== 'mouse' || still) return;
        const box = event.currentTarget.getBoundingClientRect();
        control.current.pointer.x =
          ((event.clientX - box.left) / box.width) * 2 - 1;
        control.current.pointer.y =
          ((event.clientY - box.top) / box.height) * 2 - 1;
      }}
      onPointerLeave={() => {
        control.current.pointer.x = 0;
        control.current.pointer.y = 0;
      }}
    >
      {/* Resplandor de fondo mientras llega la escena (y sin WebGL). */}
      <div
        aria-hidden
        className="absolute inset-0 -z-20"
        style={{
          background:
            'radial-gradient(42% 48% at 68% 52%, color-mix(in oklab, var(--color-gold) 22%, transparent), transparent 72%)',
        }}
      />
      <div
        aria-hidden
        className={`absolute inset-0 -z-10 transition-opacity duration-[1.8s] ease-(--ease-luxe) ${mode === 'ready' ? 'opacity-100' : 'opacity-0'}`}
      >
        {gpu && load3d && mode !== 'fallback' && (
          <CarouselScene
            scenes={slides.map((s) => s.unboxingScene ?? '')}
            control={control}
            activeIndex={index}
            slot={slot}
            running={visible}
            reduced={still}
            onReady={onReady}
            onUnavailable={onUnavailable}
          />
        )}
      </div>
      {/* Velo detrás del texto: el cielo no compite con el titular. */}
      <div
        aria-hidden
        className="from-surface lg:via-surface/60 pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-linear-to-b to-transparent lg:inset-y-0 lg:right-auto lg:h-auto lg:w-3/5 lg:bg-linear-to-r"
      />

      <div className="max-w-page relative mx-auto grid min-h-svh grid-cols-1 px-5 pt-24 pb-10 sm:px-10 lg:grid-cols-12 lg:grid-rows-[1fr_auto_auto_1fr] lg:gap-x-10 lg:pt-28 lg:pb-12">
        <div className="lg:col-span-5 lg:row-start-2">
          {/* Entrada con CSS (clases hero-*): no espera a React (§190). */}
          <p className="hero-eyebrow text-2xs text-accent-fg font-sans font-normal uppercase">
            {eyebrow}
          </p>
          <Heading level={1} size="h1" className="mt-6 lg:mt-8">
            <RisingWords text={title} />
          </Heading>
        </div>

        <div className="flex flex-col lg:col-span-7 lg:col-start-6 lg:row-span-4 lg:row-start-1">
          <div
            ref={slot}
            aria-hidden
            className="relative mt-2 h-[42svh] min-h-72 cursor-grab touch-pan-y select-none active:cursor-grabbing lg:mt-0 lg:h-auto lg:min-h-0 lg:flex-1"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            onPointerEnter={(event) => {
              if (event.pointerType === 'mouse')
                setHeld((h) => ({ ...h, hover: true }));
            }}
            onPointerLeave={() => setHeld((h) => ({ ...h, hover: false }))}
          >
            {/*
              Foto del perfume del frente mientras llega la escena y, sin
              tarjeta gráfica o si la escena falla, en su lugar. Con la escena
              lista se funde y se retira (no descarga más fotos detrás).
            */}
            <AnimatePresence initial={false}>
              {mode !== 'ready' && (
                <motion.div
                  key="photos"
                  className="absolute inset-0"
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduced ? 0 : 1.2, ease: EASE }}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={slide.id}
                      className="bg-stage absolute inset-y-6 left-1/2 aspect-[4/5] -translate-x-1/2"
                      initial={reduced ? false : { opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.8, ease: EASE }}
                    >
                      <ProductImage
                        media={heroMedia(slide)}
                        alt=""
                        brand={slide.brand.name}
                        sizes="(min-width: 1024px) 30vw, 70vw"
                        priority
                      />
                    </motion.div>
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div
            role="group"
            aria-roledescription={t('home.carouselRole')}
            aria-label={t('home.carouselLabel')}
            className="relative mx-auto w-full max-w-md text-center"
            onKeyDown={onKeyDown}
            // Solo el foco del teclado lo para: un clic deja seguir el giro.
            onFocus={(event) => {
              if (event.target.matches(':focus-visible'))
                setHeld((h) => ({ ...h, focus: true }));
            }}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node))
                setHeld((h) => ({ ...h, focus: false }));
            }}
            onPointerEnter={(event) => {
              if (event.pointerType === 'mouse')
                setHeld((h) => ({ ...h, hover: true }));
            }}
            onPointerLeave={() => setHeld((h) => ({ ...h, hover: false }))}
          >
            {count > 1 && (
              <div className="flex items-center justify-center gap-1">
                <button
                  type="button"
                  onClick={() => step(-1)}
                  aria-label={t('home.carouselPrevious')}
                  className="text-fg-muted hover:text-fg flex size-11 items-center justify-center transition-colors"
                >
                  <Icon name="chevron" direction="left" />
                </button>
                <ul className="flex items-center gap-2">
                  {slides.map((item, i) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => goTo(i)}
                        aria-label={t('home.carouselShow', { name: item.name })}
                        aria-current={i === index ? 'true' : undefined}
                        // Raya fina, botón de 44 px de alto para el dedo.
                        className="group flex h-11 w-10 items-center"
                      >
                        <span
                          className={`relative block h-px w-full overflow-hidden transition-colors duration-500 ${i === index ? 'bg-fg/35' : 'bg-fg/15 group-hover:bg-fg/50'}`}
                        >
                          {i === index && (
                            <motion.span
                              className="bg-accent-fg absolute inset-0 origin-left"
                              style={{ scaleX: playing ? progress : 1 }}
                            />
                          )}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => step(1)}
                  aria-label={t('home.carouselNext')}
                  className="text-fg-muted hover:text-fg flex size-11 items-center justify-center transition-colors"
                >
                  <Icon name="chevron" />
                </button>
                <button
                  type="button"
                  onClick={() => setPaused(playing)}
                  aria-label={
                    playing ? t('home.carouselPause') : t('home.carouselPlay')
                  }
                  className="text-fg-muted hover:text-fg ml-2 flex size-11 items-center justify-center transition-colors"
                >
                  <Icon name={playing ? 'pause' : 'play'} size="sm" />
                </button>
              </div>
            )}
            <div
              aria-live={autoplay ? 'off' : 'polite'}
              className="mt-4 min-h-44"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={slide.id}
                  role="group"
                  aria-roledescription={t('home.carouselSlide')}
                  aria-label={t('home.carouselPosition', {
                    index: index + 1,
                    total: count,
                  })}
                  initial={reduced ? false : { opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduced ? { opacity: 0 } : { opacity: 0, y: -10 }}
                  transition={{ duration: 0.7, ease: EASE }}
                >
                  <Eyebrow>{slide.brand.name}</Eyebrow>
                  <Heading size="h2" className="mt-3">
                    {slide.name}
                  </Heading>
                  <p className="text-fg-muted mt-3 text-sm">
                    {detail}
                    {detail && ' · '}
                    <span className="text-fg">
                      {price === null ? (
                        t('product.pricePending')
                      ) : (
                        <Price
                          cents={price}
                          from={priced.length > 1}
                          locale={locale}
                          labels={{
                            from: t('product.from'),
                            before: t('product.before'),
                          }}
                          size="sm"
                        />
                      )}
                    </span>
                  </p>
                  <Link
                    href={href}
                    className="link-underline text-2xs tracking-caps-lg mt-5 inline-block uppercase"
                  >
                    {t('home.carouselCta')}
                    <span className="sr-only"> {slide.name}</span>
                  </Link>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="mt-12 lg:col-span-5 lg:row-start-3 lg:mt-10">
          <div
            aria-hidden
            className="hero-rule bg-accent-fg/60 h-px w-24 origin-left"
          />
          <p className="hero-lead text-fg-muted mt-8 max-w-md text-base leading-relaxed sm:text-lg">
            {lead}
          </p>
          <div className="hero-cta mt-10">
            <Link
              href="/catalogo"
              className={buttonClass('outline', 'lg', 'sheen')}
            >
              {cta}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
