'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useDeferredValue, useMemo, useState } from 'react';
import {
  Button,
  EmptyState,
  Eyebrow,
  SearchField,
  Select,
} from '@/components/ui';
import type { Audience, StorefrontProduct } from '@/modules/catalog';
import { AUDIENCES, lowestPrice } from '@/modules/catalog';
import { CountLabel } from './CountLabel';
import { FilterChip } from './FilterChip';
import { ProductCard } from './ProductCard';
import { ViewToggle } from './ViewToggle';
import { productGridClass, useCatalogView } from './catalogView';

type Sort = 'featured' | 'priceAsc' | 'priceDesc' | 'name';

const SORTS: { value: Sort; label: string }[] = [
  { value: 'featured', label: 'sortFeatured' },
  { value: 'priceAsc', label: 'sortPriceAsc' },
  { value: 'priceDesc', label: 'sortPriceDesc' },
  { value: 'name', label: 'sortName' },
];

/** Sin tildes ni mayúsculas, para buscar «yara» o «LATTAFA» por igual. */
function normalize(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function compare(sort: Sort) {
  return (a: StorefrontProduct, b: StorefrontProduct) => {
    if (sort === 'name') return a.name.localeCompare(b.name, 'es');
    if (sort === 'featured') return 0;
    // Sin precio, al final en ambos sentidos.
    const pa = lowestPrice(a);
    const pb = lowestPrice(b);
    if (pa === null) return pb === null ? 0 : 1;
    if (pb === null) return -1;
    return sort === 'priceAsc' ? pa - pb : pb - pa;
  };
}

export function CatalogBrowser({
  products,
}: {
  products: StorefrontProduct[];
}) {
  const t = useTranslations('catalog');
  const tAudience = useTranslations('audience');
  const reduced = useReducedMotion();
  const [query, setQuery] = useState('');
  const [brand, setBrand] = useState<string | null>(null);
  const [audience, setAudience] = useState<Audience | null>(null);
  const [sort, setSort] = useState<Sort>('featured');
  const [view, setView] = useCatalogView();
  const deferredQuery = useDeferredValue(query);

  const brands = useMemo(() => {
    const map = new Map(products.map((p) => [p.brand.slug, p.brand.name]));
    return [...map].sort((a, b) => a[1].localeCompare(b[1], 'es'));
  }, [products]);
  const audiences = AUDIENCES.filter((value) =>
    products.some((p) => p.audience === value),
  );

  const visible = useMemo(() => {
    const needle = normalize(deferredQuery.trim());
    return products
      .filter((p) => !brand || p.brand.slug === brand)
      .filter((p) => !audience || p.audience === audience)
      .filter(
        (p) =>
          !needle || normalize(`${p.name} ${p.brand.name}`).includes(needle),
      )
      .sort(compare(sort));
  }, [products, brand, audience, deferredQuery, sort]);

  const filtered = Boolean(query || brand || audience);

  if (products.length === 0) {
    return <EmptyState title={t('empty')} className="my-12" />;
  }

  return (
    <div>
      <div className="border-border flex flex-col gap-6 border-y py-6 lg:flex-row lg:items-center lg:justify-between">
        {/*
         * En el móvil, las casas en un desplegable: con más de una docena de
         * casas, los botones ocupaban media pantalla (roadmap 5, §181).
         */}
        <label className="flex items-center gap-3 sm:hidden">
          <Eyebrow as="span">{t('brand')}</Eyebrow>
          <Select
            value={brand ?? ''}
            onChange={(event) => setBrand(event.target.value || null)}
            className="min-w-0 flex-1"
          >
            <option value="">{t('allBrands')}</option>
            {brands.map(([slug, name]) => (
              <option key={slug} value={slug}>
                {name}
              </option>
            ))}
          </Select>
        </label>
        <div className="hidden flex-wrap items-center gap-2 sm:flex">
          <FilterChip
            group="brand"
            active={brand === null}
            onClick={() => setBrand(null)}
          >
            {t('allBrands')}
          </FilterChip>
          {brands.map(([slug, name]) => (
            <FilterChip
              key={slug}
              group="brand"
              active={brand === slug}
              onClick={() => setBrand(brand === slug ? null : slug)}
            >
              {name}
            </FilterChip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {audiences.map((value) => (
            <FilterChip
              key={value}
              group="audience"
              active={audience === value}
              onClick={() => setAudience(audience === value ? null : value)}
            >
              {tAudience(value)}
            </FilterChip>
          ))}
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <SearchField
          label={t('search')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('search')}
          className="w-full max-w-sm"
        />
        {/* En el móvil: recuento y vista en una línea, orden debajo. */}
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 sm:justify-start">
          <p className="text-fg-muted tracking-caps text-xs whitespace-nowrap uppercase tabular-nums">
            <CountLabel value={visible.length}>
              {t('count', { count: visible.length })}
            </CountLabel>
          </p>
          <ViewToggle view={view} onChange={setView} />
          <label className="flex basis-full items-center gap-3 sm:basis-auto">
            <Eyebrow as="span">{t('sort')}</Eyebrow>
            <Select
              value={sort}
              onChange={(event) => setSort(event.target.value as Sort)}
              className="w-60"
            >
              {SORTS.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.label)}
                </option>
              ))}
            </Select>
          </label>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          className="mt-12"
          title={t('emptyFiltered')}
          action={
            filtered && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setQuery('');
                  setBrand(null);
                  setAudience(null);
                }}
              >
                {t('clear')}
              </Button>
            )
          }
        />
      ) : (
        <motion.ul
          layout={!reduced}
          className={`mt-12 ${productGridClass(view)}`}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {visible.map((product, index) => (
              <motion.li
                key={product.id}
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
                  <ProductCard
                    product={product}
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
