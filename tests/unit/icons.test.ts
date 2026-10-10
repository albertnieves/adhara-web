import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  ICON_NAMES,
  Icon,
  StarDivider,
  StarList,
  StarLoader,
} from '@/components/ui';
import { Logo } from '@/modules/brand';

/*
 * Iconos y marca (Fase 2, DS-05): juego propio de 12 iconos de trazo fino
 * (D5), decorativos salvo que lleven nombre, y el logotipo con su mínimo.
 */

const html = renderToStaticMarkup;

describe('Icon', () => {
  it('tiene el juego de D5, el de enlace externo (DS-06) y los de vista', () => {
    expect([...ICON_NAMES].sort()).toEqual(
      [
        'alert',
        'arrow',
        'external',
        'cart',
        'check',
        'chevron',
        'close',
        'grid',
        'info',
        'menu',
        'minus',
        'plus',
        'search',
        'tile',
        'user',
      ].sort(),
    );
  });

  it.each(ICON_NAMES)('%s: trazo de 1,5 px y decorativo sin nombre', (name) => {
    const markup = html(Icon({ name }));
    expect(markup).toMatch(/^<svg /);
    expect(markup).toContain('stroke="currentColor"');
    expect(markup).toContain('stroke-width="1.5"');
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).not.toContain('role=');
    expect(markup).toMatch(/<(path|circle) /);
  });

  it('con nombre es una imagen accesible', () => {
    const markup = html(Icon({ name: 'alert', label: 'Atención' }));
    expect(markup).toContain('role="img"');
    expect(markup).toContain('aria-label="Atención"');
    expect(markup).not.toContain('aria-hidden');
  });

  it('solo flechas y chevrones giran', () => {
    expect(html(Icon({ name: 'arrow', direction: 'left' }))).toContain(
      'rotate-180',
    );
    expect(html(Icon({ name: 'plus', direction: 'left' }))).not.toContain(
      'rotate',
    );
  });
});

describe('estrella', () => {
  it('viñeta, separador y cargador con su papel accesible', () => {
    const list = html(StarList({ items: ['Uno', 'Dos'] }));
    expect(list.match(/<li /g)).toHaveLength(2);
    expect(list).toContain('aria-hidden="true"');
    expect(html(StarDivider({}))).toContain('role="separator"');
    const loader = html(StarLoader({ label: 'Cargando pedidos' }));
    expect(loader).toContain('role="status"');
    expect(loader).toContain('Cargando pedidos');
  });
});

describe('logotipo', () => {
  it('nunca por debajo del mínimo', () => {
    expect(html(Logo({ size: 'sm' }))).toContain('text-sm');
    expect(html(Logo({}))).toContain('text-lg');
    expect(html(Logo({ variant: 'stacked' }))).toContain('min-w-40');
    expect(html(Logo({}))).toContain('role="img"');
  });
});
