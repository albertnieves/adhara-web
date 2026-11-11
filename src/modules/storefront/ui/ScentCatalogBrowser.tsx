'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import {
  useDeferredValue,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  Button,
  EmptyState,
  Eyebrow,
  Heading,
  SearchField,
} from '@/components/ui';
import type {
  ScentFamily,
  ScentProfile,
  Season,
  StorefrontProduct,
  TimeOfDay,
} from '@/modules/catalog';
import {
  SCENT_FAMILIES,
  SEASONS,
  TIMES_OF_DAY,
  heroMedia,
  noteName,
  normalizeSearch,
  profileMatchesNote,
} from '@/modules/catalog';
import { Link } from '@/modules/i18n';
import { CardStage } from './CardStage';
import { CountLabel } from './CountLabel';
import { FilterChip } from './FilterChip';
import { ScentGlyph } from './ScentGlyphs';
import { ScentMoments } from './ScentProfileView';
import { ViewToggle } from './ViewToggle';
import { productGridClass, useCatalogView } from './catalogView';

/** La URL no avisa de sus cambios: basta con leerla al pintar. */
const subscribeNoop = () => () => {};
/** `?familia=floral`: la búsqueda de la tienda enlaza una familia (§181). */
function familyFromUrl(): ScentFamily | null {
  const value = new URLSearchParams(window.location.search).get('familia');
  return SCENT_FAMILIES.find((family) => family === value) ?? null;
}

export type ScentEntry = {
  product: StorefrontProduct;
  profile: ScentProfile | null;
};

/**
 * Tarjeta del catálogo olfativo: sin precio ni compra, con su perfil.
 * `compact`, para la cuadrícula de dos columnas del móvil.
 */
