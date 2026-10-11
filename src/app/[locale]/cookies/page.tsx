import type { Metadata } from 'next';
import { requireLocale } from '@/modules/i18n/server';
import { LegalPage, legalMetadata } from '@/modules/legal/server';

/** Política de cookies (texto en modules/legal/content). */
export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return legalMetadata('cookies', requireLocale(locale));
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <LegalPage doc="cookies" locale={requireLocale(locale)} />;
}
