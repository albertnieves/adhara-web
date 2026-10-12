import { visibleSegments } from './placeholders';
import type { LegalSegment } from './placeholders';
import type { LegalCopy, LegalDocumentKey, LegalField } from './types';

/**
 * Un texto legal en texto plano, como se publica en la tienda (sin los
 * párrafos con datos pendientes). Lo adjunta el correo de confirmación del
 * pedido: las condiciones en un soporte duradero (LEGAL.md). Los enlaces a
 * otros textos van como URL completas que da `href`.
 */
export function legalDocumentText(
  copy: LegalCopy,
  doc: LegalDocumentKey,
  values: Partial<Record<LegalField, string | null>>,
  {
    href,
    updated,
  }: {
    href: (doc: LegalDocumentKey, hash?: string) => string;
    updated: string;
  },
): string {
  const document = copy.documents[doc];
  const line = (text: string) => {
    const segments = visibleSegments(text, values, false);
    return segments ? segments.map((s) => segmentText(s, href)).join('') : null;
  };
  const out: string[] = [
    document.title.toUpperCase(),
    document.summary,
    `${copy.ui.updated}: ${updated}`,
  ];
  for (const section of document.sections) {
    const body: string[] = [];
    for (const block of section.blocks) {
      if (typeof block === 'string') {
        const text = line(block);
        if (text) body.push(text);
      } else if ('list' in block) {
        const items = block.list.flatMap((item) => line(item) ?? []);
        body.push(
          items
            .map((item, i) => `${block.ordered ? `${i + 1}.` : '-'} ${item}`)
            .join('\n'),
        );
      } else if ('note' in block) {
        const text = line(block.note);
        if (text) body.push(text);
      } else {
        const [first, ...labels] = block.table.head;
        body.push(
          [
            block.table.caption,
            ...block.table.rows.map(
              ([name, ...cells]) =>
                `- ${first}: ${name}; ${cells
                  .map((cell, i) => `${labels[i]}: ${cell}`)
                  .join('; ')}`,
            ),
          ].join('\n'),
        );
      }
    }
    if (body.length)
      out.push(`${section.title.toUpperCase()}\n\n${body.join('\n\n')}`);
  }
  return `${out.join('\n\n')}\n`;
}

function segmentText(
  segment: LegalSegment,
  href: (doc: LegalDocumentKey, hash?: string) => string,
): string {
  switch (segment.kind) {
    case 'text':
    case 'value':
      return segment.text;
    case 'link':
      return segment.href.startsWith('mailto:')
        ? segment.text
        : `${segment.text} (${segment.href})`;
    case 'doc':
      return `${segment.text} (${href(segment.doc, segment.hash)})`;
    case 'pending':
      return '';
  }
}
