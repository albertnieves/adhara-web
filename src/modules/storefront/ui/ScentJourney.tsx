'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useMemo, useState, useSyncExternalStore } from 'react';
import {
  Button,
  EmptyState,
  Eyebrow,
  Heading,
  Price,
  buttonClass,
} from '@/components/ui';
import type {
  JourneyAnswers,
  JourneyDocument,
  NoteKey,
  ScentFamily,
  Season,
  TimeOfDay,
} from '@/modules/catalog';
import {
  answersFromSearch,
  answersToSearch,
  heroMedia,
  journeyOptions,
  lowestPrice,
  MAX_FAMILIES,
  NO_ANSWERS,
  noteName,
  recommend,
} from '@/modules/catalog';
import { Link } from '@/modules/i18n';
import { ProductImage } from './ProductImage';
import { ScentGlyph } from './ScentGlyphs';

/** Las respuestas viven en la URL: se pueden compartir y volver atrás. */
function subscribeUrl(listener: () => void) {
  window.addEventListener('popstate', listener);
  return () => window.removeEventListener('popstate', listener);
}
const readSearch = () => window.location.search;

function Chip({
  active,
  onClick,
  disabled = false,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      disabled={disabled}
      className={buttonClass(active ? 'primary' : 'outline', 'md')}
    >
      {children}
    </button>
  );
}

function toggle<T>(list: readonly T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];
}

/**
 * Recorrido olfativo (roadmap 6, DECISIONS §182): tres preguntas y las
 * propuestas al momento, cada una con lo que coincide y la fuente de su
 * perfil. Solo perfumes con ficha olfativa verificada.
 */
