import type { LegalValue } from './entity';
import { LEGAL_DOCUMENTS, LEGAL_FIELDS } from './types';
import type { LegalDocumentKey, LegalField } from './types';

export type LegalSegment =
  | { kind: 'text'; text: string }
  | { kind: 'value'; field: LegalField; text: string }
  | { kind: 'pending'; field: LegalField }
  | { kind: 'link'; text: string; href: string }
  | { kind: 'doc'; text: string; doc: LegalDocumentKey; hash?: string };

const FIELD_SET = new Set<string>(LEGAL_FIELDS);
const DOC_SET = new Set<string>(LEGAL_DOCUMENTS);

/** `[texto](destino)` o `{campo}`. */
const TOKEN = /\[([^\]]+)\]\(([^)\s]+)\)|\{([a-zA-Z]+)\}/g;

/** Valor en el idioma pedido; vacío cuenta como pendiente. */
export function resolveValue(
  value: LegalValue | undefined,
  locale: 'es' | 'ca' | 'en',
): string | null {
  if (value == null) return null;
  const text = typeof value === 'string' ? value : value[locale];
  return text.trim() ? text : null;
}

/**
 * Parte un texto en trozos: texto, dato conocido, dato pendiente o enlace.
 * - `{campo}` se sustituye por el dato o queda como pendiente;
 * - `[texto](doc:privacy#derechos)` enlaza otro texto legal en el mismo idioma;
 * - `[texto](https://…)` o `mailto:` enlaza fuera.
 * Una llave o un destino que no se reconocen se dejan como texto, para que
 * el error se vea en la página y lo detecten las pruebas.
 */
export function parseLegalText(
  text: string,
  values: Partial<Record<LegalField, string | null>>,
): LegalSegment[] {
  const segments: LegalSegment[] = [];
  let last = 0;
  const push = (segment: LegalSegment, start: number, end: number) => {
    if (start > last) {
      segments.push({ kind: 'text', text: text.slice(last, start) });
    }
    segments.push(segment);
    last = end;
  };
  for (const match of text.matchAll(TOKEN)) {
    const [whole, linkText, href, field] = match;
    const end = match.index + whole.length;
    if (field !== undefined) {
      if (!FIELD_SET.has(field)) continue;
      const key = field as LegalField;
      const value = values[key];
      push(
        value
          ? { kind: 'value', field: key, text: value }
          : { kind: 'pending', field: key },
        match.index,
        end,
      );
    } else if (linkText !== undefined && href !== undefined) {
      const doc = /^doc:([a-zA-Z]+)(?:#([\w-]+))?$/.exec(href);
      if (doc && DOC_SET.has(doc[1]!)) {
        push(
          {
            kind: 'doc',
            text: linkText,
            doc: doc[1] as LegalDocumentKey,
            ...(doc[2] ? { hash: doc[2] } : {}),
          },
          match.index,
          end,
        );
      } else if (/^(https:\/\/|mailto:)/.test(href)) {
        push({ kind: 'link', text: linkText, href }, match.index, end);
      }
    }
  }
  if (last < text.length) {
    segments.push({ kind: 'text', text: text.slice(last) });
  }
  return segments;
}

/**
 * Lo que se publica de un texto: en la tienda, un párrafo o una línea de
 * lista con algún dato pendiente no se muestra (la página se lee completa,
 * sin huecos); en la vista previa del personal se ve con el marcador
 * «Pendiente: …» para revisarlo con el cliente.
 */
export function visibleSegments(
  text: string,
  values: Partial<Record<LegalField, string | null>>,
  showPending: boolean,
): LegalSegment[] | null {
  const segments = parseLegalText(text, values);
  if (!showPending && segments.some((segment) => segment.kind === 'pending')) {
    return null;
  }
  return segments;
}

/** Marcadores o enlaces de un texto que no se reconocen. */
export function invalidTokens(text: string): string[] {
  return parseLegalText(text, {})
    .filter((segment) => segment.kind === 'text')
    .flatMap((segment) => [
      ...segment.text.matchAll(/\{[^}]*\}|\[[^\]]*\]\([^)]*\)/g),
    ])
    .map((match) => match[0]);
}
