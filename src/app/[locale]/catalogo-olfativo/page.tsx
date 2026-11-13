import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { buttonClass, Eyebrow, Heading } from '@/components/ui';
import { Star } from '@/modules/brand';
import {
  listScentProfiles,
  listStorefrontProducts,
} from '@/modules/catalog/server';
import { Link } from '@/modules/i18n';
import { alternatesMetadata } from '@/modules/i18n/metadata';
import { requireLocale } from '@/modules/i18n/server';
import { NewsletterSection } from '@/modules/newsletter/server';
import {
  Reveal,
  RisingWords,
  ScentCatalogBrowser,
  ScentTiers,
} from '@/modules/storefront';

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'scent' });
  return {
    title: t('eyebrow'),
    description: t('lead'),
    ...alternatesMetadata('/catalogo-olfativo', locale),
  };
}

/**
 * Catálogo olfativo: solo para descubrir y comparar, sin precio ni compra.
 * Notas, familias, estaciones y momento del día vienen de la fuente citada
 * en cada perfil (product_scent_profiles.source_url).
 */
export default async function ScentCatalog({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  requireLocale(locale);
  const [t, tJourney, products, profiles] = await Promise.all([
    getTranslations('scent'),
    getTranslations('journey'),
    listStorefrontProducts(locale),
    listScentProfiles(),
  ]);
  const entries = products.map((product) => ({
    product,
    profile: profiles[product.id] ?? null,
  }));
  return (
    <>
      <main>
        <section
          data-tone="oud"
          className="bg-surface text-fg grain relative overflow-hidden"
        >
          <div className="relative mx-auto grid max-w-[90rem] gap-x-12 gap-y-10 px-5 pt-40 pb-20 sm:px-10 sm:pt-48 sm:pb-28 xl:grid-cols-[minmax(0,1fr)_minmax(0,37rem)] xl:items-center">
            <div className="max-w-4xl">
              <Star className="text-accent-fg size-4" />
              <Eyebrow tone="accent" className="mt-8">
                {t('eyebrow')}
              </Eyebrow>
              <Heading level={1} size="display" className="mt-4">
                <RisingWords text={t('title')} delay={0.1} />
              </Heading>
              <Reveal delay={0.45}>
                <p className="text-fg-muted mt-8 max-w-2xl text-lg leading-relaxed">
                  {t('lead')}
                </p>
                <Link
                  href="/recorrido-olfativo"
                  className={buttonClass('outline', 'md', 'mt-8')}
                >
                  {tJourney('cta')}
                </Link>
              </Reveal>
            </div>
            <Reveal delay={0.3}>
              <ScentTiers
                tiers={(['top', 'heart', 'base'] as const).map((tier) => ({
                  key: tier,
                  label: t(tier),
                  hint: t(`${tier}Hint`),
                }))}
              />
            </Reveal>
          </div>
        </section>
        <div className="mx-auto max-w-[90rem] px-5 pt-16 pb-32 sm:px-10">
          <ScentCatalogBrowser entries={entries} />
          <p className="text-fg-muted mt-24 max-w-2xl text-xs leading-relaxed">
            {t('sourceNote')}
          </p>
        </div>
      </main>
      <NewsletterSection />
    </>
  );
}
