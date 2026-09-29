import Image from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Star } from '@/modules/brand';
import { heroMedia } from '@/modules/catalog';
import { listPublishedProducts } from '@/modules/catalog/server';
import { Link } from '@/modules/i18n';
import { BrandMarquee, Hero, ProductCard, Reveal } from '@/modules/storefront';

/** La tienda se regenera cada 5 minutos o al publicar desde el panel. */
export const revalidate = 300;

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, products] = await Promise.all([
    getTranslations('home'),
    listPublishedProducts(locale),
  ]);
  const featured = (
    products.some((p) => p.featured)
      ? products.filter((p) => p.featured)
      : products
  ).slice(0, 4);
  const brands = [...new Set(products.map((p) => p.brand.name))];
  const showcase = products.find((p) => p.unboxingScene);
  const showcaseImage = showcase ? heroMedia(showcase) : null;

  return (
    <main>
      <Hero
        eyebrow={t('heroEyebrow')}
        title={t('heroTitle')}
        lead={t('heroLead')}
        cta={t('heroCta')}
        scroll={t('scroll')}
      />

      <section className="mx-auto max-w-[90rem] px-5 py-28 sm:px-10 sm:py-36">
        <Reveal className="mb-16 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">{t('featuredEyebrow')}</p>
            <h2 className="mt-4 text-5xl font-light sm:text-6xl">
              {t('featuredTitle')}
            </h2>
          </div>
          <Link
            href="/catalogo"
            className="link-underline self-start text-[0.6875rem] tracking-[0.28em] uppercase sm:self-auto"
          >
            {t('featuredCta')}
          </Link>
        </Reveal>
        {featured.length === 0 ? (
          <Reveal>
            <p className="font-display text-smoke max-w-lg text-2xl font-light">
              {t('featuredEmpty')}
            </p>
          </Reveal>
        ) : (
          <ul className="grid gap-x-6 gap-y-16 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((product, index) => (
              <Reveal as="li" key={product.id} delay={index * 0.12}>
                <ProductCard product={product} />
              </Reveal>
            ))}
          </ul>
        )}
      </section>

      <section
        id="experiencia"
        className="bg-sand grain relative scroll-mt-18 overflow-hidden"
      >
        <div className="mx-auto grid max-w-[90rem] items-center gap-16 px-5 py-28 sm:px-10 sm:py-36 lg:grid-cols-2">
          <Reveal className="relative order-2 lg:order-1">
            <div className="bg-stage relative mx-auto aspect-square max-w-lg overflow-hidden">
              <div
                aria-hidden
                className="border-gold/30 absolute inset-10 rounded-full border"
              />
              <div
                aria-hidden
                className="border-gold/20 absolute inset-20 rounded-full border"
              />
              {showcaseImage ? (
                <div className="absolute inset-16">
                  <Image
                    src={showcaseImage.url}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 30vw, 70vw"
                    className="object-contain mix-blend-multiply"
                  />
                </div>
              ) : (
                <Star className="text-gold/40 absolute inset-0 m-auto size-24" />
              )}
            </div>
          </Reveal>
          <Reveal delay={0.15} className="order-1 max-w-xl lg:order-2">
            <p className="eyebrow">{t('experienceEyebrow')}</p>
            <h2 className="mt-4 text-5xl leading-[1.05] font-light sm:text-6xl">
              {t('experienceTitle')}
            </h2>
            <p className="text-smoke mt-8 text-lg leading-relaxed">
              {t('experienceBody')}
            </p>
            {showcase && (
              <Link
                href={{
                  pathname: '/perfume/[slug]',
                  params: { slug: showcase.slug },
                }}
                className="btn btn-primary mt-10"
              >
                {t('experienceCta', { name: showcase.name })}
              </Link>
            )}
          </Reveal>
        </div>
      </section>

      {brands.length > 0 && (
        <section className="py-24">
          <Reveal className="mb-10 px-5 text-center sm:px-10">
            <p className="eyebrow">{t('brandsEyebrow')}</p>
          </Reveal>
          <BrandMarquee brands={brands} />
        </section>
      )}

      <section className="bg-night text-ivory relative overflow-hidden">
        <Reveal className="mx-auto max-w-3xl px-5 py-32 text-center sm:px-10">
          <Star className="text-gold-soft mx-auto size-4" />
          <p className="eyebrow text-mist! mt-8">{t('storeEyebrow')}</p>
          <h2 className="mt-4 text-6xl font-light sm:text-7xl">
            {t('storeTitle')}
          </h2>
          <p className="text-ivory/70 mx-auto mt-8 max-w-md text-lg leading-relaxed">
            {t('storeBody')}
          </p>
        </Reveal>
      </section>
    </main>
  );
}
