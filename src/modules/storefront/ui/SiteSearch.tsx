'use client';

import { useTranslations } from 'next-intl';
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  EmptyState,
  Eyebrow,
  Heading,
  SearchField,
  buttonClass,
} from '@/components/ui';
import type { ScentFamily, SearchDocument } from '@/modules/catalog';
import {
  SCENT_FAMILIES,
  SCENT_FAMILY_NAMES,
  searchCatalog,
  searchTerms,
} from '@/modules/catalog';
import { Link } from '@/modules/i18n';
import { ProductCard } from './ProductCard';
import { ViewToggle } from './ViewToggle';
import { productGridClass, useCatalogView } from './catalogView';

/** `?q=`: la búsqueda se puede compartir y sobrevive a volver atrás. */
function subscribeUrl(listener: () => void) {
  window.addEventListener('popstate', listener);
  return () => window.removeEventListener('popstate', listener);
}
const readQuery = () =>
  new URLSearchParams(window.location.search).get('q') ?? '';

function writeQuery(value: string) {
  const url = new URL(window.location.href);
  if (value.trim()) url.searchParams.set('q', value);
  else url.searchParams.delete('q');
  window.history.replaceState(window.history.state, '', url);
}

/**
 * Búsqueda de la tienda (roadmap 5, DECISIONS §181): busca mientras se
 * escribe en los perfumes publicados por nombre, casa, familia o nota, y
 * enseña también las casas y familias que coinciden. Sin resultados, o sin
 * nada escrito, propone familias y casas para seguir.
 */
