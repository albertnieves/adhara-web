import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound, redirect } from 'next/navigation';
import { accountPath, safeNextPath } from '@/modules/account';
import { accountsEnabled, getCustomerSession } from '@/modules/account/server';
import {
  AccountShell,
  GoogleSignIn,
  OrDivider,
  SignUpForm,
} from '@/modules/account/ui';
import { Link } from '@/modules/i18n';
import { requireLocale } from '@/modules/i18n/server';

/** Crear la cuenta con email y contraseña o con Google (C02 y C03). */
export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

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
  return {
    title: t('register.title'),
    robots: { index: false, follow: false },
  };
}

export default async function RegisterPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const [{ locale }, search] = await Promise.all([params, searchParams]);
  const lang = requireLocale(locale);
  if (!accountsEnabled()) notFound();
  const next = safeNextPath(search.next);
  if (await getCustomerSession())
    redirect(next ?? accountPath(lang, '/cuenta'));
  const t = await getTranslations('account');

  return (
    <AccountShell
      eyebrow={t('eyebrow')}
      title={t('register.title')}
      lead={t('register.lead')}
      narrow
    >
      <GoogleSignIn locale={lang} next={next} />
      <OrDivider />
      <SignUpForm locale={lang} next={next} />
      <p className="border-border border-t pt-6 text-sm">
        {t('register.haveAccount')}{' '}
        <Link
          href={{
            pathname: '/cuenta/acceso',
            query: next ? { next } : undefined,
          }}
          className="link-underline font-semibold"
        >
          {t('register.signIn')}
        </Link>
      </p>
    </AccountShell>
  );
}
