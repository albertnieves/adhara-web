import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  Badge,
  Card,
  EmptyState,
  Price,
  Skeleton,
  Table,
  Tag,
  Td,
  Th,
} from '@/components/ui';

/*
 * Datos y comercio (Fase 2, DS-09). Price: PVP en el formato de cada idioma,
 * precio anterior tachado con «antes» accesible, «desde» y cifras tabulares.
 */

/** Marcado sin etiquetas y con espacios normales (Intl usa no separables). */
function text(markup: string) {
  return markup
    .replace(/<[^>]+>/g, ' ')
    .replace(/[\s\u00a0\u202f]+/g, ' ')
    .trim();
}

const LABELS = {
  es: { from: 'Desde', before: 'Antes' },
  ca: { from: 'Des de', before: 'Abans' },
  en: { from: 'From', before: 'Was' },
} as const;

describe('Price', () => {
  it.each([
    ['es', '49,90 €'],
    ['ca', '49,90 €'],
    ['en', '€49.90'],
  ] as const)('sin rebaja en %s: %s', (locale, expected) => {
    const markup = renderToStaticMarkup(
      <Price cents={4990} locale={locale} labels={LABELS[locale]} />,
    );
    expect(text(markup)).toBe(expected);
    expect(markup).not.toMatch(/<s[ >]/);
    expect(markup).toContain('tabular-nums');
  });

  it.each([
    ['es', '39,90 € Antes 49,90 €'],
    ['ca', '39,90 € Abans 49,90 €'],
    ['en', '€39.90 Was €49.90'],
  ] as const)('con rebaja en %s: %s', (locale, expected) => {
    const markup = renderToStaticMarkup(
      <Price
        cents={3990}
        compareAtCents={4990}
        locale={locale}
        labels={LABELS[locale]}
      />,
    );
    expect(text(markup)).toBe(expected);
    expect(markup).toMatch(/<s [^>]*><span class="sr-only">/);
    // Un espacio real separa ambos precios para el lector de pantalla.
    expect(markup).toContain('</span> <s ');
  });

  it('el precio anterior que no es mayor no se muestra', () => {
    const markup = renderToStaticMarkup(
      <Price
        cents={4990}
        compareAtCents={4990}
        locale="es"
        labels={LABELS.es}
      />,
    );
    expect(markup).not.toMatch(/<s[ >]/);
  });

  it.each([
    ['es', 'Desde 29,50 €'],
    ['ca', 'Des de 29,50 €'],
    ['en', 'From €29.50'],
  ] as const)('«desde» en %s', (locale, expected) => {
    const markup = renderToStaticMarkup(
      <Price cents={2950} from locale={locale} labels={LABELS[locale]} />,
    );
    expect(text(markup)).toBe(expected);
  });

  it('importes redondos sin decimales', () => {
    const markup = renderToStaticMarkup(
      <Price cents={12500} locale="es" labels={LABELS.es} />,
    );
    expect(text(markup)).toBe('125 €');
  });
});

describe('Badge y Tag', () => {
  it('el tono pone borde y texto del mismo semántico', () => {
    const markup = renderToStaticMarkup(<Badge tone="warning">Últimas</Badge>);
    expect(markup).toContain('border-warning text-warning');
    expect(markup).toContain('uppercase');
  });

  it('Tag es descriptivo: fondo hundido, sin versalitas', () => {
    const markup = renderToStaticMarkup(<Tag>Unisex</Tag>);
    expect(markup).toContain('bg-surface-sunken');
    expect(markup).not.toContain('uppercase');
  });
});

describe('Card, Table, EmptyState y Skeleton', () => {
  it('Card con superficie elevada y borde', () => {
    const markup = renderToStaticMarkup(<Card as="article">Hola</Card>);
    expect(markup).toMatch(/^<article class="border-border bg-surface-raised/);
  });

  it('Table: leyenda, cabeceras con scope y ficha en el móvil', () => {
    const markup = renderToStaticMarkup(
      <Table caption="Formatos">
        <thead>
          <tr>
            <Th>Formato</Th>
            <Th numeric>ml</Th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <Td primary>A</Td>
            <Td label="ml" numeric>
              50
            </Td>
          </tr>
        </tbody>
      </Table>,
    );
    expect(markup).toContain('class="data-table stack-table"');
    expect(markup).toContain('<caption class="sr-only">Formatos</caption>');
    expect(markup).toContain('scope="col"');
    expect(markup).toContain('data-primary="true"');
    expect(markup).toContain('data-label="ml"');
  });

  it('EmptyState con título y acción; Skeleton decorativo', () => {
    const empty = renderToStaticMarkup(
      <EmptyState title="Sin pedidos" action={<a href="#a">Ir</a>} />,
    );
    expect(empty).toContain('Sin pedidos');
    expect(empty).toContain('href="#a"');
    const skeleton = renderToStaticMarkup(<Skeleton />);
    expect(skeleton).toContain('aria-hidden="true"');
    expect(skeleton).toContain('animate-pulse');
  });
});