export function SiteSearch({ documents }: { documents: SearchDocument[] }) {
  const t = useTranslations();
  const urlQuery = useSyncExternalStore(subscribeUrl, readQuery, () => '');
  const [typed, setTyped] = useState<string | null>(null);
  const query = typed ?? urlQuery;
  const deferred = useDeferredValue(query);
  const [view, setView] = useCatalogView();
  const input = useRef<HTMLInputElement>(null);

  // En el ordenador, el cursor espera en la caja; en el móvil no se abre el
  // teclado solo (se llega con la búsqueda ya escrita desde el menú).
  useEffect(() => {
    if (!readQuery() && window.matchMedia('(pointer: fine)').matches)
      input.current?.focus();
  }, []);

  const labels = useMemo(
    () =>
      Object.fromEntries(
        SCENT_FAMILIES.map((family) => [
          family,
          [t(`family.${family}`), SCENT_FAMILY_NAMES[family]],
        ]),
      ) as Record<ScentFamily, string[]>,
    [t],
  );
  const result = useMemo(
    () => searchCatalog(documents, deferred, labels),
    [documents, deferred, labels],
  );
  const searching = searchTerms(deferred).length > 0;

  // Para empezar: las familias con perfumes y las casas, de más a menos.
  const suggestions = useMemo(() => {
    const families = SCENT_FAMILIES.filter((family) =>
      documents.some((doc) => doc.profile?.families.includes(family)),
    );
    const brands = new Map<
      string,
      { slug: string; name: string; count: number }
    >();
    for (const { product } of documents) {
      const brand = brands.get(product.brand.slug);
      if (brand) brand.count += 1;
      else
        brands.set(product.brand.slug, {
          slug: product.brand.slug,
          name: product.brand.name,
          count: 1,
        });
    }
    return {
      families,
      brands: [...brands.values()]
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'es'))
        .slice(0, 8),
    };
  }, [documents]);

  const change = (value: string) => {
    setTyped(value);
    writeQuery(value);
  };

  return (
    <div>
      <form
        role="search"
        onSubmit={(event) => event.preventDefault()}
        className="border-border border-y py-6"
      >
        <SearchField
          ref={input}
          label={t('search.label')}
          placeholder={t('search.placeholder')}
          value={query}
          onChange={(event) => change(event.target.value)}
          enterKeyHint="search"
          autoComplete="off"
          className="w-full max-w-xl"
        />
      </form>

      <p
        role="status"
        className="text-fg-muted tracking-caps mt-6 min-h-5 text-xs uppercase tabular-nums"
      >
        {searching &&
          t('search.count', {
            count: result.products.length,
            query: deferred.trim(),
          })}
      </p>

      {!searching && (
        <Suggestions
          families={suggestions.families}
          brands={suggestions.brands}
          onFamily={(family) => change(t(`family.${family}`))}
        />
      )}

      {searching &&
        (result.brands.length > 0 || result.families.length > 0) && (
          <div className="mt-10 grid gap-10 sm:grid-cols-2">
            {result.brands.length > 0 && (
              <section aria-labelledby="buscar-casas">
                <Eyebrow as="h2" id="buscar-casas">
                  {t('search.houses')}
                </Eyebrow>
                <ul className="mt-4 space-y-1">
                  {result.brands.map((brand) => (
                    <li key={brand.slug}>
                      <Link
                        href={{
                          pathname: '/casas/[slug]',
                          params: { slug: brand.slug },
                        }}
                        className="link-underline font-display inline-flex min-h-11 items-center text-2xl"
                      >
                        {brand.name}
                        <span className="text-fg-muted ml-3 font-sans text-sm tabular-nums">
                          {t('catalog.count', { count: brand.count })}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {result.families.length > 0 && (
              <section aria-labelledby="buscar-familias">
                <Eyebrow as="h2" id="buscar-familias">
                  {t('search.families')}
                </Eyebrow>
                <ul className="mt-4 space-y-1">
                  {result.families.map(({ family, count }) => (
                    <li key={family}>
                      <Link
                        href={{
                          pathname: '/catalogo-olfativo',
                          query: { familia: family },
                        }}
                        className="link-underline font-display text-accent-fg inline-flex min-h-11 items-center text-2xl italic"
                      >
                        {t(`family.${family}`)}
                        <span className="text-fg-muted ml-3 font-sans text-sm not-italic tabular-nums">
                          {t('catalog.count', { count })}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}

      {searching && result.products.length > 0 && (
        <section aria-labelledby="buscar-perfumes" className="mt-14">
          <div className="flex items-center justify-between gap-6">
            <Heading level={2} size="h3" id="buscar-perfumes">
              {t('search.products')}
            </Heading>
            <ViewToggle view={view} onChange={setView} />
          </div>
          <ul className={`mt-8 ${productGridClass(view)}`}>
            {result.products.map((product, index) => (
              <li key={product.id} className="min-w-0">
                <ProductCard
                  product={product}
                  priority={index < 4}
                  compact={view === 'grid'}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {searching &&
        result.products.length === 0 &&
        result.brands.length === 0 &&
        result.families.length === 0 && (
          <>
            <EmptyState
              className="mt-10"
              title={t('search.none', { query: deferred.trim() })}
              description={t('search.noneHint')}
              action={
                <div className="flex flex-wrap justify-center gap-3">
                  <Link
                    href="/catalogo"
                    className={buttonClass('outline', 'sm')}
                  >
                    {t('search.toCollection')}
                  </Link>
                  <Link
                    href="/catalogo-olfativo"
                    className={buttonClass('outline', 'sm')}
                  >
                    {t('search.toScentCatalog')}
                  </Link>
                </div>
              }
            />
            <Suggestions
              families={suggestions.families}
              brands={suggestions.brands}
              onFamily={(family) => change(t(`family.${family}`))}
            />
          </>
        )}
    </div>
  );
}

/** Para empezar o seguir: familias (rellenan la búsqueda) y casas. */
function Suggestions({
  families,
  brands,
  onFamily,
}: {
  families: ScentFamily[];
  brands: { slug: string; name: string; count: number }[];
  onFamily: (family: ScentFamily) => void;
}) {
  const t = useTranslations();
  if (families.length === 0 && brands.length === 0) return null;
  return (
    <div className="mt-10 grid gap-10 lg:grid-cols-2">
      <Link
        href="/recorrido-olfativo"
        className={`${buttonClass('outline', 'md')} justify-self-start lg:col-span-2`}
      >
        {t('journey.cta')}
      </Link>
      {families.length > 0 && (
        <section aria-labelledby="sugerencias-familias">
          <Eyebrow as="h2" id="sugerencias-familias">
            {t('search.byFamily')}
          </Eyebrow>
          <ul className="mt-4 flex flex-wrap gap-2">
            {families.map((family) => (
              <li key={family}>
                <button
                  type="button"
                  onClick={() => onFamily(family)}
                  className={buttonClass('outline', 'md')}
                >
                  {t(`family.${family}`)}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {brands.length > 0 && (
        <section aria-labelledby="sugerencias-casas">
          <Eyebrow as="h2" id="sugerencias-casas">
            {t('search.byHouse')}
          </Eyebrow>
          <ul className="mt-4 flex flex-wrap gap-2">
            {brands.map((brand) => (
              <li key={brand.slug}>
                <Link
                  href={{
                    pathname: '/casas/[slug]',
                    params: { slug: brand.slug },
                  }}
                  className={buttonClass('outline', 'md')}
                >
                  {brand.name}
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/casas"
            className="link-underline text-2xs tracking-caps-lg mt-6 inline-flex min-h-11 items-center uppercase"
          >
            {t('home.brandsCta')}
          </Link>
        </section>
      )}
    </div>
  );
}
