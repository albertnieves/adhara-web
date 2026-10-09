import { useLocale, useTranslations } from 'next-intl';
import { Eyebrow, Heading } from '@/components/ui';
import type {
  NoteGroup,
  NoteKey,
  ScentProfile,
  Season,
  TimeOfDay,
} from '@/modules/catalog';
import {
  NOTES,
  NOTE_GROUPS,
  SEASONS,
  TIMES_OF_DAY,
  allNotes,
  noteName,
} from '@/modules/catalog';
import { ScentGlyph, ScentGlyphShape } from './ScentGlyphs';

function NoteChips({ notes }: { notes: NoteKey[] }) {
  const locale = useLocale();
  return (
    <ul className="flex flex-wrap justify-center gap-2">
      {notes.map((key) => (
        <li
          key={key}
          className="border-border-strong text-fg inline-flex items-center border px-3 py-1.5 text-sm"
        >
          {noteName(key, locale)}
        </li>
      ))}
    </ul>
  );
}

/**
 * Pirámide olfativa: tres pisos que se ensanchan de la salida al fondo. Si la
 * fuente no separa las notas, se muestran como notas principales.
 */
export function ScentPyramid({ profile }: { profile: ScentProfile }) {
  const t = useTranslations('scent');
  const tiers = [
    { key: 'top', notes: profile.top, width: 'max-w-xl', mark: 'I' },
    { key: 'heart', notes: profile.heart, width: 'max-w-3xl', mark: 'II' },
    { key: 'base', notes: profile.base, width: 'max-w-5xl', mark: 'III' },
  ] as const;
  const pyramid = tiers.some((tier) => tier.notes.length > 0);
  if (!pyramid) {
    if (profile.key.length === 0) return null;
    return (
      <div className="mx-auto max-w-3xl text-center">
        <Eyebrow tone="accent">{t('keyNotes')}</Eyebrow>
        <p className="text-fg-muted mt-2 text-sm">{t('keyNotesHint')}</p>
        <div className="mt-8">
          <NoteChips notes={profile.key} />
        </div>
      </div>
    );
  }
  return (
    <ol className="flex flex-col items-center gap-px">
      {tiers
        .filter((tier) => tier.notes.length > 0)
        .map((tier) => (
          <li
            key={tier.key}
            className={`border-border w-full border-t py-10 text-center ${tier.width}`}
          >
            <p
              aria-hidden
              className="font-display text-accent-fg text-3xl font-light"
            >
              {tier.mark}
            </p>
            <Eyebrow as="h3" tone="accent" className="mt-2">
              {t(tier.key)}
            </Eyebrow>
            <p className="text-fg-muted mt-2 text-sm">{t(`${tier.key}Hint`)}</p>
            <div className="mt-6">
              <NoteChips notes={tier.notes} />
            </div>
          </li>
        ))}
    </ol>
  );
}

/**
 * Huella olfativa: cuántas notas de cada grupo tiene el perfume. Se calcula
 * de las notas de la fuente; no es una valoración propia.
 */
