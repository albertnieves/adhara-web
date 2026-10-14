import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { accountsEnabled } from '@/modules/account/server';
import { AccountShell, RecoveryForm } from '@/modules/account/ui';
import { requireLocale } from '@/modules/i18n/server';

/** Pedir el enlace para elegir una contraseña nueva (C02). */
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
    namespace: 'account',
  });
  return { title: t('recover.title'), robots: { index: false, follow: false } };
}

export default async function RecoverPage({ params }: { params: Params }) {
  const { locale } = await params;
  const lang = requireLocale(locale);
  if (!accountsEnabled()) notFound();
  const t = await getTranslations('account');
  return (
    <AccountShell
      eyebrow={t('eyebrow')}
      title={t('recover.title')}
      lead={t('recover.lead')}
      narrow
    >
      <RecoveryForm locale={lang} />
    </AccountShell>
  );
}
