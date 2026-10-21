import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { EmptyState, Eyebrow, Heading, Text } from '@/components/ui';
import { groupByBrand, heroMedia } from '@/modules/catalog';
import { listStorefrontProducts } from '@/modules/catalog/server';
import { Link } from '@/modules/i18n';
import { alternatesMetadata } from '@/modules/i18n/metadata';
import { requireLocale } from '@/modules/i18n/server';
import { ProductImage, Reveal } from '@/modules/storefront';

export const revalidate = 300;

/** Fotos de muestra de cada casa (desde 768 px). */
const PREVIEW_COUNT = 3;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'houses' });
  return {
    title: t('title'),
    description: t('metaDescription'),
    ...alternatesMetadata('/casas', locale),
  };
}

/** Índice de casas: solo las que tienen algún perfume a la vista. */
export default async function Brands({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  requireLocale(locale);
  const [t, tCatalog, products] = await Promise.all([
    getTranslations('houses'),
    getTranslations('catalog'),
    listStorefrontProducts(locale),
  ]);
  const brands = groupByBrand(products);

  return (
    <main className="mx-auto max-w-[90rem] px-5 pt-36 pb-32 sm:px-10 sm:pt-44">
      <Reveal className="mb-14 max-w-3xl">
        <Eyebrow>{t('eyebrow')}</Eyebrow>
        <Heading level={1} size="display" className="mt-4">
          {t('title')}
        </Heading>
        <Text tone="muted" className="mt-6 leading-relaxed">
          {t('lead')}
        </Text>
      </Reveal>
      {brands.length === 0 ? (
        <EmptyState title={t('empty')} className="my-12" />
      ) : (
        <ul className="border-border border-t">
          {brands.map((brand, index) => (
            <Reveal
              as="li"
              key={brand.slug}
              delay={Math.min(index, 6) * 0.05}
              className="border-border border-b"
            >
              <Link
                href={{
                  pathname: '/casas/[slug]',
                  params: { slug: brand.slug },
                }}
                className="group flex items-center gap-6 py-8"
              >
                <Heading
                  level={2}
                  size="h2"
                  className="group-hover:text-accent-fg min-w-0 flex-1 transition-colors"
                >
                  {brand.name}
                </Heading>
                <span aria-hidden className="hidden gap-2 md:flex">
                  {brand.products
                    .flatMap((product) => {
                      const media = heroMedia(product);
                      return media ? [{ id: product.id, media }] : [];
                    })
                    .slice(0, PREVIEW_COUNT)
                    .map(({ id, media }) => (
                      <span
                        key={id}
                        className="bg-stage relative block size-16 overflow-hidden"
                      >
                        <span className="absolute inset-1.5 block">
                          <ProductImage
                            media={media}
                            alt=""
                            brand={brand.name}
                            sizes="64px"
                          />
                        </span>
                      </span>
                    ))}
                </span>
                <span className="text-fg-muted tracking-caps text-xs whitespace-nowrap uppercase tabular-nums">
                  {tCatalog('count', { count: brand.products.length })}
                </span>
              </Link>
            </Reveal>
          ))}
        </ul>
      )}
    </main>
  );
}
