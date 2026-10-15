import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Eyebrow, Heading } from '@/components/ui';
import { groupByBrand } from '@/modules/catalog';
import { listStorefrontProducts } from '@/modules/catalog/server';
import { Link } from '@/modules/i18n';
import { alternatesMetadata } from '@/modules/i18n/metadata';
import { requireLocale } from '@/modules/i18n/server';
import { ProductCard, Reveal } from '@/modules/storefront';

export const revalidate = 300;

/** Las páginas de casa se generan en la primera visita y se revalidan (ISR). */
export function generateStaticParams() {
  return [];
}

type Params = Promise<{ locale: string; slug: string }>;

/*
 * La casa sale de la colección que ya lee la tienda (publicados o, en la
 * vista previa del personal, también borradores): sin perfumes a la vista,
 * no hay página.
 */
async function findBrand(slug: string, locale: string) {
  const products = await listStorefrontProducts(locale);
  return groupByBrand(products).find((brand) => brand.slug === slug) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  requireLocale(locale);
  const brand = await findBrand(slug, locale);
  if (!brand) return {};
  const t = await getTranslations({ locale, namespace: 'houses' });
  return {
    title: brand.name,
    description: t('brandMetaDescription', { brand: brand.name }),
    ...alternatesMetadata(
      { pathname: '/casas/[slug]', params: { slug } },
      locale,
    ),
  };
}

export default async function BrandPage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  requireLocale(locale);
  const brand = await findBrand(slug, locale);
  if (!brand) notFound();
  const [t, tCatalog] = await Promise.all([
    getTranslations('houses'),
    getTranslations('catalog'),
  ]);

  return (
    <main className="mx-auto max-w-[90rem] px-5 pt-36 pb-32 sm:px-10 sm:pt-44">
      <Reveal className="mb-14 max-w-3xl">
        <Link
          href="/casas"
          className="link-underline text-fg-muted text-2xs tracking-caps-lg uppercase"
        >
          ← {t('back')}
        </Link>
        <Eyebrow className="mt-12">{t('brandEyebrow')}</Eyebrow>
        <Heading level={1} size="display" className="mt-4">
          {brand.name}
        </Heading>
        <p className="text-fg-muted tracking-caps mt-6 text-xs uppercase tabular-nums">
          {tCatalog('count', { count: brand.products.length })}
        </p>
      </Reveal>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-10 sm:gap-x-6 sm:gap-y-16 lg:grid-cols-3 xl:grid-cols-4">
        {brand.products.map((product, index) => (
          <Reveal
            as="li"
            key={product.id}
            delay={Math.min(index, 4) * 0.08}
            className="min-w-0"
          >
            <ProductCard product={product} compact priority={index < 2} />
          </Reveal>
        ))}
      </ul>
    </main>
  );
}
