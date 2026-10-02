import NextLink from 'next/link';
import { readStoreContent } from '@/modules/content/server';
import { storeContent, STORE_DEFAULTS } from '@/modules/content';
import { getTranslations } from 'next-intl/server';
import { Logo } from '@/modules/brand';
import { Link } from '@/modules/i18n';

export async function Footer() {
  const data = await readStoreContent('store', 'es');
  const store = data ? storeContent.parse(data.payload) : STORE_DEFAULTS;
  const t = await getTranslations('footer');
  const nav = await getTranslations('nav');
  return (
    <footer
      data-tone="dark"
      className="bg-night text-ivory relative overflow-hidden"
    >
      <div className="mx-auto grid max-w-[90rem] gap-14 px-5 pt-24 pb-12 sm:px-10 md:grid-cols-[2fr_1fr_1fr]">
        <div className="space-y-6">
          <Logo variant="stacked" />
          <p className="text-fg-muted max-w-xs text-sm leading-relaxed">
            {t('tagline')}
          </p>
        </div>
        <div>
          <p className="eyebrow text-fg-muted! mb-5">{t('shop')}</p>
          <ul className="space-y-3 text-sm">
            <li>
              <Link href="/catalogo" className="link-underline">
                {nav('collection')}
              </Link>
            </li>
            <li>
              <Link
                href={{ pathname: '/', hash: 'experiencia' }}
                className="link-underline"
              >
                {nav('experience')}
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="eyebrow text-fg-muted! mb-5">{t('info')}</p>
          <address className="text-fg-muted space-y-3 text-sm not-italic">
            <p>
              {store.address}
              <br />
              {store.city}
            </p>
            {store.phone && (
              <p>
                <a href={`tel:${store.phone.replace(/[^+\d]/g, '')}`}>
                  {store.phone}
                </a>
              </p>
            )}
            {store.email && (
              <p>
                <a href={`mailto:${store.email}`}>{store.email}</a>
              </p>
            )}
            {store.hours && (
              <p className="whitespace-pre-line">{store.hours}</p>
            )}
            {store.instagram && (
              <p>
                <a href={store.instagram} rel="noopener noreferrer">
                  Instagram
                </a>
              </p>
            )}
            {store.facebook && (
              <p>
                <a href={store.facebook} rel="noopener noreferrer">
                  Facebook
                </a>
              </p>
            )}
          </address>
          <NextLink
            href="/admin/acceso"
            className="link-underline text-fg-muted mt-6 inline-block text-xs"
          >
            {t('staffAccess')}
          </NextLink>
        </div>
      </div>
      <div className="border-ivory/10 mx-auto flex max-w-[90rem] items-center justify-between border-t px-5 py-6 text-[0.6875rem] tracking-[0.2em] uppercase sm:px-10">
        <span className="text-fg-muted">
          {t('rights', { year: new Date().getFullYear() })}
        </span>
        <span className="text-gold-soft">Castelldefels</span>
      </div>
    </footer>
  );
}
