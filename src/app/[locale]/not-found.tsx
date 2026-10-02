import { useTranslations } from 'next-intl';
import { Star } from '@/modules/brand';
import { Link } from '@/modules/i18n';

export default function NotFound() {
  const t = useTranslations('notFound');
  return (
    <main className="flex min-h-[80svh] flex-col items-center justify-center px-5 pt-24 text-center">
      <Star className="text-gold size-4" />
      <p className="eyebrow mt-8">404</p>
      <h1 className="mt-4 text-5xl font-light sm:text-6xl">{t('title')}</h1>
      <Link
        href="/"
        className="link-underline tracking-caps-lg mt-10 text-xs uppercase"
      >
        {t('cta')}
      </Link>
    </main>
  );
}
