import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader, StatusBadge } from '@/modules/admin';
import { isAllowed } from '@/modules/auth';
import { requirePermission } from '@/modules/auth/server';
import { updateProduct } from '@/modules/catalog/server/actions';
import {
  getAdminProduct,
  getVariantCosts,
  listBrands,
} from '@/modules/catalog/server/admin';
import {
  DeleteProductButton,
  MediaManager,
  ProductForm,
  StatusActions,
  TranslationEditor,
  VariantEditor,
} from '@/modules/catalog/ui';

export const metadata: Metadata = { title: 'Editar perfume' };

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-line grid gap-8 border-t py-12 xl:grid-cols-[16rem_1fr]">
      <div>
        <h2 className="text-2xl font-light">{title}</h2>
        {description && (
          <p className="text-smoke mt-2 text-sm leading-relaxed">
            {description}
          </p>
        )}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export default async function EditProduct({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const staff = await requirePermission('catalog.edit');
  const [{ id }, { error }] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [product, brands] = await Promise.all([
    getAdminProduct(staff.supabase, id),
    listBrands(staff.supabase),
  ]);
  if (!product) notFound();
  const can = (p: Parameters<typeof isAllowed>[1]) =>
    isAllowed({ role: staff.role, aal: 'aal2' }, p);
  // Los costes solo se piden (y viajan al navegador) con pricing.view_cost.
  const canViewCost = can('pricing.view_cost');
  const costs = canViewCost
    ? Object.fromEntries(
        await getVariantCosts(
          staff.supabase,
          product.variants.map((v) => v.id),
        ),
      )
    : {};

  return (
    <main>
      <Link
        href="/admin/catalogo"
        className="link-underline text-smoke text-xs tracking-[0.16em] uppercase"
      >
        ← Catálogo
      </Link>
      <div className="mt-6">
        <PageHeader eyebrow={product.brand.name} title={product.name}>
          <StatusActions
            id={product.id}
            status={product.status}
            canPublish={can('catalog.publish')}
          />
        </PageHeader>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
        <StatusBadge status={product.status} />
        <Link
          href={`/admin/catalogo/${product.id}/vista-previa`}
          className="link-underline"
        >
          Vista previa de la ficha
        </Link>
        <Link
          href={`/admin/catalogo/etiquetas?producto=${product.id}`}
          className="link-underline"
        >
          Etiquetas de precio
        </Link>
        {product.status === 'published' && (
          <Link
            href={`/es/perfume/${product.slug}`}
            target="_blank"
            className="link-underline"
          >
            Ver en la tienda ↗
          </Link>
        )}
        <span className="text-mist">/{product.slug}</span>
      </div>
      {error === 'borrar' && (
        <p role="alert" className="text-danger mb-4 text-sm">
          No se pudo eliminar: tiene movimientos de stock u otros datos
          asociados. Archívalo en su lugar.
        </p>
      )}

      <Section
        title="Formatos y PVP"
        description={`El PVP incluye IVA. Para publicar hace falta al menos un formato activo con precio. Los cambios quedan en el historial (Ómnibus).${canViewCost ? ' El coste es neto (sin IVA) e interno; el margen se calcula sobre el PVP sin IVA.' : ''}`}
      >
        <VariantEditor
          productId={product.id}
          canEditPrice={can('pricing.edit_retail')}
          variants={product.variants}
          costs={costs}
          canViewCost={canViewCost}
          canEditCost={can('pricing.edit_cost')}
        />
      </Section>

      <Section title="Datos" description="Nombre, marca y clasificación.">
        <ProductForm
          action={updateProduct}
          brands={brands}
          submitLabel="Guardar cambios"
          values={{
            id: product.id,
            name: product.name,
            brandId: product.brand.id,
            concentration: product.concentration,
            audience: product.audience,
            unboxingScene: product.unboxing_scene,
            sourceRef: product.source_ref,
            featured: product.featured,
            position: product.position,
          }}
        />
      </Section>

      <Section
        title="Imágenes"
        description="Cada imagen guarda su procedencia. Las que no son fotos propias se marcan como provisionales."
      >
        <MediaManager
          productId={product.id}
          media={product.media}
          canEdit={can('media.edit')}
        />
      </Section>

      <Section
        title="Textos"
        description="Frase corta y descripción en cada idioma. Si falta un idioma, la ficha no muestra texto."
      >
        <TranslationEditor
          productId={product.id}
          translations={product.translations}
        />
      </Section>

      {product.status === 'draft' && (
        <Section title="Eliminar">
          <DeleteProductButton id={product.id} />
        </Section>
      )}
    </main>
  );
}
