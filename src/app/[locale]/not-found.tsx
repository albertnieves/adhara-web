import { useTranslations } from 'next-intl';
import { Eyebrow, Heading } from '@/components/ui';
import { Star } from '@/modules/brand';
import { Link } from '@/modules/i18n';

export default function NotFound() {
  const t = useTranslations('notFound');
  return (
    <main className="flex min-h-[80svh] flex-col items-center justify-center px-5 pt-24 text-center">
      <Star className="text-accent size-4" />
      <Eyebrow className="mt-8">404</Eyebrow>
      <Heading level={1} size="h1" className="mt-4">
        {t('title')}
      </Heading>
      <Link
        href="/"
        className="link-underline tracking-caps-lg mt-10 text-xs uppercase"
      >
        {t('cta')}
      </Link>
    </main>
  );
}
