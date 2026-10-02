'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Logo } from '@/modules/brand';
import { Link, routing, usePathname } from '@/modules/i18n';

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

export function Header() {
  const t = useTranslations('nav');
  const pathname = usePathname();
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
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const transparent = overlayPage && !scrolled && !open;

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-[background-color,color,border-color,backdrop-filter] duration-700 ease-(--ease-luxe) ${
        transparent
          ? 'text-ivory border-b border-transparent bg-transparent'
          : 'text-ink border-line bg-ivory/85 border-b backdrop-blur-md'
      }`}
    >
      <div className="mx-auto grid h-18 max-w-[90rem] grid-cols-[1fr_auto_1fr] items-center px-5 sm:px-10">
        <nav aria-label={t('menu')} className="flex items-center gap-8">
          <button
            type="button"
            className="eyebrow text-current! md:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? t('close') : t('menu')}
          </button>
          <Link
            href="/catalogo"
            className="link-underline text-2xs tracking-caps-lg hidden uppercase md:inline"
            aria-current={pathname === '/catalogo' ? 'page' : undefined}
          >
            {t('collection')}
          </Link>
          <Link
            href={{ pathname: '/', hash: 'experiencia' }}
            className="link-underline text-2xs tracking-caps-lg hidden uppercase md:inline"
          >
            {t('experience')}
          </Link>
        </nav>

        <Link href="/" aria-label={t('home')} onClick={() => setOpen(false)}>
          <Logo />
        </Link>

        <div className="flex justify-end">
          <LanguageLinks
            pathname={pathname}
            className="text-2xs tracking-caps hidden items-center gap-4 md:flex"
          />
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            key="menu"
            data-tone="dark"
            className="bg-night text-ivory fixed inset-0 top-18 z-30 flex flex-col justify-between px-6 pt-12 pb-10 md:hidden"
            initial={
              reduced ? { opacity: 0 } : { clipPath: 'inset(0 0 100% 0)' }
            }
            animate={reduced ? { opacity: 1 } : { clipPath: 'inset(0 0 0% 0)' }}
            exit={reduced ? { opacity: 0 } : { clipPath: 'inset(0 0 100% 0)' }}
            transition={{ duration: 0.7, ease: EASE }}
          >
            <ul className="font-display space-y-4 text-5xl font-light">
              {[
                { href: '/' as const, label: t('home') },
                { href: '/catalogo' as const, label: t('collection') },
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
              <p className="eyebrow text-fg-muted! mb-4">{t('language')}</p>
              <LanguageLinks
                pathname={pathname}
                onNavigate={() => setOpen(false)}
                className="tracking-caps flex gap-6 text-sm"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