export function ScentCard({
  entry,
  priority,
  compact = false,
}: {
  entry: ScentEntry;
  priority: boolean;
  compact?: boolean;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const { product, profile } = entry;
  const media = heroMedia(product);
  // Una nota de cada piso, o las primeras notas principales.
  const preview = profile
    ? [profile.top[0], profile.heart[0], profile.base[0], ...profile.key]
        .filter((key) => key !== undefined)
        .slice(0, 3)
        .map((key) => noteName(key, locale))
    : [];
  return (
    <Link
      href={{
        pathname: '/catalogo-olfativo/[slug]',
        params: { slug: product.slug },
      }}
      className="group block min-w-0"
    >
      <CardStage
        media={media}
        alt={`${product.brand.name} ${product.name}`}
        brand={product.brand.name}
        sizes={`(min-width: 1280px) 22vw, (min-width: 1024px) 30vw, (min-width: 640px) 45vw, ${compact ? '45vw' : '90vw'}`}
        priority={priority}
        inset={compact ? 'inset-3 sm:inset-8' : 'inset-8'}
      />
      <div className={`min-w-0 ${compact ? 'mt-3 sm:mt-5' : 'mt-5'}`}>
        <Eyebrow>{product.brand.name}</Eyebrow>
        <Heading level={3} size="h3" className="mt-1.5 line-clamp-2">
          {product.name}
        </Heading>
        {profile && profile.families.length > 0 && (
          <p
            className={`font-display text-accent-fg mt-1 italic ${compact ? 'text-base sm:text-lg' : 'text-lg'}`}
          >
            {profile.families.map((f) => t(`family.${f}`)).join(' · ')}
          </p>
        )}
        {preview.length > 0 && (
          <p
            className={`text-fg-muted mt-2 line-clamp-2 ${compact ? 'text-xs sm:text-sm' : 'text-sm'}`}
          >
            {preview.join(' · ')}
          </p>
        )}
        {profile && (
          <div className={compact ? 'mt-3 sm:mt-4' : 'mt-4'}>
            <ScentMoments profile={profile} />
          </div>
        )}
      </div>
    </Link>
  );
}

export function ScentCatalogBrowser({ entries }: { entries: ScentEntry[] }) {
  const t = useTranslations();
  const reduced = useReducedMotion();
  const [query, setQuery] = useState('');
  const requested = useSyncExternalStore(
    subscribeNoop,
    familyFromUrl,
    () => null,
  );
  // undefined: aún no se ha tocado el filtro y manda la URL.
  const [chosen, setFamily] = useState<ScentFamily | null | undefined>(
    undefined,
  );
  const family = chosen === undefined ? requested : chosen;
  const [season, setSeason] = useState<Season | null>(null);
  const [time, setTime] = useState<TimeOfDay | null>(null);
  const [view, setView] = useCatalogView();
  const deferredQuery = useDeferredValue(query);

  const families = SCENT_FAMILIES.filter((value) =>
    entries.some((e) => e.profile?.families.includes(value)),
  );

  const visible = useMemo(() => {
    const needle = normalizeSearch(deferredQuery);
    return entries.filter(({ product, profile }) => {
      if (family && !profile?.families.includes(family)) return false;
      if (season && !profile?.seasons.includes(season)) return false;
      if (time && !profile?.times.includes(time)) return false;
      if (!needle) return true;
      const text = normalizeSearch(`${product.name} ${product.brand.name}`);
      return (
        text.includes(needle) ||
        (profile !== null && profileMatchesNote(profile, needle))
      );
    });
  }, [entries, family, season, time, deferredQuery]);

  const filtered = Boolean(query || family || season || time);
  const clear = () => {
    setQuery('');
    setFamily(null);
    setSeason(null);
    setTime(null);
  };

  if (entries.length === 0) {
    return <EmptyState title={t('scent.empty')} className="my-12" />;
  }

  return (
    <div>
      <div className="border-border grid gap-8 border-y py-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <fieldset>
          <Eyebrow as="legend" className="mb-4">
            {t('scent.familyFilter')}
          </Eyebrow>
          <div className="flex flex-wrap gap-2">
            {families.map((value) => (
              <FilterChip
                key={value}
                group="family"
                active={family === value}
                onClick={() => setFamily(family === value ? null : value)}
              >
                {t(`family.${value}`)}
              </FilterChip>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-8 sm:grid-cols-[auto_auto] sm:justify-start lg:justify-end">
          <fieldset>
            <Eyebrow as="legend" className="mb-4">
              {t('scent.seasonFilter')}
            </Eyebrow>
            <div className="flex flex-wrap gap-2">
              {SEASONS.map((value) => (
                <FilterChip
                  key={value}
                  group="season"
                  active={season === value}
                  onClick={() => setSeason(season === value ? null : value)}
                >
                  <ScentGlyph name={value} className="size-4" />
                  {t(`season.${value}`)}
                </FilterChip>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <Eyebrow as="legend" className="mb-4">
              {t('scent.timeFilter')}
            </Eyebrow>
            <div className="flex flex-wrap gap-2">
              {TIMES_OF_DAY.map((value) => (
                <FilterChip
                  key={value}
                  group="time"
                  active={time === value}
                  onClick={() => setTime(time === value ? null : value)}
                >
                  <ScentGlyph name={value} className="size-4" />
                  {t(`timeOfDay.${value}`)}
                </FilterChip>
              ))}
            </div>
          </fieldset>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <SearchField
          label={t('scent.search')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('scent.search')}
          className="w-full max-w-md"
        />
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <p
            className="text-fg-muted tracking-caps text-xs whitespace-nowrap uppercase tabular-nums"
            aria-live="polite"
          >
            <CountLabel value={visible.length}>
              {t('scent.count', { count: visible.length })}
            </CountLabel>
          </p>
          {filtered && (
            <Button variant="subtle" size="sm" onClick={clear}>
              {t('scent.clear')}
            </Button>
          )}
          <ViewToggle view={view} onChange={setView} className="ml-auto" />
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          className="mt-12"
          title={t('scent.emptyFiltered')}
          action={
            <Button variant="outline" size="sm" onClick={clear}>
              {t('scent.clear')}
            </Button>
          }
        />
      ) : (
        <motion.ul
          layout={!reduced}
          className={`mt-12 ${productGridClass(view)}`}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {visible.map((entry, index) => (
              <motion.li
                key={entry.product.id}
                className="min-w-0"
                layout={!reduced}
                initial={reduced ? false : { opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{
                  duration: 0.7,
                  delay: Math.min(index, 8) * 0.04,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                {/* La entrada con el scroll va dentro: el <li> lo mueve motion. */}
                <div className="scroll-rise">
                  <ScentCard
                    entry={entry}
                    priority={index < 4}
                    compact={view === 'grid'}
                  />
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      )}
    </div>
  );
}
