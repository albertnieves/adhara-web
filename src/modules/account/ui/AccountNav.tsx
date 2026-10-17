'use client';

import { useTranslations } from 'next-intl';
import { SubmitButton } from '@/components/ui';
import { Link, usePathname } from '@/modules/i18n';
import type { AccountLocale } from '../domain/paths';
import { signOutAction } from '../server/actions';

/** Menú de la cuenta: pedidos, datos y cerrar sesión. */
export function AccountNav({ locale }: { locale: AccountLocale }) {
  const t = useTranslations('account.nav');
  const pathname = usePathname();
  const item = (href: '/cuenta' | '/cuenta/datos', label: string) => {
    const current =
      href === '/cuenta'
        ? pathname === '/cuenta' || pathname.startsWith('/cuenta/pedidos')
        : pathname === href;
    return (
      <li>
        <Link
          href={href}
          aria-current={current ? 'page' : undefined}
          className={`link-underline text-2xs tracking-caps-lg inline-flex min-h-11 items-center uppercase ${current ? '' : 'text-fg-muted hover:text-fg'}`}
        >
          {label}
        </Link>
      </li>
    );
  };
  return (
    <nav
      aria-label={t('label')}
      className="border-border flex flex-wrap items-center justify-between gap-x-8 gap-y-2 border-b pb-2"
    >
      <ul className="flex flex-wrap gap-x-8">
        {item('/cuenta', t('orders'))}
        {item('/cuenta/datos', t('details'))}
      </ul>
      <form action={signOutAction}>
        <input type="hidden" name="locale" value={locale} />
        <SubmitButton variant="subtle" size="sm" pendingLabel={t('signOut')}>
          {t('signOut')}
        </SubmitButton>
      </form>
    </nav>
  );
}
