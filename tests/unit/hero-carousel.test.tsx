import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import messages from '../../messages/es.json';
import type { StorefrontProduct } from '@/modules/catalog';
import {
  MAX_HERO_SLIDES,
  heroSlides,
} from '@/modules/storefront/domain/hero-slides';
import {
  fitCamera,
  frontAngle,
  frontness,
  nearestIndex,
  releaseSteps,
  ringStep,
  shortestTarget,
} from '@/modules/unboxing/carousel/ring';

/*
 * Carrusel 3D de la portada (DECISIONS §188): las cuentas del anillo, qué
 * perfumes entran y el HTML que llega sin JavaScript (titular, ficha del
 * perfume del frente y controles con nombre). La escena 3D no se pinta aquí.
 */

vi.mock('next/dynamic', () => ({ default: () => () => null }));
vi.mock('@/modules/i18n', () => ({
  Link: ({
    href,
    children,
    className,
  }: {
    href: string | { pathname: string; params?: { slug: string } };
    children: ReactNode;
    className?: string;
  }) => (
    <a
      href={
        typeof href === 'string'
          ? href
          : href.pathname.replace('[slug]', href.params?.slug ?? '')
      }
      className={className}
    >
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn() }),
}));

const { HeroCarousel } = await import('@/modules/storefront/ui/HeroCarousel');

const TAU = Math.PI * 2;

function product(
  slug: string,
  position: number,
  unboxingScene: string | null,
  priceCents: number | null = 3962,
): StorefrontProduct {
  return {
    id: `id-${slug}`,
    slug,
    name: slug === 'club-de-nuit-intense-man-le' ? 'Club de Nuit' : slug,
    brand: { slug: 'lattafa', name: 'Lattafa' },
    concentration: 'EDP',
    audience: null,
    featured: false,
    position,
    unboxingScene,
    tagline: null,
    description: null,
    translatedLocales: [],
    variants: [
      {
        id: `v-${slug}`,
        label: null,
        sizeMl: 100,
        priceCents,
        compareAtCents: null,
        position: 0,
      },
    ],
    media: [],
  } as StorefrontProduct;
}

describe('anillo', () => {
  it('reparte los frascos y deja cada uno al frente', () => {
    expect(ringStep(4)).toBeCloseTo(Math.PI / 2);
    expect(ringStep(0)).toBe(0);
    for (let i = 0; i < 4; i++) {
      expect(nearestIndex(frontAngle(i, 4), 4)).toBe(i);
      expect(frontness(i, 4, frontAngle(i, 4))).toBeCloseTo(1);
    }
    // De perfil y detrás no mira a la cámara.
    expect(frontness(1, 4, 0)).toBeCloseTo(0);
    expect(frontness(2, 4, 0)).toBe(0);
  });

  it('el índice da la vuelta con giros de más de una vuelta y negativos', () => {
    expect(nearestIndex(-TAU - Math.PI / 2, 4)).toBe(1);
    expect(nearestIndex(Math.PI / 2, 4)).toBe(3);
    expect(nearestIndex(5 * TAU, 4)).toBe(0);
    expect(nearestIndex(0.3, 4)).toBe(0);
  });

  it('va al perfume pedido por el camino corto', () => {
    // Del último al primero: un paso, no tres hacia atrás.
    const last = frontAngle(3, 4);
    const target = shortestTarget(last, 0, 4);
    expect(Math.abs(target - last)).toBeCloseTo(Math.PI / 2);
    expect(nearestIndex(target, 4)).toBe(0);
    // Tras varias vueltas sigue cerca del giro actual.
    const far = -3 * TAU;
    expect(Math.abs(shortestTarget(far, 2, 4) - far)).toBeLessThanOrEqual(
      Math.PI + 1e-9,
    );
  });

  it('al soltar un arrastre redondea al frasco y un lanzamiento cambia de perfume', () => {
    const step = ringStep(4);
    // Arrastrar a la derecha trae el anterior; a la izquierda, el siguiente.
    expect(releaseSteps(step * 0.9, 0, 4)).toBe(-1);
    expect(releaseSteps(-step * 1.6, 0, 4)).toBe(2);
    expect(releaseSteps(step * 0.2, 0, 4)).toBe(0);
    expect(releaseSteps(step * 0.2, 1.2, 4)).toBe(-1);
    expect(releaseSteps(-step * 0.2, -1.2, 4)).toBe(1);
    expect(releaseSteps(1, 2, 0)).toBe(0);
  });

  it('encaja el anillo en el hueco del escenario', () => {
    const canvas = { width: 1440, height: 900 };
    const slot = { x: 760, y: 100, width: 600, height: 500 };
    const fit = fitCamera({
      canvas,
      slot,
      fovDeg: 28,
      radius: 1.3,
      bottleHeight: 1.4,
      sideReach: 1.8,
      fill: 0.6,
    });
    // El centro de la imagen se mueve al centro del hueco.
    expect(fit.offsetX).toBe(760 + 300 - 720);
    expect(fit.offsetY).toBe(100 + 250 - 450);
    const tan = Math.tan((28 * Math.PI) / 360);
    // El frasco del frente no pasa del 60 % del alto del hueco…
    const frontPx = (1.4 * canvas.height) / (2 * (fit.distance - 1.3) * tan);
    expect(frontPx).toBeLessThanOrEqual(0.6 * slot.height + 1e-6);
    // …y los de los lados caben a lo ancho.
    const sidePx = (1.8 * canvas.height) / (fit.distance * tan);
    expect(sidePx).toBeLessThanOrEqual(slot.width + 1e-6);
  });
});

