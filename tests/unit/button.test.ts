import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Button, TextLink } from '@/components/ui';

/*
 * Acciones (Fase 2, DS-06): variantes y tamaños de la escala, botón por
 * defecto que no envía formularios, carga con la estrella y enlaces.
 */

const html = renderToStaticMarkup;

describe('Button', () => {
  it('por defecto: principal, md (44 px) y type="button"', () => {
    const markup = html(Button({ children: 'Guardar' }));
    expect(markup).toMatch(/^<button /);
    expect(markup).toContain('type="button"');
    expect(markup).toContain('min-h-11');
    expect(markup).toContain('bg-fg text-fg-inverse');
  });

  it('lg mide 48 px y sm 36 px', () => {
    expect(html(Button({ size: 'lg', children: 'A' }))).toContain('min-h-12');
    expect(html(Button({ size: 'sm', children: 'A' }))).toContain('min-h-9');
  });

  it('cargando: estrella, texto de carga, deshabilitado y aria-busy', () => {
    const markup = html(
      Button({
        loading: true,
        loadingLabel: 'Guardando…',
        children: 'Guardar',
      }),
    );
    expect(markup).toContain('disabled=""');
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('animate-twinkle');
    expect(markup).toContain('Guardando…');
    expect(markup).not.toContain('>Guardar<');
  });

  it('con href es un enlace; deshabilitado queda fuera del tabulador', () => {
    const link = html(Button({ href: '/es', children: 'Ver' }));
    expect(link).toMatch(/^<a /);
    expect(link).toContain('href="/es"');
    const off = html(Button({ href: '/es', disabled: true, children: 'Ver' }));
    expect(off).toMatch(/^<span /);
    expect(off).toContain('aria-disabled="true"');
    expect(off).not.toContain('href=');
  });

  it('peligro es de contorno y se llena al pasar el ratón', () => {
    const markup = html(Button({ variant: 'danger', children: 'Borrar' }));
    expect(markup).toContain('border-danger');
    expect(markup).toContain('hover:bg-danger');
  });
});

describe('TextLink', () => {
  it('externo: otra pestaña, noopener y aviso para lectores de pantalla', () => {
    const markup = html(
      TextLink({
        href: 'https://ejemplo.com',
        external: true,
        newTabLabel: 'opens in a new tab',
        children: 'Ejemplo',
      }),
    );
    expect(markup).toContain('target="_blank"');
    expect(markup).toContain('rel="noopener noreferrer"');
    expect(markup).toContain('opens in a new tab');
    expect(markup).toContain('link-underline');
    // Icono dibujado en diagonal: un icono girado desborda la caja del enlace.
    expect(markup).not.toContain('rotate');
  });
});
