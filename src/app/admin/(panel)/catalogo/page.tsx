import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { formatEuros } from '@/lib/money';
import { PageHeader, StatusBadge } from '@/modules/admin';
import { isAllowed } from '@/modules/auth';
import { requirePermission } from '@/modules/auth/server';
import {
  getVariantCosts,
  listAdminProducts,
} from '@/modules/catalog/server/admin';
import { enterStorefrontPreview } from '@/modules/storefront/server/preview';

export const metadata: Metadata = { title: 'Catálogo' };

const FILTERS = [
  { value: '', label: 'Todos' },
  { value: 'draft', label: 'Borradores' },
  { value: 'published', label: 'Publicados' },
  { value: 'archived', label: 'Archivados' },
];

function normalize(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export default async function CatalogAdmin({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; q?: string; pendiente?: string }>;
}) {
  const staff = await requirePermission('catalog.edit');
  const { estado = '', q = '', pendiente = '' } = await searchParams;
  const canStock = isAllowed(
    { role: staff.role, aal: 'aal2' },
    'inventory.view',
  );
  const canPrice = isAllowed(
    { role: staff.role, aal: 'aal2' },
    'pricing.edit_retail',
  );
  const all = await listAdminProducts(staff.supabase, canStock);
  const costs =
    pendiente === 'coste' &&
    isAllowed({ role: staff.role, aal: 'aal2' }, 'pricing.view_cost')
      ? await getVariantCosts(
          staff.supabase,
          all.flatMap((p) => p.variants.map((v) => v.id)),
        )
      : null;
  const needle = normalize(q.trim());
  const products = all
    .filter((p) => !estado || p.status === estado)
    .filter(
      (p) =>
        !pendiente ||
        (p.status !== 'archived' &&
          (pendiente === 'precio'
            ? p.variants.filter((v) => v.active).length === 0 ||
              p.variants.some((v) => v.active && v.priceCents === null)
            : pendiente === 'imagen'
              ? !p.heroUrl
              : pendiente === 'traducciones'
                ? p.missingTranslations.length > 0
                : pendiente === 'coste'
                  ? costs !== null &&
                    p.variants.some((v) => v.active && !costs.has(v.id))
                  : true)),
    )
    .filter(
      (p) => !needle || normalize(`${p.name} ${p.brandName}`).includes(needle),
    );

  return (
    <main>
      <PageHeader eyebrow="Catálogo" title="Perfumes">
        <form action={enterStorefrontPreview}>
          <button
            type="submit"
            className="border-line hover:border-ink inline-flex min-h-11 items-center border px-5 text-xs font-semibold tracking-[0.18em] uppercase transition-colors"
          >
            Ver tienda con borradores
          </button>
        </form>
        {canPrice && (
          <Link
            href="/admin/catalogo/precios"
            className="border-line hover:border-ink inline-flex min-h-11 items-center border px-5 text-xs font-semibold tracking-[0.18em] uppercase transition-colors"
          >
            Cambiar precios
          </Link>
        )}
        <Link
          href="/admin/catalogo/importar"
          className="border-line hover:border-ink inline-flex min-h-11 items-center border px-5 text-xs font-semibold tracking-[0.18em] uppercase transition-colors"
        >
          Importar
        </Link>
        <Link
          href="/admin/catalogo/etiquetas"
          className="border-ink hover:bg-ink hover:text-ivory inline-flex min-h-11 items-center border px-5 text-xs font-semibold tracking-[0.18em] uppercase transition-colors"
        >
          Etiquetas
        </Link>
        <Link
          href="/admin/catalogo/nuevo"
          className="bg-ink text-ivory hover:bg-gold inline-flex min-h-11 items-center px-5 text-xs font-semibold tracking-[0.18em] uppercase transition-colors"
        >
          Nuevo perfume
        </Link>
      </PageHeader>

      <form className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {pendiente && (
          <>
            <input type="hidden" name="pendiente" value={pendiente} />
            <p className="text-sm">
              Pendiente: {pendiente} ·{' '}
              <Link href="/admin/catalogo" className="link-underline">
                Quitar filtro
              </Link>
            </p>
          </>
        )}
        <nav aria-label="Estado" className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => {
            const count = filter.value
              ? all.filter((p) => p.status === filter.value).length
              : all.length;
            const active = estado === filter.value;
            const params = new URLSearchParams();
            if (filter.value) params.set('estado', filter.value);
            if (q) params.set('q', q);
            if (pendiente) params.set('pendiente', pendiente);
            return (
              <Link
                key={filter.value}
                href={`/admin/catalogo${params.size ? `?${params}` : ''}`}
                aria-current={active ? 'page' : undefined}
                className={`border px-3 py-2 text-xs tracking-[0.12em] uppercase ${active ? 'border-ink bg-ink text-ivory' : 'border-line hover:border-ink'}`}
              >
                {filter.label} <span className="opacity-60">{count}</span>
              </Link>
            );
          })}
        </nav>
        {estado && <input type="hidden" name="estado" value={estado} />}
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Buscar perfume o marca"
          className="input sm:max-w-xs"
        />
      </form>

      {products.length === 0 ? (
        <p className="text-smoke py-16 text-center">
          {all.length === 0
            ? 'Aún no hay perfumes. Crea el primero o importa el catálogo.'
            : 'Ningún perfume coincide con el filtro.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table min-w-[44rem]">
            <thead>
              <tr>
                <th className="w-16" />
                <th>Perfume</th>
                <th>Estado</th>
                <th>Formatos y PVP</th>
                {canStock && <th className="text-right">Stock</th>}
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="bg-stage relative size-12">
                      {p.heroUrl && (
                        <Image
                          src={p.heroUrl}
                          alt=""
                          fill
                          sizes="48px"
                          className="object-contain p-1 mix-blend-multiply brightness-[1.04]"
                        />
                      )}
                    </div>
                  </td>
                  <td>
                    <Link
                      href={`/admin/catalogo/${p.id}`}
                      className="link-underline font-display text-lg"
                    >
                      {p.name}
                    </Link>
                    <p className="text-smoke text-xs">
                      {p.brandName}
                      {p.featured && (
                        <span className="text-gold"> · destacado</span>
                      )}
                    </p>
                  </td>
                  <td>
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="text-sm">
                    {p.variants.length === 0 ? (
                      <span className="text-danger">Sin formatos</span>
                    ) : (
                      p.variants.map((v) => (
                        <span
                          key={v.id}
                          className={`mr-3 inline-block ${v.active ? '' : 'text-mist line-through'}`}
                        >
                          {v.label}:{' '}
                          {v.priceCents === null ? (
                            <span className="text-danger">sin PVP</span>
                          ) : (
                            formatEuros(v.priceCents, 'es')
                          )}
                        </span>
                      ))
                    )}
                  </td>
                  {canStock && (
                    <td className="text-right tabular-nums">{p.onHand}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
