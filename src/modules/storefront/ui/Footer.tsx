import { getTranslations } from 'next-intl/server';
import { Logo } from '@/modules/brand';
import { Link } from '@/modules/i18n';

export async function Footer() {
  const t = await getTranslations('footer');
  const nav = await getTranslations('nav');
  return (
    <footer className="bg-night text-ivory relative overflow-hidden">
      <div className="mx-auto grid max-w-[90rem] gap-14 px-5 pt-24 pb-12 sm:px-10 md:grid-cols-[2fr_1fr_1fr]">
        <div className="space-y-6">
          <Logo variant="stacked" />
          <p className="text-mist max-w-xs text-sm leading-relaxed">
            {t('tagline')}
          </p>
        </div>
        <div>
          <p className="eyebrow text-mist! mb-5">{t('shop')}</p>
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
          <p className="eyebrow text-mist! mb-5">{t('info')}</p>
          <p className="text-mist text-sm leading-relaxed">{t('dev')}</p>
        </div>
      </div>
      <div className="border-ivory/10 mx-auto flex max-w-[90rem] items-center justify-between border-t px-5 py-6 text-[0.6875rem] tracking-[0.2em] uppercase sm:px-10">
        <span className="text-mist">
          {t('rights', { year: new Date().getFullYear() })}
        </span>
        <span className="text-gold-soft">Castelldefels</span>
      </div>
    </footer>
  );
}
