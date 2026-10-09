import type { Metadata } from 'next';
import { Fragment } from 'react';
import { Eyebrow, Heading, Table, Td, Text, Th } from '@/components/ui';
import { Star } from '@/modules/brand';
import { storeContent, STORE_DEFAULTS } from '@/modules/content';
import { readStoreContent } from '@/modules/content/server';
import { Link } from '@/modules/i18n';
import { alternatesMetadata } from '@/modules/i18n/metadata';
import type { Locale } from '@/modules/i18n/seo';
import { LEGAL_COPY } from '../content';
import { LEGAL_ENTITY, LEGAL_UPDATED_AT } from '../domain/entity';
import { parseLegalText, resolveValue } from '../domain/placeholders';
import { LEGAL_PATHS } from '../domain/routes';
import { LEGAL_DOCUMENTS } from '../domain/types';
import type {
  LegalBlock,
  LegalCopy,
  LegalDocumentKey,
  LegalField,
} from '../domain/types';

type Values = Partial<Record<LegalField, string | null>>;

export function legalMetadata(doc: LegalDocumentKey, locale: Locale): Metadata {
  const { title, summary } = LEGAL_COPY[locale].documents[doc];
  return {
    title,
    description: summary,
    ...alternatesMetadata(LEGAL_PATHS[doc], locale),
  };
}

/** Datos para los marcadores: los del titular y los de la tienda (panel). */
async function legalValues(locale: Locale): Promise<Values> {
  const data = await readStoreContent('store', 'es');
  const store = data ? storeContent.parse(data.payload) : STORE_DEFAULTS;
  const entity = Object.fromEntries(
    Object.entries(LEGAL_ENTITY).map(([field, value]) => [
      field,
      resolveValue(value, locale),
    ]),
  );
  return {
    ...entity,
    email: store.email || null,
    phone: store.phone || null,
    storeAddress: [store.address, store.city].filter(Boolean).join(', '),
  };
}

function Rich({
  text,
  values,
  copy,
}: {
  text: string;
  values: Values;
  copy: LegalCopy;
}) {
  return parseLegalText(text, values).map((segment, index) => {
    switch (segment.kind) {
      case 'text':
        return <Fragment key={index}>{segment.text}</Fragment>;
      case 'value':
        if (segment.field === 'email') {
          return (
            <a
              key={index}
              href={`mailto:${segment.text}`}
              className="link-underline"
            >
              {segment.text}
            </a>
          );
        }
        return <Fragment key={index}>{segment.text}</Fragment>;
      case 'pending':
        return (
          <mark
            key={index}
            data-pending={segment.field}
            className="bg-warning-soft text-warning border-warning rounded-hairline border border-dashed px-1"
          >
            {copy.ui.pending}: {copy.fields[segment.field]}
          </mark>
        );
      case 'doc':
        return (
          <Link
            key={index}
            href={{
              pathname: LEGAL_PATHS[segment.doc],
              ...(segment.hash ? { hash: segment.hash } : {}),
            }}
            className="link-underline text-accent-fg"
          >
            {segment.text}
          </Link>
        );
      case 'link':
        return (
          <a
            key={index}
            href={segment.href}
            className="link-underline text-accent-fg"
            {...(segment.href.startsWith('https://')
              ? { rel: 'noopener noreferrer' }
              : {})}
          >
            {segment.text}
          </a>
        );
    }
  });
}

