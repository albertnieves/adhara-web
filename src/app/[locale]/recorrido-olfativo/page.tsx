import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Eyebrow, Heading } from '@/components/ui';
import { Star } from '@/modules/brand';
import {
  listScentProfiles,
  listStorefrontProducts,
} from '@/modules/catalog/server';
import { alternatesMetadata } from '@/modules/i18n/metadata';
import { requireLocale } from '@/modules/i18n/server';
import { Reveal, ScentJourney } from '@/modules/storefront';

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'journey' });
  return {
    title: t('eyebrow'),
    description: t('metaDescription'),
    ...alternatesMetadata('/recorrido-olfativo', locale),
  };
}

/**
 * Recorrido olfativo (roadmap 6, DECISIONS §182): propuestas según las
 * fichas olfativas con fuente, con reglas fijas y sin IA. La página es
 * estática; las respuestas se eligen en el navegador y quedan en la URL.
 */
export default async function ScentJourneyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  requireLocale(locale);
  const [t, products, profiles] = await Promise.all([
    getTranslations('journey'),
    listStorefrontProducts(locale),
    listScentProfiles(),
  ]);
  const documents = products.map((product) => ({
    product,
    profile: profiles[product.id] ?? null,
  }));
  return (
    <main className="mx-auto max-w-[90rem] px-5 pt-36 pb-32 sm:px-10 sm:pt-44">
      <Reveal className="mb-16 max-w-3xl">
        <Star className="text-accent size-4" />
        <Eyebrow tone="accent" className="mt-6">
          {t('eyebrow')}
        </Eyebrow>
        <Heading level={1} size="display" className="mt-4">
          {t('title')}
        </Heading>
        <p className="text-fg-muted mt-6 text-lg leading-relaxed">
          {t('lead')}
        </p>
      </Reveal>
      <ScentJourney documents={documents} />
    </main>
  );
}
