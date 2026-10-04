import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { draftMode } from 'next/headers';
import { BRAND_NAME } from '@/modules/brand';
import { routing } from '@/modules/i18n';
import { requireLocale } from '@/modules/i18n/server';
import { siteUrl } from '@/modules/i18n/seo';
import { Footer, Header, PreviewBanner } from '@/modules/storefront';
import { fontVariables } from '../fonts';
import '../globals.css';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });
  return {
    metadataBase: siteUrl(),
    title: { default: t('title'), template: `%s · ${BRAND_NAME}` },
    description: t('description'),
    robots: { index: false, follow: false },
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
          <Header />
          <div id="contenido">{children}</div>
          <Footer />
          {draft.isEnabled && <PreviewBanner />}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