describe('heroSlides', () => {
  it('solo perfumes con escena 3D conocida, en el orden de la colección', () => {
    const slides = heroSlides([
      product('khamrah', 40, 'khamrah'),
      product('sin-escena', 1, null),
      product('inventada', 2, 'no-existe'),
      product('asad', 10, 'asad'),
      product('yara', 20, 'yara'),
    ]);
    expect(slides.map((p) => p.slug)).toEqual(['asad', 'yara', 'khamrah']);
  });

  it('una escena, un frasco: gana el primero de la colección', () => {
    const slides = heroSlides([
      product('asad-copia', 50, 'asad'),
      product('asad', 10, 'asad'),
    ]);
    expect(slides.map((p) => p.slug)).toEqual(['asad']);
  });

  it('sin perfumes con escena no hay carrusel', () => {
    expect(heroSlides([product('a', 1, null)])).toEqual([]);
    expect(MAX_HERO_SLIDES).toBeGreaterThanOrEqual(4);
  });
});

describe('HeroCarousel (HTML del servidor)', () => {
  const asad = product('asad', 10, 'asad');
  asad.media = [
    {
      url: '/media/pilot/asad/official_asad-2.jpg',
      alt: null,
      role: 'hero',
      origin: 'brand_official',
      provisional: true,
      position: 0,
    },
  ];
  const slides = heroSlides([
    asad,
    product('yara', 20, 'yara', 2999),
    product('club-de-nuit-intense-man-le', 30, 'club-de-nuit-intense-man-le'),
    product('khamrah', 40, 'khamrah', null),
  ]);
  const html = renderToStaticMarkup(
    <NextIntlClientProvider
      locale="es"
      messages={messages}
      timeZone="Europe/Madrid"
    >
      <HeroCarousel
        eyebrow="Perfumería árabe"
        title="El lenguaje del perfume árabe"
        lead="Una selección"
        cta="Descubrir la colección"
        slides={slides}
      />
    </NextIntlClientProvider>,
  );

  it('es una sección oscura con el titular h1 y el enlace a la colección', () => {
    // Delante, la precarga de la foto del frente (React la sube al <head>).
    expect(html).toMatch(
      /^(<link rel="preload"[^>]*>)*<section data-tone="dark"/,
    );
    expect(html).toMatch(/<h1[^>]*>.*lenguaje.*<\/h1>/);
    expect(html).toContain('href="/catalogo"');
    expect(html).toContain('Descubrir la colección');
  });

  it('presenta el primer perfume con casa, formato, precio y su ficha', () => {
    expect(html).toContain('aria-roledescription="carrusel"');
    expect(html).toContain('aria-label="Perfumes de la colección en 3D"');
    expect(html).toContain('aria-roledescription="perfume"');
    expect(html).toContain('aria-label="1 de 4"');
    expect(html).toContain('Lattafa');
    expect(html).toContain('Eau de Parfum · 100 ml');
    expect(html).toMatch(/39,62\s€/);
    expect(html).toContain('href="/perfume/asad"');
    expect(html).toMatch(/Ver el perfume<span class="sr-only"> asad<\/span>/);
  });

  it('trae ya la foto del perfume del frente y la entrada en CSS (§190–191)', () => {
    // La escena llega después de cargar (y solo con tarjeta gráfica): hasta
    // entonces, y sin ella, se ve la foto, que ya viene del servidor.
    expect(html).toContain('official_asad-2.jpg');
    expect(html).not.toContain('<canvas');
    // El titular y el texto no esperan a React para verse.
    expect(html).toContain('hero-word');
    expect(html).toContain('hero-eyebrow');
    expect(html).toContain('hero-lead');
    expect(html).not.toMatch(/translateY\(110%\)/);
  });

  it('cada control tiene nombre y el perfume del frente está marcado', () => {
    for (const label of [
      'Perfume anterior',
      'Perfume siguiente',
      'Pausar el giro',
      'Mostrar asad',
      'Mostrar yara',
      'Mostrar Club de Nuit',
      'Mostrar khamrah',
    ])
      expect(html).toContain(`aria-label="${label}"`);
    expect(html.match(/aria-current="true"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-label="Mostrar asad" aria-current="true"/);
  });

  it('con un solo perfume no hay controles de giro', () => {
    const single = renderToStaticMarkup(
      <NextIntlClientProvider
        locale="es"
        messages={messages}
        timeZone="Europe/Madrid"
      >
        <HeroCarousel
          eyebrow="e"
          title="t"
          lead="l"
          cta="c"
          slides={slides.slice(0, 1)}
        />
      </NextIntlClientProvider>,
    );
    expect(single).not.toContain('Perfume siguiente');
    expect(single).toContain('aria-label="1 de 1"');
  });
});