export function ScentJourney({ documents }: { documents: JourneyDocument[] }) {
  const t = useTranslations();
  const locale = useLocale();
  const search = useSyncExternalStore(subscribeUrl, readSearch, () => '');
  const [chosen, setChosen] = useState<JourneyAnswers | null>(null);
  const answers = useMemo(
    () => chosen ?? answersFromSearch(search),
    [chosen, search],
  );
  const options = useMemo(() => journeyOptions(documents), [documents]);
  const results = useMemo(
    () => recommend(documents, answers),
    [documents, answers],
  );
  const answered =
    answers.families.length +
      answers.seasons.length +
      answers.times.length +
      answers.likes.length >
    0;

  const update = (next: JourneyAnswers) => {
    setChosen(next);
    const url = new URL(window.location.href);
    url.search = answersToSearch(next);
    window.history.replaceState(window.history.state, '', url);
  };

  if (options.covered === 0) {
    return <EmptyState title={t('journey.empty')} className="my-12" />;
  }

  return (
    <div className="grid gap-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
      <div className="space-y-12">
        <fieldset>
          <legend>
            <Heading level={2} size="h3">
              {t('journey.families')}
            </Heading>
          </legend>
          <p className="text-fg-muted mt-2 text-sm">
            {t('journey.familiesHint', { max: MAX_FAMILIES })}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {options.families.map((family: ScentFamily) => {
              const active = answers.families.includes(family);
              return (
                <Chip
                  key={family}
                  active={active}
                  disabled={!active && answers.families.length >= MAX_FAMILIES}
                  onClick={() =>
                    update({
                      ...answers,
                      families: toggle(answers.families, family),
                    })
                  }
                >
                  {t(`family.${family}`)}
                </Chip>
              );
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend>
            <Heading level={2} size="h3">
              {t('journey.when')}
            </Heading>
          </legend>
          <div className="mt-5 grid gap-6 sm:grid-cols-[auto_auto] sm:justify-start">
            <div>
              <Eyebrow as="p" className="mb-3">
                {t('journey.season')}
              </Eyebrow>
              <div className="flex flex-wrap gap-2">
                {options.seasons.map((season: Season) => (
                  <Chip
                    key={season}
                    active={answers.seasons.includes(season)}
                    onClick={() =>
                      update({
                        ...answers,
                        seasons: toggle(answers.seasons, season),
                      })
                    }
                  >
                    <ScentGlyph name={season} className="size-4" />
                    {t(`season.${season}`)}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <Eyebrow as="p" className="mb-3">
                {t('journey.time')}
              </Eyebrow>
              <div className="flex flex-wrap gap-2">
                {options.times.map((time: TimeOfDay) => (
                  <Chip
                    key={time}
                    active={answers.times.includes(time)}
                    onClick={() =>
                      update({ ...answers, times: toggle(answers.times, time) })
                    }
                  >
                    <ScentGlyph name={time} className="size-4" />
                    {t(`timeOfDay.${time}`)}
                  </Chip>
                ))}
              </div>
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend>
            <Heading level={2} size="h3">
              {t('journey.notes')}
            </Heading>
          </legend>
          <p className="text-fg-muted mt-2 text-sm">{t('journey.notesHint')}</p>
          <Eyebrow as="p" className="mt-5 mb-3">
            {t('journey.likes')}
          </Eyebrow>
          <div className="flex flex-wrap gap-2">
            {options.notes.map((note: NoteKey) => (
              <Chip
                key={note}
                active={answers.likes.includes(note)}
                onClick={() =>
                  update({
                    ...answers,
                    likes: toggle(answers.likes, note),
                    avoid: answers.avoid.filter((n) => n !== note),
                  })
                }
              >
                {noteName(note, locale)}
              </Chip>
            ))}
          </div>
          <Eyebrow as="p" className="mt-6 mb-3">
            {t('journey.avoid')}
          </Eyebrow>
          <div className="flex flex-wrap gap-2">
            {options.notes.map((note: NoteKey) => (
              <Chip
                key={note}
                active={answers.avoid.includes(note)}
                onClick={() =>
                  update({
                    ...answers,
                    avoid: toggle(answers.avoid, note),
                    likes: answers.likes.filter((n) => n !== note),
                  })
                }
              >
                {noteName(note, locale)}
              </Chip>
            ))}
          </div>
        </fieldset>

        {answered && (
          <Button variant="subtle" size="sm" onClick={() => update(NO_ANSWERS)}>
            {t('journey.reset')}
          </Button>
        )}
      </div>

      <section
        aria-labelledby="propuestas"
        className="lg:sticky lg:top-28 lg:self-start"
      >
        <Heading level={2} size="h2" id="propuestas">
          {t('journey.results')}
        </Heading>
        <p role="status" className="text-fg-muted mt-3 text-sm">
          {answered
            ? t('journey.resultsCount', { count: results.length })
            : t('journey.start')}
        </p>
        {answered && results.length === 0 && (
          <EmptyState className="mt-8" title={t('journey.none')} />
        )}
        {results.length > 0 && (
          <ol className="mt-8 space-y-8">
            {results.map(({ product, profile, reasons }, index) => {
              const price = lowestPrice(product);
              const reasonLabels = [
                ...reasons.families.map((f) => t(`family.${f}`)),
                ...reasons.notes.map((n) => noteName(n, locale)),
                ...reasons.seasons.map((s) => t(`season.${s}`)),
                ...reasons.times.map((time) => t(`timeOfDay.${time}`)),
              ];
              return (
                <li
                  key={product.id}
                  className="border-border grid grid-cols-[6rem_minmax(0,1fr)] gap-5 border-b pb-8 sm:grid-cols-[8rem_minmax(0,1fr)]"
                >
                  <div className="bg-stage relative aspect-[4/5] overflow-hidden">
                    <div className="absolute inset-2">
                      <ProductImage
                        media={heroMedia(product)}
                        alt={`${product.brand.name} ${product.name}`}
                        // Sin foto, solo la estrella: el nombre de la casa no
                        // cabe en la miniatura.
                        brand=""
                        sizes="8rem"
                        priority={index < 2}
                      />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <Eyebrow>{product.brand.name}</Eyebrow>
                    <Heading level={3} size="h3" className="mt-1.5">
                      <Link
                        href={{
                          pathname: '/perfume/[slug]',
                          params: { slug: product.slug },
                        }}
                        className="link-underline"
                      >
                        {product.name}
                      </Link>
                    </Heading>
                    {price !== null && (
                      <Price
                        cents={price}
                        locale={locale}
                        labels={{
                          from: t('product.from'),
                          before: t('product.before'),
                        }}
                        from={
                          product.variants.filter((v) => v.priceCents !== null)
                            .length > 1
                        }
                        className="mt-2"
                      />
                    )}
                    <p className="text-accent-fg mt-3 text-sm">
                      {t('journey.reasons')}: {reasonLabels.join(' · ')}
                    </p>
                    <p className="text-fg-muted mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      <Link
                        href={{
                          pathname: '/catalogo-olfativo/[slug]',
                          params: { slug: product.slug },
                        }}
                        className="link-underline inline-flex min-h-6 items-center"
                      >
                        {t('journey.viewScent')}
                      </Link>
                      <a
                        href={profile.sourceUrl}
                        rel="noopener noreferrer"
                        className="link-underline inline-flex min-h-6 items-center"
                      >
                        {t('journey.source')}
                      </a>
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        <p className="text-fg-muted mt-8 text-xs leading-relaxed">
          {t('journey.coverage', {
            count: options.covered,
            total: options.total,
          })}
        </p>
      </section>
    </div>
  );
}
