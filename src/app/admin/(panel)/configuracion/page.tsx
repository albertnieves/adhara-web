import { PageHeader } from '@/modules/admin';
import { getAdminContent } from '@/modules/content/server';
import { ContentEditor } from '@/modules/content/ContentEditor';
import { enterStorefrontPreview } from '@/modules/storefront/server/preview';
import { buttonClass } from '@/components/ui';
export default async function SettingsPage() {
  const doc = await getAdminContent('store', 'es');
  return (
    <main>
      <PageHeader eyebrow="Configuración" title="Datos de la tienda">
        <form action={enterStorefrontPreview}>
          <button className={buttonClass('outline', 'lg')}>
            Vista previa del borrador
          </button>
        </form>
      </PageHeader>
      <p className="mb-6 text-sm">
        Estos datos son públicos al publicarlos. Los campos vacíos se ocultan en
        la tienda.
      </p>
      <ContentEditor
        key={`${doc.revision}-${doc.published_revision}`}
        kind="store"
        locale="es"
        document={doc}
      />
    </main>
  );
}
