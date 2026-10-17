import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Badge, EmptyState, buttonClass } from '@/components/ui';
import { formatEuros } from '@/lib/money';
import { accountPath } from '@/modules/account';
import {
  getAccountProfile,
  listAccountOrders,
  requireCustomer,
} from '@/modules/account/server';
import {
  AccountNav,
  AccountShell,
  Notice,
  STATUS_TONE,
} from '@/modules/account/ui';
import { Link } from '@/modules/i18n';
import { requireLocale } from '@/modules/i18n/server';

/** Mis pedidos (PLAN_CUENTA_CLIENTE, C04): customer_orders, sin datos internos. */
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
  return { title: t('metaTitle'), robots: { index: false, follow: false } };
}

export default async function AccountPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const [{ locale }, search] = await Promise.all([params, searchParams]);
  const lang = requireLocale(locale);
  const session = await requireCustomer(lang, accountPath(lang, '/cuenta'));
  const [t, profile, orders] = await Promise.all([
    getTranslations('account'),
    getAccountProfile(session),
    listAccountOrders(session),
  ]);
  const date = new Intl.DateTimeFormat(lang, {
    dateStyle: 'medium',
    timeZone: 'Europe/Madrid',
  });
  const name = profile.fullName || profile.email;

  return (
    <AccountShell
      eyebrow={t('orders.greeting', { name })}
      title={t('orders.title')}
      nav={<AccountNav locale={lang} />}
    >
      {search.bienvenida === '1' && <Notice>{t('orders.welcome')}</Notice>}
      {search.contrasena === '1' && (
        <Notice>{t('orders.passwordChanged')}</Notice>
      )}
      {!profile.emailVerified && (
        <p className="text-fg-muted text-sm leading-relaxed">
          {t('orders.unverified')}
        </p>
      )}
      {orders === null ? (
        <p role="alert" className="text-danger text-sm">
          {t('orders.loadError')}
        </p>
      ) : orders.length === 0 ? (
        <EmptyState
          title={t('orders.empty')}
          description={t('orders.emptyLead')}
          action={
            <Link href="/catalogo" className={buttonClass('outline')}>
              {t('orders.browse')}
            </Link>
          }
        />
      ) : (
        <ul className="divide-border border-border divide-y border-y">
          {orders.map((order) => (
            <li key={order.number}>
              <Link
                href={{
                  pathname: '/cuenta/pedidos/[number]',
                  params: { number: String(order.number) },
                }}
                aria-label={t('orders.view', { number: order.number })}
                className="hover:bg-surface-raised grid grid-cols-[1fr_auto] gap-x-6 gap-y-2 px-1 py-5 transition-colors sm:px-4"
              >
                <span className="font-display text-xl">
                  {t('orders.number', { number: order.number })}
                </span>
                <span className="font-display text-right text-xl tabular-nums">
                  {formatEuros(order.totalCents, lang)}
                </span>
                <span className="text-fg-muted text-sm">
                  {date.format(new Date(order.createdAt))} ·{' '}
                  {t('orders.units', { count: order.units })} ·{' '}
                  {order.fulfillment === 'shipping'
                    ? t('orders.shipping')
                    : t('orders.pickup')}
                </span>
                <span className="text-right">
                  <Badge tone={STATUS_TONE[order.status]}>
                    {t(`status.${order.status}`)}
                  </Badge>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AccountShell>
  );
}
