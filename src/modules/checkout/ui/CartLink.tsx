'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Link, usePathname } from '@/modules/i18n';
import { CART_COOKIE, CART_EVENT, cartCount, parseCart } from '../domain/cart';

/** Artículos de la cesta según la cookie (no hay nada que ocultar en ella). */
function readCount(): number {
  const prefix = `${CART_COOKIE}=`;
  const cookie = document.cookie
    .split('; ')
    .find((part) => part.startsWith(prefix));
  if (!cookie) return 0;
  try {
    return cartCount(
      parseCart(decodeURIComponent(cookie.slice(prefix.length))),
    );
  } catch {
    return 0;
  }
}

/** Enlace de la cabecera a la cesta con el número de artículos. */
export function CartLink({ className = '' }: { className?: string }) {
  const t = useTranslations('cart');
  const pathname = usePathname();
  const [count, setCount] = useState(0);

  useEffect(() => {
    const update = () => setCount(readCount());
    update();
    window.addEventListener(CART_EVENT, update);
    window.addEventListener('focus', update);
    return () => {
      window.removeEventListener(CART_EVENT, update);
      window.removeEventListener('focus', update);
    };
    // Al cambiar de página (p. ej., tras pedir), se vuelve a contar.
  }, [pathname]);

  return (
    <Link
      href="/cesta"
      aria-label={t('linkLabel', { count })}
      aria-current={pathname === '/cesta' ? 'page' : undefined}
      className={`link-underline text-2xs tracking-caps-lg inline-flex min-h-11 items-center gap-1.5 uppercase ${className}`}
    >
      {t('link')}
      {count > 0 && <span className="tabular-nums">· {count}</span>}
    </Link>
  );
}
