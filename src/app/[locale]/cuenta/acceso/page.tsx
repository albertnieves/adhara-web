import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound, redirect } from 'next/navigation';
import { accountPath, safeNextPath } from '@/modules/account';
import { accountsEnabled, getCustomerSession } from '@/modules/account/server';
import {
  AccountShell,
  GoogleSignIn,
  Notice,
  OrDivider,
  SignInForm,
} from '@/modules/account/ui';
import { Link } from '@/modules/i18n';
import { requireLocale } from '@/modules/i18n/server';

/** Entrar en la cuenta de cliente (PLAN_CUENTA_CLIENTE, C02 y C03). */
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
  return { title: t('signIn.title'), robots: { index: false, follow: false } };
}

const LINK_ERRORS = { enlace: 'link', google: 'google' } as const;

export default async function SignInPage({
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
  const error =
    search.error === 'enlace' || search.error === 'google'
      ? LINK_ERRORS[search.error]
      : null;

  return (
    <AccountShell
      eyebrow={t('eyebrow')}
      title={t('signIn.title')}
      lead={t('signIn.lead')}
      narrow
    >
      {search.borrada === '1' && <Notice>{t('signIn.deleted')}</Notice>}
      {error && (
        <p role="alert" className="text-danger text-sm leading-relaxed">
          {t(`errors.${error}`)}
        </p>
      )}
      <GoogleSignIn locale={lang} next={next} />
      <OrDivider />
      <SignInForm locale={lang} next={next} />
      <p className="border-border border-t pt-6 text-sm">
        {t('signIn.noAccount')}{' '}
        <Link
          href={{
            pathname: '/cuenta/registro',
            query: next ? { next } : undefined,
          }}
          className="link-underline font-semibold"
        >
          {t('signIn.register')}
        </Link>
      </p>
    </AccountShell>
  );
}
