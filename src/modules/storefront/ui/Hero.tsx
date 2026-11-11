'use client';

import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'motion/react';
import { Fragment, useRef } from 'react';
import Image from 'next/image';
import { Heading, buttonClass } from '@/components/ui';
import { Star } from '@/modules/brand';
import { Link } from '@/modules/i18n';

export const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Titular que sube palabra a palabra al cargar. Es CSS (`hero-word` de
 * globals.css): empieza con el primer pintado, sin esperar a React, y con
 * «reducir movimiento» ya está en su sitio (DECISIONS §190).
 */
export function RisingWords({
  text,
  delay = 0.45,
}: {
  text: string;
  delay?: number;
}) {
  const words = text.split(' ');
  return words.map((word, index) => (
    <Fragment key={`${word}-${index}`}>
      <span className="inline-block overflow-hidden pb-[0.12em] align-bottom">
        <span
          className="hero-word inline-block"
          style={{ animationDelay: `${delay + index * 0.09}s` }}
        >
          {word}
        </span>
      </span>
      {/* El espacio, fuera del bloque: dentro, el navegador lo quita. */}
      {index < words.length - 1 && ' '}
    </Fragment>
  ));
}

/** Cielo determinista (mismo en servidor y cliente: sin desajustes de hidratación). */
const STARS = (() => {
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  return Array.from({ length: 70 }, () => ({
    left: random() * 100,
    top: random() * 100,
    size: 1 + random() * 1.6,
    delay: random() * 5,
    duration: 3.5 + random() * 4,
  }));
})();

export function Hero({
  eyebrow,
  title,
  lead,
  cta,
  scroll,
  imageUrl,
  imageAlt,
}: {
  eyebrow: string;
  title: string;
  lead: string;
  cta: string;
  scroll: string;
  imageUrl?: string;
  imageAlt?: string;
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });
  const contentY = useTransform(scrollYProgress, [0, 1], ['0%', '28%']);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const starRotate = useTransform(scrollYProgress, [0, 1], [0, 45]);
  const starScale = useTransform(scrollYProgress, [0, 1], [1, 1.25]);

  return (
    <section
      ref={ref}
      data-tone="dark"
      className="bg-surface text-fg grain relative isolate flex min-h-svh items-center justify-center overflow-hidden"
    >
      {imageUrl && (
        <div className="absolute inset-0 -z-10">
          <Image
            src={imageUrl}
            alt={imageAlt ?? ''}
            fill
            unoptimized
            sizes="100vw"
            className="object-cover opacity-30"
          />
          <div className="bg-surface/30 absolute inset-0" />
        </div>
      )}
      {/* Resplandor cálido que respira. */}
      <motion.div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(60% 55% at 50% 62%, color-mix(in oklab, var(--color-gold) 28%, transparent), transparent 70%)',
        }}
        animate={reduced ? undefined : { opacity: [0.65, 1, 0.65] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        // Sin puntos de luz detrás del texto: se confundían con la puntuación.
        style={{
          maskImage:
            'radial-gradient(ellipse 42% 38% at 50% 50%, transparent 55%, black 90%)',
        }}
      >
        {STARS.map((star, index) => (
          <span
            key={index}
            className="animate-twinkle bg-accent-fg absolute rounded-full"
            style={{
              left: `${star.left}%`,
              top: `${star.top}%`,
              width: star.size,
              height: star.size,
              animationDelay: `${star.delay}s`,
              animationDuration: `${star.duration}s`,
            }}
          />
        ))}
      </div>

      {/* La estrella del emblema, enorme y tenue, gira con el scroll. */}
      <motion.div
        aria-hidden
        className="text-accent/10 absolute -z-10"
        style={reduced ? undefined : { rotate: starRotate, scale: starScale }}
      >
        <Star className="hero-star size-[min(120vw,64rem)]" />
      </motion.div>

      <motion.div
        className="relative mx-auto max-w-5xl px-6 text-center"
        style={reduced ? undefined : { y: contentY, opacity: contentOpacity }}
      >
        {/*
          La entrada (clases hero-* de globals.css) es CSS: empieza con el
          primer pintado, sin esperar a React. motion solo mueve el bloque al
          hacer scroll.
        */}
        <p className="hero-eyebrow text-2xs text-accent-fg font-sans font-normal uppercase">
          {eyebrow}
        </p>

        <Heading level={1} size="display" className="mt-8">
          <RisingWords text={title} />
        </Heading>

        <div
          aria-hidden
          className="hero-rule bg-accent-fg/60 mx-auto mt-10 h-px w-24 origin-center"
        />

        <p className="hero-lead text-fg-muted mx-auto mt-10 max-w-xl text-base leading-relaxed sm:text-lg">
          {lead}
        </p>

        <div className="hero-cta mt-12">
          <Link
            href="/catalogo"
            className={buttonClass('outline', 'lg', 'sheen')}
          >
            {cta}
          </Link>
        </div>
      </motion.div>

      <div
        aria-hidden
        className="absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-3"
      >
        <span className="text-fg-muted text-2xs tracking-caps-lg uppercase">
          {scroll}
        </span>
        <span className="bg-fg/15 relative h-12 w-px overflow-hidden">
          <span className="animate-scroll-cue bg-accent-fg absolute inset-0" />
        </span>
      </div>
    </section>
  );
}
