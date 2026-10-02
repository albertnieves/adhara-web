'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useDeferredValue, useMemo, useState } from 'react';
import type { Audience, StorefrontProduct } from '@/modules/catalog';
import { AUDIENCES, lowestPrice } from '@/modules/catalog';
import { ProductCard } from './ProductCard';

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

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`border px-4 py-2 text-[0.6875rem] tracking-[0.18em] uppercase transition-colors duration-500 ${
        active
          ? 'border-ink bg-ink text-ivory'
          : 'border-line hover:border-ink text-ink'
      }`}
    >
      {children}
    </button>
  );
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
    return (
      <p className="text-smoke font-display mx-auto max-w-lg py-24 text-center text-2xl font-light">
        {t('empty')}
      </p>
    );
  }

  return (
    <div>
      <div className="border-line flex flex-col gap-6 border-y py-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Chip active={brand === null} onClick={() => setBrand(null)}>
            {t('allBrands')}
          </Chip>
          {brands.map(([slug, name]) => (
            <Chip
              key={slug}
              active={brand === slug}
              onClick={() => setBrand(brand === slug ? null : slug)}
            >
              {name}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {audiences.map((value) => (
            <Chip
              key={value}
              active={audience === value}
              onClick={() => setAudience(audience === value ? null : value)}
            >
              {tAudience(value)}
            </Chip>
          ))}
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <label className="block w-full max-w-sm">
          <span className="sr-only">{t('search')}</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('search')}
            className="field placeholder:text-fg-muted"
          />
        </label>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <p className="text-smoke text-xs tracking-[0.2em] whitespace-nowrap uppercase tabular-nums">
            {t('count', { count: visible.length })}
          </p>
          <label className="flex items-center gap-3">
            <span className="eyebrow">{t('sort')}</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as Sort)}
              className="border-line border-b bg-transparent py-1 text-sm focus:outline-none"
            >
              {SORTS.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.label)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="py-24 text-center">
          <p className="font-display text-smoke text-2xl font-light">
            {t('emptyFiltered')}
          </p>
          {filtered && (
            <button
              type="button"
              className="link-underline mt-6 text-xs tracking-[0.2em] uppercase"
              onClick={() => {
                setQuery('');
                setBrand(null);
                setAudience(null);
              }}
            >
              {t('clear')}
            </button>
          )}
        </div>
      ) : (
        <motion.ul
          layout={!reduced}
          className="mt-12 grid gap-x-6 gap-y-16 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
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
                <ProductCard product={product} priority={index < 4} />
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      )}
    </div>
  );
}
