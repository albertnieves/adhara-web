import Link from 'next/link';
import { PageHeader } from '@/modules/admin';
import { contentLocale } from '@/modules/content/domain';
import { getAdminContent } from '@/modules/content/server';
import { ContentEditor } from '@/modules/content/ContentEditor';
import { enterStorefrontPreview } from '@/modules/storefront/server/preview';
import { buttonClass } from '@/components/ui';
export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<{ idioma?: string }>;
}) {
  const locale = contentLocale.catch('es').parse((await searchParams).idioma);
  const doc = await getAdminContent('home', locale);
  return (
    <main>
      <PageHeader eyebrow="Contenido" title="Portada de la tienda">
        <form action={enterStorefrontPreview}>
          <input type="hidden" name="path" value={`/${locale}`} />
          <button className={buttonClass('outline', 'lg')}>
            Vista previa del borrador
          </button>
        </form>
      </PageHeader>
      <nav aria-label="Idioma del contenido" className="mb-6 flex gap-5">
        {['es', 'ca', 'en'].map((code) => (
          <Link
            key={code}
            href={`/admin/contenido?idioma=${code}`}
            aria-current={locale === code ? 'page' : undefined}
            className="link-underline uppercase"
          >
            {code}
          </Link>
        ))}
      </nav>
      <ContentEditor
        key={`${locale}-${doc.revision}-${doc.published_revision}`}
        kind="home"
        locale={locale}
        document={doc}
      />
    </main>
  );
}
