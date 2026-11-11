import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import messages from '../../messages/es.json';
import type { ProductMedia, StorefrontProduct } from '@/modules/catalog';
import {
  MAX_DECK_CARDS,
  deckCards,
} from '@/modules/storefront/domain/collection-deck';

/*
 * Colección y catálogo olfativo con movimiento y 3D (DECISIONS §189): qué
 * perfumes van al abanico de la cabecera, el HTML que llega del servidor
 * (tarjeta-vitrina, filtros, abanico y pirámide olfativa) y que el movimiento
 * ligado al scroll solo existe sin «reducir movimiento».
 */

vi.mock('@/modules/i18n', () => ({
  Link: ({
    href,
    children,
    className,
    'aria-label': label,
  }: {
    href: string | { pathname: string; params?: { slug: string } };
    children: ReactNode;
    className?: string;
    'aria-label'?: string;
  }) => (
    <a
      href={
        typeof href === 'string'
          ? href
          : href.pathname.replace('[slug]', href.params?.slug ?? '')
      }
      className={className}
      aria-label={label}
    >
      {children}
    </a>
  ),
}));

const { CardStage } = await import('@/modules/storefront/ui/CardStage');
const { CollectionDeck } =
  await import('@/modules/storefront/ui/CollectionDeck');
const { FilterChip } = await import('@/modules/storefront/ui/FilterChip');
const { ProductCard } = await import('@/modules/storefront/ui/ProductCard');
const { ScentTiers } = await import('@/modules/storefront/ui/ScentTiers');

const photo = (url: string): ProductMedia => ({
  url,
  alt: null,
  role: 'hero',
  origin: 'brand_official',
  provisional: true,
  position: 0,
});

function product(
  slug: string,
  brand: string,
  position: number,
  options: { media?: boolean; scene?: string | null } = {},
): StorefrontProduct {
  return {
    id: `id-${slug}`,
    slug,
    name: slug,
    brand: { slug: brand, name: brand.toUpperCase() },
    concentration: 'EDP',
    audience: null,
    featured: false,
    position,
    unboxingScene: options.scene ?? null,
    tagline: null,
    description: null,
    translatedLocales: [],
    variants: [
      {
        id: `v-${slug}`,
        label: null,
        sizeMl: 100,
        priceCents: 3999,
        compareAtCents: null,
        position: 0,
      },
    ],
    media: options.media === false ? [] : [photo(`/media/pilot/${slug}.jpg`)],
  };
}

const intl = (node: ReactNode) =>
  renderToStaticMarkup(
    <NextIntlClientProvider
      locale="es"
      messages={messages}
      timeZone="Europe/Madrid"
    >
      {node}
    </NextIntlClientProvider>,
  );

describe('deckCards', () => {
  it('una fragancia de cada casa, en el orden de la colección', () => {
    const cards = deckCards([
      product('c', 'armaf', 30),
      product('b', 'lattafa', 20),
      product('a', 'lattafa', 10),
      product('d', 'assaf', 40),
    ]);
    expect(cards.map((card) => card.slug)).toEqual(['a', 'c', 'd']);
    expect(cards[0]).toMatchObject({ name: 'a', brand: 'LATTAFA' });
  });

  it('sin foto no entra: pasa al siguiente de su casa', () => {
    const cards = deckCards([
      product('sin-foto', 'lattafa', 10, { media: false }),
      product('con-foto', 'lattafa', 20),
    ]);
    expect(cards.map((card) => card.slug)).toEqual(['con-foto']);
  });

  it('como mucho, las cartas del abanico', () => {
    const many = Array.from({ length: 9 }, (_, index) =>
      product(`p${index}`, `casa-${index}`, index),
    );
    expect(deckCards(many)).toHaveLength(MAX_DECK_CARDS);
    expect(deckCards(many, 2)).toHaveLength(2);
    expect(deckCards([])).toEqual([]);
  });
});

