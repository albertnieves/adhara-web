import type { Metadata } from 'next';
import { draftMode } from 'next/headers';
import { Fragment } from 'react';
import type { ReactNode } from 'react';
import {
  buttonClass,
  Eyebrow,
  Heading,
  Table,
  Td,
  Text,
  Th,
} from '@/components/ui';
import { Star } from '@/modules/brand';
import { Link } from '@/modules/i18n';
import { alternatesMetadata } from '@/modules/i18n/metadata';
import type { Locale } from '@/modules/i18n/seo';
import { activeVendors, CookieSettingsButton } from '@/modules/tracking';
import { serverTrackingConfig } from '@/modules/tracking/server';
import { LEGAL_COPY } from '../content';
import {
  legalConditions,
  legalUpdatedAt,
  rowParts,
} from '../domain/conditions';
import { LEGAL_UPDATED_AT } from '../domain/entity';
import { visibleSegments } from '../domain/placeholders';
import type { LegalSegment } from '../domain/placeholders';
import { LEGAL_PATHS } from '../domain/routes';
import { LEGAL_DOCUMENTS } from '../domain/types';
import type {
  LegalBlock,
  LegalCondition,
  LegalCopy,
  LegalDocumentKey,
} from '../domain/types';
import type { LegalValues } from '../server/values';
import { legalValues } from '../server/values';

type Values = LegalValues;

export function legalMetadata(doc: LegalDocumentKey, locale: Locale): Metadata {
  const { title, summary } = LEGAL_COPY[locale].documents[doc];
  return {
    title,
    description: summary,
    ...alternatesMetadata(LEGAL_PATHS[doc], locale),
  };
}

type Context = {
  values: Values;
  copy: LegalCopy;
  preview: boolean;
  conditions: ReadonlySet<LegalCondition>;
};

/**
 * Lo que depende de una configuración que no está (§178): en la tienda no se
 * publica; en la vista previa del personal se ve recuadrado, para revisarlo
 * con la asesoría antes de encenderlo.
 */
function Conditional({
  when,
  ctx,
  children,
}: {
  when: LegalCondition;
  ctx: Context;
  children: ReactNode;
}) {
  if (ctx.conditions.has(when)) return children;
  if (!ctx.preview) return null;
  return (
    <div
      data-conditional={when}
      className="border-warning rounded-hairline space-y-4 border border-dashed p-4"
    >
      <p className="text-warning text-xs font-semibold">
        {ctx.copy.ui.onlyWith}: {ctx.copy.conditions[when]}
      </p>
      {children}
    </div>
  );
}

function Rich({
  segments,
  copy,
}: {
  segments: LegalSegment[];
  copy: LegalCopy;
}) {
  return segments.map((segment, index) => {
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

function Block({ block, ctx }: { block: LegalBlock; ctx: Context }) {
  const visible = (text: string) =>
    visibleSegments(text, ctx.values, ctx.preview);
  if (typeof block === 'string') {
    const segments = visible(block);
    if (!segments) return null;
    return (
      <Text className="leading-relaxed">
        <Rich segments={segments} copy={ctx.copy} />
      </Text>
    );
  }
  if ('list' in block) {
    const items = block.list
      .map(visible)
      .filter((item): item is LegalSegment[] => item !== null);
    if (items.length === 0) return null;
    const ListTag = block.ordered ? 'ol' : 'ul';
    return (
      <ListTag
        className={`${block.ordered ? 'list-decimal' : 'list-disc'} marker:text-accent space-y-2 pl-6 leading-relaxed`}
      >
        {items.map((segments, index) => (
          <li key={index}>
            <Rich segments={segments} copy={ctx.copy} />
          </li>
        ))}
      </ListTag>
    );
  }
  if ('note' in block) {
    const segments = visible(block.note);
    if (!segments) return null;
    return (
      <div className="border-accent bg-surface-raised border-l-2 px-5 py-4">
        <Text size="small" className="leading-relaxed">
          <Rich segments={segments} copy={ctx.copy} />
        </Text>
      </div>
    );
  }
  if ('when' in block) {
    return (
      <Conditional when={block.when} ctx={ctx}>
        {block.blocks.map((child, index) => (
          <Block key={index} block={child} ctx={ctx} />
        ))}
      </Conditional>
    );
  }
  if ('action' in block) {
    return (
      <CookieSettingsButton className={buttonClass('outline')}>
        {ctx.copy.ui.cookieSettings}
      </CookieSettingsButton>
    );
  }
  const labels = block.table.head.slice(1);
  const rows = block.table.rows
    .map(rowParts)
    .filter(
      ({ when }) => when === null || ctx.preview || ctx.conditions.has(when),
    );
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
        {rows.map(({ cells: [name, ...cells], when }) => (
          <tr
            key={name}
            {...(when && !ctx.conditions.has(when)
              ? { 'data-conditional': when }
              : {})}
          >
            <Td primary>
              <code className="font-sans font-semibold">{name}</code>
              {when && !ctx.conditions.has(when) && (
                <span className="text-warning mt-1 block text-xs">
                  {ctx.copy.ui.onlyWith}: {ctx.copy.conditions[when]}
                </span>
              )}
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
 * y enlaces al resto. Lo que depende de un dato pendiente no se publica; en
 * la vista previa del personal se ve como «Pendiente: …» (docs/LEGAL.md).
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
  const [values, draft] = await Promise.all([legalValues(locale), draftMode()]);
  const conditions = legalConditions(activeVendors(serverTrackingConfig()));
  const ctx: Context = {
    values,
    copy,
    preview: draft.isEnabled,
    conditions,
  };
  // Las secciones de una configuración que no está no se publican (§178).
  const sections = document.sections.filter(
    (section) => !section.when || ctx.preview || conditions.has(section.when),
  );
  const updatedAt = legalUpdatedAt(LEGAL_UPDATED_AT, doc, conditions);
  const updated = new Intl.DateTimeFormat(locale, {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${updatedAt}T00:00:00Z`));
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
          {copy.ui.updated}: <time dateTime={updatedAt}>{updated}</time>
        </Text>
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
            {sections.map((section) => (
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
          {sections.map((section) => (
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
                {section.when ? (
                  <Conditional when={section.when} ctx={ctx}>
                    {section.blocks.map((block, index) => (
                      <Block key={index} block={block} ctx={ctx} />
                    ))}
                  </Conditional>
                ) : (
                  section.blocks.map((block, index) => (
                    <Block key={index} block={block} ctx={ctx} />
                  ))
                )}
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
