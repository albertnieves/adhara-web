import { describe, expect, it } from 'vitest';
import { routing } from '../../src/modules/i18n/routing';
import { LEGAL_COPY } from '../../src/modules/legal/content';
import {
  activeBlocks,
  legalConditions,
  legalUpdatedAt,
  rowParts,
  TRACKING_TEXTS_UPDATED_AT,
} from '../../src/modules/legal/domain/conditions';
import { LEGAL_ENTITY } from '../../src/modules/legal/domain/entity';
import { legalDocumentText } from '../../src/modules/legal/domain/plain-text';
import {
  invalidTokens,
  parseLegalText,
  resolveValue,
  visibleSegments,
} from '../../src/modules/legal/domain/placeholders';
import { LEGAL_PATHS } from '../../src/modules/legal/domain/routes';
import {
  LEGAL_CONDITIONS,
  LEGAL_DOCUMENTS,
  LEGAL_FIELDS,
} from '../../src/modules/legal/domain/types';
import type {
  LegalBlock,
  LegalCopy,
} from '../../src/modules/legal/domain/types';
import { TRACKING_VENDORS } from '../../src/modules/tracking';

/*
 * Textos legales (modules/legal): los tres idiomas tienen los mismos
 * documentos, secciones y marcadores, todos los marcadores y enlaces se
 * reconocen y cada texto tiene su ruta traducida.
 */

function blockTexts(block: LegalBlock): string[] {
  if (typeof block === 'string') return [block];
  if ('list' in block) return block.list;
  if ('note' in block) return [block.note];
  if ('when' in block) return block.blocks.flatMap(blockTexts);
  if ('action' in block) return [];
  return [
    block.table.caption,
    ...block.table.head,
    ...block.table.rows.flatMap((row) => rowParts(row).cells),
  ];
}

/** Forma de un bloque: tipo, condición y tamaño, sin el texto. */
function blockShape(block: LegalBlock): unknown {
  if (typeof block === 'string') return 'p';
  if ('list' in block) return ['list', block.list.length];
  if ('note' in block) return 'note';
  if ('when' in block) return [block.when, block.blocks.map(blockShape)];
  if ('action' in block) return ['action', block.action];
  return [
    'table',
    block.table.head.length,
    block.table.rows.map((row) => [
      rowParts(row).when,
      rowParts(row).cells.length,
    ]),
  ];
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
            section.when ?? null,
            section.blocks.map(blockShape),
          ]);
        expect(ids(other), doc).toEqual(ids(es));
      }
      expect(fieldsOf(allTexts(other))).toEqual(fieldsOf(allTexts(es)));
      expect(docLinksOf(allTexts(other))).toEqual(docLinksOf(allTexts(es)));
      expect(Object.keys(other.fields).sort()).toEqual(
        [...LEGAL_FIELDS].sort(),
      );
      expect(Object.keys(other.conditions).sort()).toEqual(
        [...LEGAL_CONDITIONS].sort(),
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

describe('textos de analítica y publicidad (DECISIONS §179)', () => {
  const href = (doc: string, hash?: string) =>
    `https://example.test/${doc}${hash ? `#${hash}` : ''}`;
  const cookiesText = (
    locale: 'es' | 'ca' | 'en',
    vendors: (typeof TRACKING_VENDORS)[number][],
  ) =>
    legalDocumentText(
      LEGAL_COPY[locale],
      'cookies',
      {},
      {
        href,
        updated: '2026-10-29',
        vendors,
      },
    );

  it('las condiciones salen de los proveedores configurados', () => {
    expect([...legalConditions([])]).toEqual(['noOptional']);
    expect([...legalConditions(['ga4', 'meta'])].sort()).toEqual(
      ['ads', 'analytics', 'ga4', 'meta', 'optional'].sort(),
    );
  });

  it('un grupo o una fila con condición solo se publica si se cumple', () => {
    const blocks: LegalBlock[] = [
      'siempre',
      { when: 'meta', blocks: ['solo con Meta'] },
      {
        table: {
          caption: 'c',
          head: ['a', 'b'],
          rows: [['x', '1'], { when: 'tiktok', cells: ['y', '2'] }],
        },
      },
    ];
    expect(activeBlocks(blocks, legalConditions([]))).toEqual([
      'siempre',
      { table: { caption: 'c', head: ['a', 'b'], rows: [['x', '1']] } },
    ]);
    expect(activeBlocks(blocks, legalConditions(['meta', 'tiktok']))).toEqual([
      'siempre',
      'solo con Meta',
      {
        table: {
          caption: 'c',
          head: ['a', 'b'],
          rows: [['x', '1'], { when: 'tiktok', cells: ['y', '2'] }],
        },
      },
    ]);
  });

  it.each(['es', 'ca', 'en'] as const)(
    '%s: sin proveedores, la política de cookies no habla de terceros',
    (locale) => {
      const text = cookiesText(locale, []);
      expect(text).not.toMatch(
        /Google Analytics|_ga|_gcl|_fbp|_ttp|Meta Platforms|TikTok|atelier_cookies/,
      );
    },
  );

  it.each(['es', 'ca', 'en'] as const)(
    '%s: cada proveedor configurado aparece con sus cookies, y solo él',
    (locale) => {
      const onlyMeta = cookiesText(locale, ['meta']);
      expect(onlyMeta).toMatch(/_fbp/);
      expect(onlyMeta).toMatch(/atelier_cookies/);
      expect(onlyMeta).not.toMatch(/_ga\b|_gcl_au|_ttp|Google Analytics/);
      const all = cookiesText(locale, [...TRACKING_VENDORS]);
      for (const cookie of ['_ga', '_gcl_au', '_fbp', '_ttp', 'gaoptout'])
        expect(all, cookie).toContain(cookie);
    },
  );

  it('la fecha de cookies y privacidad cambia sola al configurar la medición', () => {
    const none = legalConditions([]);
    const some = legalConditions(['ga4']);
    expect(legalUpdatedAt('2026-10-16', 'cookies', none)).toBe('2026-10-16');
    expect(legalUpdatedAt('2026-10-16', 'cookies', some)).toBe(
      TRACKING_TEXTS_UPDATED_AT,
    );
    expect(legalUpdatedAt('2026-10-16', 'terms', some)).toBe('2026-10-16');
    expect(legalUpdatedAt('2027-01-01', 'privacy', some)).toBe('2027-01-01');
  });
});
