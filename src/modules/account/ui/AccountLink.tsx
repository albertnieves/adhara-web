'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/modules/i18n';

/**
 * Enlace de la cabecera a la cuenta (con CUSTOMER_ACCOUNTS). No lee la sesión:
 * la tienda sigue siendo estática y /cuenta lleva a «Entrar» si hace falta.
 * Solo desde md: en el móvil la cabecera no tiene sitio (con «Cistella» se
 * desbordaba a 390 px) y la cuenta está en el menú.
 */
export function AccountLink() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  return (
    <Link
      href="/cuenta"
      aria-current={pathname.startsWith('/cuenta') ? 'page' : undefined}
      className="link-underline text-2xs tracking-caps-lg hidden min-h-11 items-center uppercase md:inline-flex"
    >
      {t('account')}
    </Link>
  );
}
