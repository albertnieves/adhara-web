import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader, PrintButton } from '@/modules/admin';
import { requirePermission } from '@/modules/auth/server';
import { listBrands, listPriceLabels } from '@/modules/catalog/server/admin';
import { PriceLabelCard } from '@/modules/catalog/ui';

export const metadata: Metadata = { title: 'Etiquetas de precio' };

const UUID = /^[0-9a-f-]{36}$/;

export default async function PriceLabels({
  searchParams,
}: {
  searchParams: Promise<{
    producto?: string;
    marca?: string;
    estado?: string;
    adhesiva?: string;
  }>;
}) {
  const staff = await requirePermission('catalog.edit');
  const params = await searchParams;
  const productId =
    params.producto && UUID.test(params.producto) ? params.producto : undefined;
  const brandId =
    params.marca && UUID.test(params.marca) ? params.marca : undefined;
  const publishedOnly = params.estado === 'publicados';
  // En hoja adhesiva las etiquetas ya vienen troqueladas: sin líneas de corte.
  const cutLines = params.adhesiva !== '1';

  const [labels, brands] = await Promise.all([
    listPriceLabels(staff.supabase, { productId, brandId, publishedOnly }),
    listBrands(staff.supabase),
  ]);
  const single = productId ? labels[0] : undefined;

  return (
    <main>
      {/* Hojas A4 de 3 × 7 etiquetas de 63,5 × 38,1 mm. */}
      <style>{'@page { size: A4; margin: 15.1mm 7.2mm; }'}</style>

      <div className="print:hidden">
        <Link
          href={productId ? `/admin/catalogo/${productId}` : '/admin/catalogo'}
          className="link-underline text-smoke tracking-caps text-xs uppercase"
        >
          ← {productId ? 'Perfume' : 'Catálogo'}
        </Link>
        <div className="mt-6">
          <PageHeader
            eyebrow="Tienda de Castelldefels"
            title="Etiquetas de precio"
          >
            <PrintButton disabled={labels.length === 0}>
              Imprimir {labels.length}{' '}
              {labels.length === 1 ? 'etiqueta' : 'etiquetas'}
            </PrintButton>
          </PageHeader>
        </div>
        <p className="text-smoke -mt-4 mb-8 max-w-2xl text-sm leading-relaxed">
          Una etiqueta por formato activo con PVP. En rebaja se muestra el
          precio anterior validado con Ómnibus. Tamaño de hoja adhesiva A4 de 3
          × 7 (63,5 × 38,1 mm); en papel normal, recorta por las líneas.
        </p>

        <form className="border-line mb-10 flex flex-wrap items-end gap-x-6 gap-y-4 border-y py-5">
          {productId && (
            <input type="hidden" name="producto" value={productId} />
          )}
          {productId ? (
            <p className="text-sm">
              Solo:{' '}
              <span className="font-semibold">
                {single ? `${single.brandName} ${single.productName}` : '—'}
              </span>{' '}
              <Link href="/admin/catalogo/etiquetas" className="link-underline">
                ver todas
              </Link>
            </p>
          ) : (
            <label className="flex flex-col gap-2">
              <span className="eyebrow">Marca</span>
              <select
                name="marca"
                defaultValue={brandId ?? ''}
                className="input min-w-48"
              >
                <option value="">Todas</option>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="flex flex-col gap-2">
            <span className="eyebrow">Perfumes</span>
            <select
              name="estado"
              defaultValue={publishedOnly ? 'publicados' : ''}
              className="input min-w-48"
            >
              <option value="">En tienda (borradores y publicados)</option>
              <option value="publicados">Solo publicados online</option>
            </select>
          </label>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              name="adhesiva"
              value="1"
              defaultChecked={!cutLines}
              className="accent-ink size-5"
            />
            Hoja adhesiva (sin líneas de corte)
          </label>
          <button
            type="submit"
            className="border-ink hover:bg-ink hover:text-ivory tracking-caps min-h-11 border px-5 text-xs font-semibold uppercase transition-colors"
          >
            Aplicar
          </button>
        </form>
      </div>

      {labels.length === 0 ? (
        <p className="font-display text-smoke max-w-lg text-2xl font-light">
          No hay formatos activos con PVP para esta selección. Fija el PVP desde
          la ficha de cada perfume.
        </p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,63.5mm)] gap-[2.5mm] print:grid-cols-[repeat(3,63.5mm)] print:gap-x-[2.5mm] print:gap-y-0">
          {labels.map((label) => (
            <PriceLabelCard
              key={label.variantId}
              label={label}
              cutLines={cutLines}
            />
          ))}
        </div>
      )}
    </main>
  );
}
