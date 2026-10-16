import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Eyebrow, Heading } from '@/components/ui';
import { STORE_DEFAULTS, storeContent } from '@/modules/content';
import { readStoreContent } from '@/modules/content/server';
import { alternatesMetadata } from '@/modules/i18n/metadata';
import { requireLocale } from '@/modules/i18n/server';
import { contactEnabled } from '@/modules/messaging/server';
import { ContactForm } from '@/modules/messaging/ui';

/**
 * Contacto (A6.1): la consulta llega al panel (Web → Mensajes) y la
 * respuesta sale por email. 404 mientras CONTACT_FORM no esté encendido.
 */
export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: requireLocale(locale),
    namespace: 'contact',
  });
  return {
    title: t('title'),
    description: t('description'),
    ...alternatesMetadata('/contacto', locale),
  };
}

export default async function ContactPage({ params }: { params: Params }) {
  const { locale } = await params;
  const lang = requireLocale(locale);
  if (!contactEnabled()) notFound();
  const [t, storeData] = await Promise.all([
    getTranslations('contact'),
    readStoreContent('store', 'es'),
  ]);
  const store = storeData
    ? storeContent.parse(storeData.payload)
    : STORE_DEFAULTS;

  return (
    <main className="mx-auto max-w-[90rem] px-5 pt-32 pb-20 sm:px-10">
      <Heading level={1} size="h1" className="mb-6">
        {t('title')}
      </Heading>
      <p className="text-fg-muted mb-12 max-w-2xl leading-relaxed">
        {t('lead')}
      </p>
      <div className="grid gap-16 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <ContactForm locale={lang} />
        <aside className="space-y-4 text-sm">
          <Eyebrow as="h2">{t('store')}</Eyebrow>
          <address className="text-fg-muted space-y-3 not-italic">
            <p>
              {store.address}
              <br />
              {store.city}
            </p>
            {store.phone && (
              <p>
                <a
                  href={`tel:${store.phone.replace(/[^+\d]/g, '')}`}
                  className="link-underline"
                >
                  {store.phone}
                </a>
              </p>
            )}
            {store.hours && (
              <p className="whitespace-pre-line">{store.hours}</p>
            )}
          </address>
        </aside>
      </div>
    </main>
  );
}
