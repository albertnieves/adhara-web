import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Dialog, Sheet, Toaster } from '@/components/ui';

/*
 * Superposiciones y avisos (Fase 2, DS-08): `<dialog>` nativo con nombre y
 * descripción, tono por data-tone y regiones vivas creadas desde el inicio.
 * El foco, Esc y la vuelta del foco se prueban en el E2E de la referencia.
 */

const noop = () => {};

describe('Dialog', () => {
  it('es un dialog con nombre y descripción, cerrado sin contenido', () => {
    const closed = renderToStaticMarkup(
      <Dialog open={false} onClose={noop} title="Título" description="Nota">
        Cuerpo
      </Dialog>,
    );
    expect(closed).toMatch(/^<dialog[^>]*aria-labelledby="[^"]+"/);
    expect(closed).toMatch(/aria-describedby="[^"]+"/);
    expect(closed).toContain('class="dialog"');
    expect(closed).not.toContain('Cuerpo');
  });

  it('abierto: título, botón de cerrar con nombre y acciones', () => {
    const markup = renderToStaticMarkup(
      <Dialog
        open
        onClose={noop}
        title="Renombrar"
        closeLabel="Close"
        actions={<button type="button">Guardar</button>}
      >
        Cuerpo
      </Dialog>,
    );
    expect(markup).toContain('Renombrar');
    expect(markup).toContain('aria-label="Close"');
    expect(markup).toContain('<footer');
    expect(markup).not.toContain('data-tone');
  });

  it('los tonos oscuros van por data-tone', () => {
    const markup = renderToStaticMarkup(
      <Dialog open onClose={noop} title="T" tone="oud" />,
    );
    expect(markup).toContain('data-tone="oud"');
  });
});

describe('Sheet', () => {
  it('lado y tono, sin colores propios', () => {
    const markup = renderToStaticMarkup(
      <Sheet open onClose={noop} title="Menú" side="left" tone="dark">
        Contenido
      </Sheet>,
    );
    expect(markup).toContain('data-side="left"');
    expect(markup).toContain('data-tone="dark"');
    expect(markup).toContain('class="sheet"');
    expect(markup).not.toMatch(/ivory|night|smoke/);
  });
});

describe('Toaster', () => {
  it('crea desde el inicio la región de errores y la de estado', () => {
    const markup = renderToStaticMarkup(<Toaster />);
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('role="status"');
  });
});