export function ScentFootprint({ profile }: { profile: ScentProfile }) {
  const t = useTranslations('scent');
  const tGroup = useTranslations('noteGroup');
  const counts = new Map<NoteGroup, number>();
  for (const key of allNotes(profile)) {
    const group = NOTES[key].group;
    counts.set(group, (counts.get(group) ?? 0) + 1);
  }
  const rows = NOTE_GROUPS.filter((group) => counts.has(group))
    .map((group) => ({ group, count: counts.get(group) ?? 0 }))
    .sort((a, b) => b.count - a.count);
  if (rows.length === 0) return null;
  const max = rows[0]!.count;
  return (
    <div>
      <Eyebrow as="h3">{t('footprint')}</Eyebrow>
      <p className="text-fg-muted mt-2 text-sm">{t('footprintHint')}</p>
      <ul className="mt-6 space-y-4">
        {rows.map(({ group, count }) => (
          <li key={group}>
            <div className="flex items-baseline justify-between gap-4 text-sm">
              <span>{tGroup(group)}</span>
              <span className="text-fg-muted tabular-nums">
                {t('notesCount', { count })}
              </span>
            </div>
            <div aria-hidden className="bg-border mt-2 h-px w-full">
              <div
                className="bg-accent h-px"
                style={{ width: `${(count / max) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

const QUADRANT: Record<Season, number> = {
  spring: -90,
  summer: 0,
  autumn: 90,
  winter: 180,
};

/** Sector de corona entre dos ángulos (grados, 0 = derecha, sentido horario). */
function sector(start: number, end: number, outer = 92, inner = 52) {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const point = (r: number, deg: number) =>
    `${(100 + r * Math.cos(rad(deg))).toFixed(2)} ${(100 + r * Math.sin(rad(deg))).toFixed(2)}`;
  return [
    `M ${point(outer, start)}`,
    `A ${outer} ${outer} 0 0 1 ${point(outer, end)}`,
    `L ${point(inner, end)}`,
    `A ${inner} ${inner} 0 0 0 ${point(inner, start)}`,
    'Z',
  ].join(' ');
}

/** Rueda de las cuatro estaciones con las recomendadas por la fuente. */
export function SeasonWheel({ seasons }: { seasons: Season[] }) {
  const t = useTranslations('season');
  const tScent = useTranslations('scent');
  return (
    <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-center">
      <svg
        viewBox="0 0 200 200"
        aria-hidden
        focusable="false"
        className="size-48 shrink-0"
      >
        {SEASONS.map((season) => {
          const start = QUADRANT[season] + 3;
          const active = seasons.includes(season);
          return (
            <path
              key={season}
              d={sector(start, start + 84)}
              className={
                active
                  ? 'fill-accent stroke-accent'
                  : 'stroke-border-strong fill-none'
              }
              strokeWidth={1}
            />
          );
        })}
        {SEASONS.map((season) => {
          const mid = ((QUADRANT[season] + 45) * Math.PI) / 180;
          return (
            <ScentGlyphShape
              key={season}
              name={season}
              x={Number((100 + 72 * Math.cos(mid) - 10).toFixed(2))}
              y={Number((100 + 72 * Math.sin(mid) - 10).toFixed(2))}
              size={20}
              className={
                seasons.includes(season) ? 'text-fg-inverse' : 'text-fg-muted'
              }
            />
          );
        })}
      </svg>
      <ul className="grid grid-cols-2 gap-x-8 gap-y-3">
        {SEASONS.map((season) => {
          const active = seasons.includes(season);
          return (
            <li
              key={season}
              className={`flex items-center gap-3 text-sm ${active ? 'text-fg' : 'text-fg-muted'}`}
            >
              <ScentGlyph
                name={season}
                className={`size-5 ${active ? 'text-accent-fg' : ''}`}
              />
              <span>
                {t(season)}
                <span className="sr-only">
                  {' '}
                  · {active ? tScent('recommended') : tScent('notIndicated')}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Día y noche, con el recomendado destacado. */
export function TimeOfDayView({ times }: { times: TimeOfDay[] }) {
  const t = useTranslations('timeOfDay');
  const tScent = useTranslations('scent');
  return (
    <ul className="grid grid-cols-2 gap-4">
      {TIMES_OF_DAY.map((time) => {
        const active = times.includes(time);
        return (
          <li
            key={time}
            className={`flex flex-col items-center gap-3 border px-4 py-6 text-center ${
              active ? 'border-accent text-fg' : 'border-border text-fg-muted'
            }`}
          >
            <ScentGlyph
              name={time}
              className={`size-8 ${active ? 'text-accent-fg' : ''}`}
            />
            <span className="text-2xs tracking-caps-lg uppercase">
              {t(time)}
            </span>
            <span className="sr-only">
              {active ? tScent('recommended') : tScent('notIndicated')}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Estaciones y momentos en una línea compacta (tarjetas del catálogo). */
export function ScentMoments({ profile }: { profile: ScentProfile }) {
  const tSeason = useTranslations('season');
  const tTime = useTranslations('timeOfDay');
  if (profile.seasons.length === 0 && profile.times.length === 0) return null;
  const label = [
    ...profile.seasons.map((s) => tSeason(s)),
    ...profile.times.map((s) => tTime(s)),
  ].join(', ');
  return (
    <div className="flex items-center gap-3">
      <span className="sr-only">{label}</span>
      {profile.seasons.length > 0 && (
        <span aria-hidden className="flex items-center gap-1.5">
          {SEASONS.map((season) => (
            <ScentGlyph
              key={season}
              name={season}
              className={`size-4 ${profile.seasons.includes(season) ? 'text-accent-fg' : 'text-fg-muted opacity-35'}`}
            />
          ))}
        </span>
      )}
      {profile.seasons.length > 0 && profile.times.length > 0 && (
        <span aria-hidden className="bg-border h-4 w-px" />
      )}
      {profile.times.length > 0 && (
        <span aria-hidden className="flex items-center gap-1.5">
          {TIMES_OF_DAY.map((time) => (
            <ScentGlyph
              key={time}
              name={time}
              className={`size-4 ${profile.times.includes(time) ? 'text-accent-fg' : 'text-fg-muted opacity-35'}`}
            />
          ))}
        </span>
      )}
    </div>
  );
}

/** Titular de sección del catálogo olfativo. */
export function ScentSectionTitle({
  eyebrow,
  title,
  center = false,
}: {
  eyebrow: string;
  title: string;
  center?: boolean;
}) {
  return (
    <div className={center ? 'text-center' : undefined}>
      <Eyebrow tone="accent">{eyebrow}</Eyebrow>
      <Heading level={2} size="h2" className="mt-4">
        {title}
      </Heading>
    </div>
  );
}
