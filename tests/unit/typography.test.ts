import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Eyebrow, Heading, Text } from '@/components/ui';

/*
 * Componentes tipográficos (Fase 2, DS-04): la etiqueta da la estructura, el
 * tamaño sale de la escala cerrada y nada queda por debajo de text-2xs.
 */

/** Los componentes no tienen estado: basta con llamarlos y renderizar. */
const html = renderToStaticMarkup;

const classes = (markup: string) =>
  (markup.match(/class="([^"]*)"/)?.[1] ?? '').split(' ');

describe('Heading', () => {
  it('el nivel fija la etiqueta y, por defecto, el tamaño', () => {
    const markup = html(Heading({ level: 2, children: 'Colección' }));
    expect(markup).toMatch(/^<h2 /);
    expect(classes(markup)).toEqual(
      expect.arrayContaining([
        'font-display',
        'tracking-display',
        'text-4xl',
        'sm:text-5xl',
      ]),
    );
  });

  it('el tamaño visual es independiente del nivel', () => {
    const markup = html(
      Heading({
        level: 1,
        size: 'h2',
        children: 'Inventario',
      }),
    );
    expect(markup).toMatch(/^<h1 /);
    expect(classes(markup)).toContain('text-4xl');
    expect(classes(markup)).not.toContain('text-6xl');
  });

  it('sin nivel es un párrafo con aspecto de titular', () => {
    const markup = html(Heading({ size: 'display', children: 'Portada' }));
    expect(markup).toMatch(/^<p /);
    expect(classes(markup)).toContain('text-display');
  });

  it('className se añade para colocar', () => {
    const markup = html(
      Heading({
        level: 3,
        className: 'mt-2',
        children: 'Datos',
      }),
    );
    expect(classes(markup)).toEqual(
      expect.arrayContaining(['text-2xl', 'mt-2']),
    );
  });
});

describe('Text', () => {
  it('cuerpo por defecto, en párrafo y heredando el color del tono', () => {
    const markup = html(Text({ children: 'Texto' }));
    expect(markup).toBe('<p class="text-base">Texto</p>');
  });

  it('tamaños, tonos semánticos y cifras tabulares', () => {
    const markup = html(
      Text({
        as: 'span',
        size: 'caption',
        tone: 'muted',
        numeric: true,
        children: '0123',
      }),
    );
    expect(markup).toMatch(/^<span /);
    expect(classes(markup)).toEqual(
      expect.arrayContaining([
        'text-xs',
        'text-fg-muted',
        'lining-nums',
        'tabular-nums',
      ]),
    );
  });
});

describe('Eyebrow', () => {
  it('versalitas de 11 px en Manrope y texto atenuado', () => {
    const markup = html(Eyebrow({ children: 'Colección' }));
    expect(markup).toMatch(/^<p /);
    expect(classes(markup)).toEqual(
      expect.arrayContaining([
        'text-2xs',
        'tracking-caps-lg',
        'font-sans',
        'uppercase',
        'text-fg-muted',
      ]),
    );
  });

  it('puede ser un encabezado y llevar el dorado de texto', () => {
    const markup = html(
      Eyebrow({
        as: 'h2',
        tone: 'accent',
        children: 'Novedad',
      }),
    );
    expect(markup).toMatch(/^<h2 /);
    expect(classes(markup)).toContain('text-accent-fg');
    expect(classes(markup)).not.toContain('text-fg-muted');
  });
});
