'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Eyebrow, Icon, SearchField } from '@/components/ui';
import { AccountLink } from '@/modules/account/ui';
import { Logo } from '@/modules/brand';
import { CartLink } from '@/modules/checkout/ui';
import { Link, routing, usePathname, useRouter } from '@/modules/i18n';

const EASE = [0.22, 1, 0.36, 1] as const;

type Pathname = ReturnType<typeof usePathname>;

/** Cambia de idioma conservando la página (y el perfume) en la que se está. */
function LanguageLinks({
  pathname,
  className,
  onNavigate,
}: {
  pathname: Pathname;
  className?: string;
  onNavigate?: () => void;
}) {
  const locale = useLocale();
  const params = useParams();
  return (
    <ul className={className}>
      {routing.locales.map((code) => (
        <li key={code}>
          <Link
            // Los parámetros (slug) son los de la ruta actual.
            href={{ pathname, params } as never}
            locale={code}
            onClick={onNavigate}
            aria-current={code === locale ? 'true' : undefined}
            className={`link-underline uppercase ${code === locale ? '' : 'opacity-55 hover:opacity-100'}`}
          >
            {code}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * `cart`: con el checkout encendido (WEB_CHECKOUT), enlace a la cesta.
 * `account`: con la cuenta de cliente (CUSTOMER_ACCOUNTS), enlace a la cuenta.
 */
export function Header({
  cart = false,
  account = false,
}: {
  cart?: boolean;
  account?: boolean;
}) {
  const t = useTranslations('nav');
  const tSearch = useTranslations('search');
  const pathname = usePathname();
  const router = useRouter();
  const reduced = useReducedMotion();
  const overlayPage = pathname === '/';
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 32);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    if (!open) return;
    // Esc cierra el menú móvil.
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const transparent = overlayPage && !scrolled && !open;

  return (
    <>
      <header
        // Sobre el vídeo de la portada, los semánticos del tono oscuro.
        data-tone={transparent ? 'dark' : undefined}
        className={`text-fg fixed inset-x-0 top-0 z-40 border-b transition-[background-color,color,border-color,backdrop-filter] duration-700 ease-(--ease-luxe) ${
          transparent
            ? 'border-transparent bg-transparent'
            : 'border-border bg-surface/85 backdrop-blur-md'
        }`}
      >
        <div className="mx-auto grid h-18 max-w-[90rem] grid-cols-[1fr_auto_1fr] items-center px-5 sm:px-10">
          <nav
            aria-label={t('menu')}
            className="flex items-center gap-6 lg:gap-8"
          >
            <button
              type="button"
              className="min-h-11 md:hidden"
              aria-expanded={open}
              aria-controls="mobile-menu"
              onClick={() => setOpen((value) => !value)}
            >
              <Eyebrow as="span" tone="inherit">
                {open ? t('close') : t('menu')}
              </Eyebrow>
            </button>
            <Link
              href="/catalogo"
              className="link-underline text-2xs tracking-caps-lg hidden uppercase md:inline"
              aria-current={pathname === '/catalogo' ? 'page' : undefined}
            >
              {t('collection')}
            </Link>
            <Link
              href="/catalogo-olfativo"
              className="link-underline text-2xs tracking-caps-lg hidden uppercase md:inline"
              aria-current={
                pathname.startsWith('/catalogo-olfativo') ? 'page' : undefined
              }
            >
              {t('scentCatalog')}
            </Link>
            {/* Desde 1024 px: a 768 px no cabía todo junto al logotipo. */}
            <Link
              href={{ pathname: '/', hash: 'experiencia' }}
              className="link-underline text-2xs tracking-caps-lg hidden uppercase lg:inline"
            >
              {t('experience')}
            </Link>
          </nav>

          <Link href="/" aria-label={t('home')} onClick={() => setOpen(false)}>
            <Logo />
          </Link>

          <div className="flex items-center justify-end gap-4 lg:gap-6">
            {/* En el móvil, la búsqueda está en el menú. */}
            <Link
              href="/buscar"
              aria-label={t('search')}
              aria-current={pathname === '/buscar' ? 'page' : undefined}
              className="hidden size-11 items-center justify-center md:inline-flex"
            >
              <Icon name="search" />
            </Link>
            <LanguageLinks
              pathname={pathname}
              className="text-2xs tracking-caps hidden items-center gap-4 md:flex"
            />
            {account && <AccountLink />}
            {cart && <CartLink />}
          </div>
        </div>
      </header>

      {/*
       * Fuera de <header>: su backdrop-filter convierte a la cabecera en el
       * bloque contenedor de los hijos fijos, y el menú quedaba encerrado en
       * sus 72 px, recortado y sin recibir los toques.
       */}
      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            key="menu"
            data-tone="dark"
            className="bg-surface text-fg fixed inset-0 top-18 z-30 flex flex-col justify-between px-6 pt-12 pb-10 md:hidden"
            initial={
              reduced ? { opacity: 0 } : { clipPath: 'inset(0 0 100% 0)' }
            }
            animate={reduced ? { opacity: 1 } : { clipPath: 'inset(0 0 0% 0)' }}
            exit={reduced ? { opacity: 0 } : { clipPath: 'inset(0 0 100% 0)' }}
            transition={{ duration: 0.7, ease: EASE }}
          >
            <form
              role="search"
              className="-mt-4 mb-8"
              onSubmit={(event) => {
                event.preventDefault();
                const q = new FormData(event.currentTarget).get('q');
                setOpen(false);
                router.push({
                  pathname: '/buscar',
                  ...(typeof q === 'string' && q.trim()
                    ? { query: { q: q.trim() } }
                    : {}),
                });
              }}
            >
              <SearchField
                name="q"
                label={tSearch('label')}
                placeholder={tSearch('placeholder')}
                enterKeyHint="search"
                autoComplete="off"
              />
            </form>
            <ul className="font-display space-y-4 text-5xl font-light">
              {[
                { href: '/' as const, label: t('home') },
                { href: '/catalogo' as const, label: t('collection') },
                {
                  href: '/catalogo-olfativo' as const,
                  label: t('scentCatalog'),
                },
                { href: '/casas' as const, label: t('houses') },
                ...(account
                  ? [{ href: '/cuenta' as const, label: t('accountLabel') }]
                  : []),
              ].map((item, index) => (
                <motion.li
                  key={item.href}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: 0.25 + index * 0.08,
                    duration: 0.8,
                    ease: EASE,
                  }}
                >
                  <Link href={item.href} onClick={() => setOpen(false)}>
                    {item.label}
                  </Link>
                </motion.li>
              ))}
            </ul>
            <div>
              <Eyebrow className="mb-4">{t('language')}</Eyebrow>
              <LanguageLinks
                pathname={pathname}
                onNavigate={() => setOpen(false)}
                className="tracking-caps flex gap-6 text-sm"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