function Block({
  block,
  values,
  copy,
}: {
  block: LegalBlock;
  values: Values;
  copy: LegalCopy;
}) {
  if (typeof block === 'string') {
    return (
      <Text className="leading-relaxed">
        <Rich text={block} values={values} copy={copy} />
      </Text>
    );
  }
  if ('list' in block) {
    const ListTag = block.ordered ? 'ol' : 'ul';
    return (
      <ListTag
        className={`${block.ordered ? 'list-decimal' : 'list-disc'} marker:text-accent space-y-2 pl-6 leading-relaxed`}
      >
        {block.list.map((item, index) => (
          <li key={index}>
            <Rich text={item} values={values} copy={copy} />
          </li>
        ))}
      </ListTag>
    );
  }
  if ('note' in block) {
    return (
      <div className="border-accent bg-surface-raised border-l-2 px-5 py-4">
        <Text size="small" className="leading-relaxed">
          <Rich text={block.note} values={values} copy={copy} />
        </Text>
      </div>
    );
  }
  const labels = block.table.head.slice(1);
  return (
    <Table caption={block.table.caption}>
      <thead>
        <tr>
          {block.table.head.map((cell) => (
            <Th key={cell}>{cell}</Th>
          ))}
        </tr>
      </thead>
      <tbody>
        {block.table.rows.map(([name, ...cells]) => (
          <tr key={name}>
            <Td primary>
              <code className="font-sans font-semibold">{name}</code>
            </Td>
            {cells.map((cell, index) => (
              <Td key={index} label={labels[index]}>
                {cell}
              </Td>
            ))}
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

/**
 * Página de un texto legal: título, fecha de la versión, índice, secciones
 * y enlaces al resto. Los datos pendientes se ven como «Pendiente: …» para
 * revisarlos con el cliente (docs/LEGAL.md).
 */
export async function LegalPage({
  doc,
  locale,
}: {
  doc: LegalDocumentKey;
  locale: Locale;
}) {
  const copy = LEGAL_COPY[locale];
  const document = copy.documents[doc];
  const values = await legalValues(locale);
  const updated = new Intl.DateTimeFormat(locale, {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${LEGAL_UPDATED_AT}T00:00:00Z`));
  return (
    <main className="mx-auto max-w-[90rem] px-5 pt-36 pb-32 sm:px-10 sm:pt-44">
      <header className="max-w-3xl">
        <Star className="text-accent size-4" />
        <Eyebrow tone="accent" className="mt-6">
          {copy.ui.eyebrow}
        </Eyebrow>
        <Heading level={1} size="h1" className="mt-4">
          {document.title}
        </Heading>
        <p className="text-fg-muted mt-6 text-lg leading-relaxed">
          {document.summary}
        </p>
        <Text size="small" tone="muted" className="mt-4">
          {copy.ui.updated}: <time dateTime={LEGAL_UPDATED_AT}>{updated}</time>
        </Text>
        {document.notice && (
          <div
            role="note"
            className="border-warning bg-warning-soft text-warning mt-8 border-l-2 px-5 py-4"
          >
            <Text size="small" className="leading-relaxed">
              {document.notice}
            </Text>
          </div>
        )}
      </header>

      <div className="mt-16 grid gap-12 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-20">
        <nav
          aria-labelledby="legal-contents"
          className="lg:sticky lg:top-32 lg:self-start"
        >
          <Eyebrow as="h2" id="legal-contents">
            {copy.ui.contents}
          </Eyebrow>
          <ol className="border-border mt-5 space-y-3 border-l pl-5 text-sm">
            {document.sections.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="link-underline text-fg-muted hover:text-fg"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="max-w-3xl space-y-14">
          {document.sections.map((section) => (
            <section
              key={section.id}
              id={section.id}
              aria-labelledby={`${section.id}-title`}
              className="scroll-mt-32"
            >
              <Heading id={`${section.id}-title`} level={2} size="h3">
                {section.title}
              </Heading>
              <div className="mt-5 space-y-4">
                {section.blocks.map((block, index) => (
                  <Block
                    key={index}
                    block={block}
                    values={values}
                    copy={copy}
                  />
                ))}
              </div>
            </section>
          ))}
        </article>
      </div>

      <nav
        aria-labelledby="legal-related"
        className="border-border mt-24 border-t pt-10"
      >
        <Eyebrow as="h2" id="legal-related">
          {copy.ui.related}
        </Eyebrow>
        <ul className="mt-5 flex flex-wrap gap-x-8 gap-y-3 text-sm">
          {LEGAL_DOCUMENTS.filter((key) => key !== doc).map((key) => (
            <li key={key}>
              <Link href={LEGAL_PATHS[key]} className="link-underline">
                {copy.documents[key].title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </main>
  );
}
