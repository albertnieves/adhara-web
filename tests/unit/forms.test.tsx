import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  Checkbox,
  Field,
  Fieldset,
  Input,
  Radio,
  SearchField,
  Select,
  Textarea,
} from '@/components/ui';

/*
 * Formularios (Fase 2, DS-07): la etiqueta, la ayuda y el error se unen al
 * control con for, aria-describedby y aria-invalid; 44 px de alto y estados
 * de error, deshabilitado y solo lectura.
 */

const html = (element: ReactElement) => renderToStaticMarkup(element);

/** Id del primer control (input, select o textarea) del marcado. */
function controlId(markup: string) {
  return /<(?:input|select|textarea)[^>]* id="([^"]+)"/.exec(markup)?.[1];
}

describe('Field', () => {
  it('une la etiqueta con el control y le añade la ayuda', () => {
    const markup = html(
      <Field label="Nombre" hint="Como figura en el pedido.">
        <Input name="nombre" />
      </Field>,
    );
    const id = controlId(markup);
    expect(id).toBeTruthy();
    expect(markup).toContain(`for="${id}"`);
    expect(markup).toContain(`aria-describedby="${id}-hint"`);
    expect(markup).toContain(`id="${id}-hint"`);
    expect(markup).not.toContain('aria-invalid="');
  });

  it('con error: inválido y el error antes que la ayuda', () => {
    const markup = html(
      <Field label="Correo" hint="Ayuda" error="Escribe un correo.">
        <Input type="email" />
      </Field>,
    );
    const id = controlId(markup);
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain(`aria-describedby="${id}-error ${id}-hint"`);
    expect(markup).toContain('text-danger');
    expect(markup).toContain('Escribe un correo.');
  });

  it('respeta el id y las descripciones propias del control', () => {
    const markup = html(
      <Field label="Idioma" error="Elige uno.">
        <Select id="idioma" aria-describedby="nota">
          <option value="es">Español</option>
        </Select>
      </Field>,
    );
    expect(markup).toContain('for="idioma"');
    expect(markup).toContain('aria-describedby="nota idioma-error"');
  });
});

describe('Controles de texto', () => {
  it('Input: 44 px, letra de 16 px y type="text" por defecto', () => {
    const markup = html(<Input />);
    expect(markup).toContain('type="text"');
    expect(markup).toContain('min-h-11');
    expect(markup).toContain('text-base');
  });

  it('estados de error, deshabilitado y solo lectura', () => {
    const markup = html(<Input readOnly />);
    expect(markup).toContain('readOnly=""');
    expect(markup).toContain('aria-invalid:border-danger');
    expect(markup).toContain('disabled:bg-surface-sunken');
    expect(markup).toContain('[&amp;[readonly]]:border-dashed');
  });

  it('Textarea crece en vertical y Select lleva su chevron', () => {
    expect(html(<Textarea />)).toContain('resize-y');
    const select = html(
      <Select>
        <option value="a">A</option>
      </Select>,
    );
    expect(select).toContain('appearance-none');
    expect(select).toMatch(/<svg[^>]*aria-hidden="true"/);
  });

  it('SearchField: búsqueda con nombre y la estrella solo mientras busca', () => {
    const idle = html(<SearchField label="Buscar" />);
    expect(idle).toContain('type="search"');
    expect(idle).toContain('aria-label="Buscar"');
    expect(idle).not.toContain('animate-twinkle');
    const busy = html(<SearchField label="Buscar" pending />);
    expect(busy).toContain('animate-twinkle');
  });
});

describe('Checkbox, Radio y Fieldset', () => {
  it('Checkbox: caja de 24 px y etiqueta de 44 px unida al control', () => {
    const markup = html(<Checkbox label="Avisarme" hint="Por correo." />);
    const id = controlId(markup);
    expect(markup).toContain('type="checkbox"');
    expect(markup).toContain(`for="${id}"`);
    expect(markup).toContain('min-h-11');
    expect(markup).toContain('size-6');
    expect(markup).toContain(`aria-describedby="${id}-hint"`);
  });

  it('Checkbox con error queda inválido', () => {
    const markup = html(<Checkbox label="Acepto" error="Obligatoria." />);
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain('Obligatoria.');
  });

  it('Radio redondo dentro de un Fieldset con leyenda y ayuda', () => {
    const markup = html(
      <Fieldset legend="Vista" hint="Elige una.">
        <Radio name="vista" label="Tabla" />
      </Fieldset>,
    );
    expect(markup).toMatch(/^<fieldset[^>]*aria-describedby="[^"]+-hint"/);
    expect(markup).toContain('<legend');
    expect(markup).toContain('type="radio"');
    expect(markup).toContain('rounded-full');
  });
});
