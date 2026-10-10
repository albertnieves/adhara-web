import { describe, expect, it } from 'vitest';
import { routing } from '../../src/modules/i18n/routing';
import {
  LEGAL_COPY,
  LEGAL_DOCUMENTS,
  LEGAL_ENTITY,
  LEGAL_FIELDS,
  LEGAL_PATHS,
  invalidTokens,
  parseLegalText,
  resolveValue,
  visibleSegments,
} from '../../src/modules/legal';
import type { LegalBlock, LegalCopy } from '../../src/modules/legal';

/*
 * Textos legales (modules/legal): los tres idiomas tienen los mismos
 * documentos, secciones y marcadores, todos los marcadores y enlaces se
 * reconocen y cada texto tiene su ruta traducida.
 */

function blockTexts(block: LegalBlock): string[] {
  if (typeof block === 'string') return [block];
  if ('list' in block) return block.list;
  if ('note' in block) return [block.note];
  return [block.table.caption, ...block.table.head, ...block.table.rows.flat()];
}

function allTexts(copy: LegalCopy): string[] {
  return LEGAL_DOCUMENTS.flatMap((doc) => {
    const document = copy.documents[doc];
    return [
      document.title,
      document.summary,
      ...document.sections.flatMap((section) => [
        section.title,
        ...section.blocks.flatMap(blockTexts),
      ]),
    ];
  });
}

const fieldsOf = (texts: string[]) =>
  texts
    .flatMap((text) => [...text.matchAll(/\{([a-zA-Z]+)\}/g)])
    .map((match) => match[1])
    .sort();

const docLinksOf = (texts: string[]) =>
  texts
    .flatMap((text) => [...text.matchAll(/\]\((doc:[^)]+)\)/g)])
    .map((match) => match[1]!)
    .sort();

describe('parseLegalText', () => {
  it('sustituye los datos conocidos y marca los pendientes', () => {
    expect(
      parseLegalText('Titular: {holder}. NIF: {taxId}.', { holder: 'ACME SL' }),
    ).toEqual([
      { kind: 'text', text: 'Titular: ' },
      { kind: 'value', field: 'holder', text: 'ACME SL' },
      { kind: 'text', text: '. NIF: ' },
      { kind: 'pending', field: 'taxId' },
      { kind: 'text', text: '.' },
    ]);
  });

  it('reconoce enlaces a otros textos legales y externos', () => {
    expect(
      parseLegalText(
        'Ver [privacidad](doc:privacy#derechos) y [AEPD](https://www.aepd.es).',
        {},
      ),
    ).toEqual([
      { kind: 'text', text: 'Ver ' },
      { kind: 'doc', text: 'privacidad', doc: 'privacy', hash: 'derechos' },
      { kind: 'text', text: ' y ' },
      { kind: 'link', text: 'AEPD', href: 'https://www.aepd.es' },
      { kind: 'text', text: '.' },
    ]);
  });

  it('deja como texto lo que no reconoce, y lo señala', () => {
    const text = 'Hola {nombre}, mira [esto](doc:nada) y [eso](http://x.es).';
    expect(parseLegalText(text, {})).toEqual([{ kind: 'text', text }]);
    expect(invalidTokens(text)).toEqual([
      '{nombre}',
      '[esto](doc:nada)',
      '[eso](http://x.es)',
    ]);
  });

  it('en la tienda no se publica lo que tiene datos pendientes; en la vista previa, sí', () => {
    expect(visibleSegments('NIF: {taxId}', {}, false)).toBeNull();
    expect(visibleSegments('NIF: {taxId}', {}, true)).toEqual([
      { kind: 'text', text: 'NIF: ' },
      { kind: 'pending', field: 'taxId' },
    ]);
    expect(
      visibleSegments('NIF: {taxId}', { taxId: 'B00000000' }, false),
    ).toEqual([
      { kind: 'text', text: 'NIF: ' },
      { kind: 'value', field: 'taxId', text: 'B00000000' },
    ]);
  });

  it('un valor vacío cuenta como pendiente', () => {
    expect(resolveValue(null, 'es')).toBeNull();
    expect(resolveValue('  ', 'es')).toBeNull();
    expect(resolveValue({ es: 'a', ca: 'b', en: 'c' }, 'ca')).toBe('b');
  });
});

describe('textos legales', () => {
  it.each(['es', 'ca', 'en'] as const)(
    '%s no tiene marcadores ni enlaces desconocidos',
    (locale) => {
      const invalid = allTexts(LEGAL_COPY[locale]).flatMap(invalidTokens);
      expect(invalid).toEqual([]);
    },
  );

  it.each(['ca', 'en'] as const)(
    '%s tiene los mismos documentos, secciones, marcadores y enlaces que es',
    (locale) => {
      const es = LEGAL_COPY.es;
      const other = LEGAL_COPY[locale];
      for (const doc of LEGAL_DOCUMENTS) {
        const ids = (copy: LegalCopy) =>
          copy.documents[doc].sections.map((section) => [
            section.id,
            section.blocks.length,
          ]);
        expect(ids(other), doc).toEqual(ids(es));
      }
      expect(fieldsOf(allTexts(other))).toEqual(fieldsOf(allTexts(es)));
      expect(docLinksOf(allTexts(other))).toEqual(docLinksOf(allTexts(es)));
      expect(Object.keys(other.fields).sort()).toEqual(
        [...LEGAL_FIELDS].sort(),
      );
    },
  );

  it('los enlaces internos apuntan a secciones que existen', () => {
    for (const link of docLinksOf(allTexts(LEGAL_COPY.es))) {
      const [, doc, hash] = /^doc:(\w+)(?:#([\w-]+))?$/.exec(link)!;
      const document =
        LEGAL_COPY.es.documents[doc as keyof LegalCopy['documents']];
      expect(document, link).toBeDefined();
      if (hash) {
        expect(
          document.sections.map((section) => section.id),
          link,
        ).toContain(hash);
      }
    }
  });

  it('cada texto tiene su ruta en los tres idiomas', () => {
    const pathnames: Record<string, unknown> = routing.pathnames;
    for (const doc of LEGAL_DOCUMENTS) {
      expect(pathnames[LEGAL_PATHS[doc]], doc).toMatchObject({
        es: LEGAL_PATHS[doc],
      });
    }
  });

  it('no expone detalles internos de la web', () => {
    for (const locale of ['es', 'ca', 'en'] as const) {
      const text = allTexts(LEGAL_COPY[locale]).join(' ');
      expect(text).not.toMatch(
        /Vercel|Supabase|panel|tauler|dashboard|_vercel|sb-|prerender|todavía no|encara no|not available yet/i,
      );
    }
  });

  it('los datos del titular no se inventan: o un texto o pendiente', () => {
    for (const value of Object.values(LEGAL_ENTITY)) {
      expect(
        value === null ||
          typeof value === 'string' ||
          Object.keys(value).sort().join() === 'ca,en,es',
      ).toBe(true);
    }
  });
});
