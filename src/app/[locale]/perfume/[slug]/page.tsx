import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { variantLabel } from '@/modules/catalog';
import {
  getAvailability,
  getStorefrontProduct,
  listStorefrontProducts,
} from '@/modules/catalog/server';
import { Link } from '@/modules/i18n';
import { alternatesMetadata } from '@/modules/i18n/metadata';
import { findSceneSlug } from '@/modules/unboxing';
import {
  ProductCard,
  ProductStage,
  PurchasePanel,
  Reveal,
} from '@/modules/storefront';

export const revalidate = 300;

/** Las fichas se generan en la primera visita y se revalidan (ISR). */
export function generateStaticParams() {
  return [];
}

type Params = Promise<{ locale: string; slug: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const product = await getStorefrontProduct(slug, locale);
  if (!product) return {};
  // El español es la base (nombre, marca, precio); ca y en cuentan como
  // publicados cuando tienen texto propio.
  return {
    title: `${product.name} · ${product.brand.name}`,
    description: product.tagline ?? undefined,
    ...alternatesMetadata(
      { pathname: '/perfume/[slug]', params: { slug } },
      locale,
      ['es', ...product.translatedLocales],
    ),
  };
}

export default async function ProductPage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const product = await getStorefrontProduct(slug, locale);
  if (!product) notFound();

  const [t, availability, all] = await Promise.all([
    getTranslations(),
    getAvailability([product.id]),
    listStorefrontProducts(locale),
  ]);
  const related = all
    .filter((p) => p.brand.slug === product.brand.slug && p.id !== product.id)
    .slice(0, 4);
  const sizes = product.variants.map(variantLabel).filter((s) => s !== '—');

  return (
    <main className="pt-18">
      <div className="grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="lg:sticky lg:top-18 lg:self-start">
          <ProductStage
            scene={findSceneSlug(product.unboxingScene)}
            media={product.media}
            name={product.name}
            brand={product.brand.name}
          />
        </div>

        <div className="px-5 py-14 sm:px-10 lg:px-16 lg:py-24">
          <Reveal>
            <Link
              href="/catalogo"
              className="link-underline text-smoke text-2xs tracking-caps-lg uppercase"
            >
              ← {t('product.back')}
            </Link>
            <p className="eyebrow mt-12">{product.brand.name}</p>
            <h1 className="mt-3 text-6xl leading-[0.95] font-light sm:text-7xl">
              {product.name}
            </h1>
            {product.concentration && (
              <p className="text-smoke font-display mt-4 text-xl italic">
                {t(`concentration.${product.concentration}`)}
              </p>
            )}
            {product.tagline && (
              <p className="text-smoke mt-6 max-w-md leading-relaxed">
                {product.tagline}
              </p>
            )}
          </Reveal>

          <Reveal delay={0.1} className="border-line mt-12 border-t pt-10">
            <PurchasePanel
              variants={product.variants}
              availability={availability}
            />
          </Reveal>

          {product.description && (
            <Reveal delay={0.15} className="border-line mt-12 border-t pt-10">
              <h2 className="eyebrow mb-4">{t('product.description')}</h2>
              <p className="leading-relaxed whitespace-pre-line">
                {product.description}
              </p>
            </Reveal>
          )}

          <Reveal delay={0.2} className="border-line mt-12 border-t pt-10">
            <h2 className="eyebrow mb-6">{t('product.details')}</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-10 gap-y-4 text-sm">
              <dt className="text-smoke">{t('product.brand')}</dt>
              <dd>{product.brand.name}</dd>
              {product.concentration && (
                <>
                  <dt className="text-smoke">{t('product.concentration')}</dt>
                  <dd>{t(`concentration.${product.concentration}`)}</dd>
                </>
              )}
              {sizes.length > 0 && (
                <>
                  <dt className="text-smoke">{t('product.size')}</dt>
                  <dd>{sizes.join(' · ')}</dd>
                </>
              )}
            </dl>
          </Reveal>
        </div>
      </div>

      {related.length > 0 && (
        <section className="border-line mx-auto max-w-[90rem] border-t px-5 py-28 sm:px-10">
          <Reveal>
            <h2 className="mb-14 text-4xl font-light sm:text-5xl">
              {t('product.related', { brand: product.brand.name })}
            </h2>
          </Reveal>
          <ul className="grid gap-x-6 gap-y-16 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((item, index) => (
              <Reveal
                as="li"
                key={item.id}
                delay={index * 0.1}
                className="min-w-0"
              >
                <ProductCard product={item} />
              </Reveal>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
