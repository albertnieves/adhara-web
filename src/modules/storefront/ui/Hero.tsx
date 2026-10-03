'use client';

import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'motion/react';
import { useRef } from 'react';
import Image from 'next/image';
import { Heading, buttonClass } from '@/components/ui';
import { Star } from '@/modules/brand';
import { Link } from '@/modules/i18n';

const EASE = [0.22, 1, 0.36, 1] as const;

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
  const words = title.split(' ');

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
        initial={reduced ? false : { opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 2.4, ease: EASE }}
      >
        <Star className="size-[min(120vw,64rem)]" />
      </motion.div>

      <motion.div
        className="relative mx-auto max-w-5xl px-6 text-center"
        style={reduced ? undefined : { y: contentY, opacity: contentOpacity }}
      >
        <motion.p
          // El espaciado lo anima motion; el resto, como Eyebrow en dorado.
          className="text-2xs text-accent-fg font-sans font-normal uppercase"
          initial={reduced ? false : { opacity: 0, letterSpacing: '0.6em' }}
          animate={{ opacity: 1, letterSpacing: '0.32em' }}
          transition={{ duration: 1.6, delay: 0.2, ease: EASE }}
        >
          {eyebrow}
        </motion.p>

        <Heading level={1} size="display" className="mt-8">
          {words.map((word, index) => (
            <span
              key={`${word}-${index}`}
              className="inline-block overflow-hidden pb-[0.12em] align-bottom"
            >
              <motion.span
                className="inline-block"
                initial={reduced ? false : { y: '110%' }}
                animate={{ y: '0%' }}
                transition={{
                  duration: 1.3,
                  delay: 0.45 + index * 0.09,
                  ease: EASE,
                }}
              >
                {word}
                {index < words.length - 1 ? ' ' : ''}
              </motion.span>
            </span>
          ))}
        </Heading>

        <motion.div
          aria-hidden
          className="bg-accent-fg/60 mx-auto mt-10 h-px w-24 origin-center"
          initial={reduced ? false : { scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 1.4, delay: 1.1, ease: EASE }}
        />

        <motion.p
          className="text-fg-muted mx-auto mt-10 max-w-xl text-base leading-relaxed sm:text-lg"
          initial={reduced ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, delay: 1.25, ease: EASE }}
        >
          {lead}
        </motion.p>

        <motion.div
          className="mt-12"
          initial={reduced ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, delay: 1.45, ease: EASE }}
        >
          <Link
            href="/catalogo"
            className={buttonClass('outline', 'lg', 'sheen')}
          >
            {cta}
          </Link>
        </motion.div>
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
