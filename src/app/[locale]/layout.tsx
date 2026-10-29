import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { draftMode } from 'next/headers';
import { accountsEnabled } from '@/modules/account/server';
import { BRAND_NAME } from '@/modules/brand';
import { checkoutEnabled } from '@/modules/checkout/server';
import { routing } from '@/modules/i18n';
import { requireLocale } from '@/modules/i18n/server';
import { siteUrl } from '@/modules/i18n/seo';
import { indexingEnabled } from '@/modules/i18n/indexing';
import { LegalConsent } from '@/modules/legal';
import { NewsletterSection } from '@/modules/newsletter/server';
import { Footer, Header, PreviewBanner } from '@/modules/storefront';
import { activeVendors, TrackingTags } from '@/modules/tracking';
import { serverTrackingConfig } from '@/modules/tracking/server';
import { fontVariables } from '../fonts';
import '../globals.css';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });
  const index = indexingEnabled() && !(await draftMode()).isEnabled;
  return {
    metadataBase: siteUrl(),
    title: { default: t('title'), template: `%s · ${BRAND_NAME}` },
    description: t('description'),
    robots: { index, follow: index },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  requireLocale(locale);
  const [messages, t, draft] = await Promise.all([
    getMessages(),
    getTranslations('nav'),
    draftMode(),
  ]);
  // Analítica y publicidad (DECISIONS §178): solo los proveedores con ID, y
  // nada en la vista previa del personal.
  const tracking = serverTrackingConfig();
  return (
    <html lang={locale} className={fontVariables}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <a
            href="#contenido"
            className="bg-fg text-fg-inverse sr-only z-50 px-4 py-2 focus:not-sr-only focus:fixed focus:top-4 focus:left-4"
          >
            {t('skip')}
          </a>
          <Header cart={checkoutEnabled()} account={accountsEnabled()} />
          <div id="contenido">{children}</div>
          <NewsletterSection />
          <Footer />
          <LegalConsent vendors={activeVendors(tracking)} />
          <TrackingTags config={tracking} suppressed={draft.isEnabled} />
          {draft.isEnabled && <PreviewBanner />}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
