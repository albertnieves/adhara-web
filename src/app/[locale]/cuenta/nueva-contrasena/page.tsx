import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound, redirect } from 'next/navigation';
import {
  accountsEnabled,
  getCustomerSession,
  isStaffAccount,
} from '@/modules/account/server';
import { AccountShell, NewPasswordForm } from '@/modules/account/ui';
import { Link } from '@/modules/i18n';
import { requireLocale } from '@/modules/i18n/server';

/**
 * Elegir contraseña: tras el enlace de recuperación (que ya inició la sesión)
 * o desde «Mis datos». El personal la cambia en el panel, con el segundo factor.
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
    namespace: 'account',
  });
  return {
    title: t('newPassword.title'),
    robots: { index: false, follow: false },
  };
}

export default async function NewPasswordPage({ params }: { params: Params }) {
  const { locale } = await params;
  const lang = requireLocale(locale);
  if (!accountsEnabled()) notFound();
  const session = await getCustomerSession();
  if (session && (await isStaffAccount(session))) redirect('/admin/contrasena');
  const t = await getTranslations('account');
  return (
    <AccountShell eyebrow={t('eyebrow')} title={t('newPassword.title')} narrow>
      {session ? (
        <NewPasswordForm locale={lang} />
      ) : (
        <>
          <p role="alert" className="leading-relaxed">
            {t('newPassword.expired')}
          </p>
          <Link
            href="/cuenta/recuperar"
            className="link-underline font-semibold"
          >
            {t('newPassword.requestNew')}
          </Link>
        </>
      )}
    </AccountShell>
  );
}
