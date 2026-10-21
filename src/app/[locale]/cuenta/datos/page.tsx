import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Eyebrow } from '@/components/ui';
import { accountPath } from '@/modules/account';
import {
  getAccountProfile,
  isStaffAccount,
  requireCustomer,
} from '@/modules/account/server';
import {
  AccountDetailsForm,
  AccountNav,
  AccountShell,
  DeleteAccountForm,
} from '@/modules/account/ui';
import { Link } from '@/modules/i18n';
import { requireLocale } from '@/modules/i18n/server';

/** Mis datos: contacto, dirección de envío, contraseña y borrar la cuenta (C04). */
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
  return {
    title: t('details.title'),
    robots: { index: false, follow: false },
  };
}

export default async function AccountDetailsPage({
  params,
}: {
  params: Params;
}) {
  const { locale } = await params;
  const lang = requireLocale(locale);
  const session = await requireCustomer(
    lang,
    accountPath(lang, '/cuenta/datos'),
  );
  const [t, profile, staff] = await Promise.all([
    getTranslations('account'),
    getAccountProfile(session),
    isStaffAccount(session),
  ]);
  const google = profile.providers.includes('google');
  const password = profile.providers.includes('email');
  const methods = [
    ...(password ? [t('details.methodPassword')] : []),
    ...(google ? [t('details.methodGoogle')] : []),
  ];
  const list = new Intl.ListFormat(lang, { type: 'disjunction' });

  return (
    <AccountShell
      eyebrow={t('eyebrow')}
      title={t('details.title')}
      nav={<AccountNav locale={lang} />}
    >
      <section className="space-y-3">
        <Eyebrow as="h2">{t('details.access')}</Eyebrow>
        <p className="font-semibold break-all">{profile.email}</p>
        {methods.length > 0 && (
          <p className="text-fg-muted text-sm">
            {t('details.methods', { methods: list.format(methods) })}
          </p>
        )}
        <p className="text-fg-muted text-sm">{t('details.emailNote')}</p>
        {!staff && (
          <Link
            href="/cuenta/nueva-contrasena"
            className="link-underline inline-flex min-h-11 items-center text-sm font-semibold"
          >
            {password ? t('details.changePassword') : t('details.setPassword')}
          </Link>
        )}
      </section>
      <AccountDetailsForm
        locale={lang}
        defaults={{
          fullName: profile.fullName,
          phone: profile.phone,
          address: profile.address,
        }}
      />
      {!staff && (
        <section className="border-border space-y-4 border-t pt-8">
          <Eyebrow as="h2">{t('delete.title')}</Eyebrow>
          <DeleteAccountForm locale={lang} />
        </section>
      )}
    </AccountShell>
  );
}