describe('CollectionDeck', () => {
  it('lista con nombre y un enlace por carta a su ficha', () => {
    const html = intl(
      <CollectionDeck
        label="Una fragancia de cada casa"
        cards={deckCards([
          product('asad', 'lattafa', 10),
          product('club', 'armaf', 20),
        ])}
      />,
    );
    expect(html).toContain('aria-label="Una fragancia de cada casa"');
    expect(html).toContain('href="/perfume/asad"');
    expect(html).toContain('aria-label="LATTAFA asad"');
    expect(html).toContain('aria-label="ARMAF club"');
    // Solo en pantallas anchas.
    expect(html).toMatch(/class="[^"]*\bhidden\b[^"]*\bxl:block\b/);
  });

  it('sin cartas no pinta nada', () => {
    expect(intl(<CollectionDeck label="x" cards={[]} />)).toBe('');
  });
});

describe('FilterChip', () => {
  it('es un botón con aria-pressed y la pastilla solo en el activo', () => {
    const on = renderToStaticMarkup(
      <FilterChip group="brand" active onClick={() => {}}>
        Lattafa
      </FilterChip>,
    );
    const off = renderToStaticMarkup(
      <FilterChip group="brand" active={false} onClick={() => {}}>
        Armaf
      </FilterChip>,
    );
    expect(on).toMatch(/^<button type="button" aria-pressed="true"/);
    expect(on).toContain('bg-fg absolute inset-0');
    expect(on).toContain('text-fg-inverse');
    expect(off).toContain('aria-pressed="false"');
    expect(off).not.toContain('bg-fg absolute inset-0');
    // 36 px de alto, como el botón sm.
    expect(off).toContain('min-h-9');
  });
});

describe('CardStage y ProductCard', () => {
  it('la foto va en la vitrina con la deriva del scroll', () => {
    const html = renderToStaticMarkup(
      <CardStage
        media={photo('/media/pilot/asad.jpg')}
        alt="Lattafa Asad"
        brand="Lattafa"
        sizes="25vw"
        inset="inset-6"
      />,
    );
    expect(html).toContain('alt="Lattafa Asad"');
    expect(html).toContain('scroll-drift');
    expect(html).toContain('aspect-[4/5]');
  });

  it('sin foto enseña la casa', () => {
    const html = renderToStaticMarkup(
      <CardStage
        media={null}
        alt="x"
        brand="Lattafa"
        sizes="25vw"
        inset="inset-6"
      />,
    );
    expect(html).toContain('Lattafa');
    expect(html).not.toContain('<img');
  });

  it('solo los perfumes con escena conocida llevan «Vista 3D»', () => {
    const withScene = intl(
      <ProductCard
        product={product('asad', 'lattafa', 1, { scene: 'asad' })}
      />,
    );
    const unknown = intl(
      <ProductCard
        product={product('otro', 'lattafa', 2, { scene: 'no-existe' })}
      />,
    );
    const plain = intl(<ProductCard product={product('yara', 'lattafa', 3)} />);
    expect(withScene).toContain('Vista 3D');
    expect(unknown).not.toContain('Vista 3D');
    expect(plain).not.toContain('Vista 3D');
    expect(plain).toContain('href="/perfume/yara"');
  });
});

describe('ScentTiers', () => {
  const html = renderToStaticMarkup(
    <ScentTiers
      tiers={[
        { key: 'top', label: 'Salida', hint: 'Los primeros minutos.' },
        { key: 'heart', label: 'Corazón', hint: 'Las horas centrales.' },
        { key: 'base', label: 'Fondo', hint: 'La estela.' },
      ]}
    />,
  );

  it('los tres pisos van en una lista con su título y su explicación', () => {
    expect(html.match(/<li/g)).toHaveLength(3);
    for (const text of [
      'Salida',
      'Corazón',
      'Fondo',
      'Los primeros minutos.',
      'La estela.',
    ])
      expect(html).toContain(text);
    expect(html.match(/<h2/g)).toHaveLength(3);
  });

  it('la figura 3D es decorativa', () => {
    const figure = html.slice(0, html.indexOf('<ol'));
    expect(figure).toContain('aria-hidden="true"');
    expect(figure).not.toMatch(/<h2|Salida/);
    // Un disco por piso.
    expect(figure.match(/rounded-full border transition-colors/g)).toHaveLength(
      3,
    );
  });
});

describe('movimiento ligado al scroll', () => {
  const css = readFileSync(
    fileURLToPath(new URL('../../src/app/globals.css', import.meta.url)),
    'utf8',
  );

  it('solo sin «reducir movimiento» y donde el navegador lo admite', () => {
    const block = css.slice(
      css.indexOf('@media (prefers-reduced-motion: no-preference)'),
    );
    const guarded = block.slice(0, block.indexOf('@keyframes scroll-rise'));
    expect(guarded).toContain('@supports (animation-timeline: view())');
    expect(guarded).toContain('.scroll-rise');
    expect(guarded).toContain('.scroll-drift');
    // Las clases no se definen en ningún otro sitio.
    expect(css.match(/\.scroll-rise\s*\{/g)).toHaveLength(1);
    expect(css.match(/\.scroll-drift\s*\{/g)).toHaveLength(1);
  });
});
