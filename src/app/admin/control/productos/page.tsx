import type { Metadata } from 'next';
import Link from 'next/link';
import type { TrendDirection } from '@/modules/control';
import {
  FORECAST_DAYS,
  euros,
  madridToday,
  percent,
  signedPercent,
} from '@/modules/control';
import type { ProductMetrics } from '@/modules/control/server';
import { loadProductMetrics, requireControl } from '@/modules/control/server';
import {
  ConsoleHeader,
  FilterLinks,
  KeyFigure,
  Sparkline,
} from '@/modules/control/ui';
import { Badge, buttonClass, Input, Select, Table } from '@/components/ui';
import type { BadgeTone } from '@/components/ui';

export const metadata: Metadata = { title: 'Productos' };

const COLUMNS = {
  ventas: 'Ventas sin IVA',
  uds12: 'Uds 12 sem',
  uds4: 'Uds 4 sem',
  tendencia: 'Tendencia',
  ritmo: 'Ritmo',
  prevision: 'Prev. 28 d',
  existencias: 'Stock',
  cobertura: 'Cobertura',
  margen: 'Margen',
  visitas: 'Visitas',
} as const;
type SortKey = keyof typeof COLUMNS;

const TRENDS: Record<
  TrendDirection,
  { label: string; tone: BadgeTone; mark: string }
> = {
  up: { label: 'Sube', tone: 'success', mark: '▲' },
  down: { label: 'Baja', tone: 'danger', mark: '▼' },
  flat: { label: 'Estable', tone: 'neutral', mark: '■' },
  insufficient: { label: 'Sin datos', tone: 'neutral', mark: '·' },
};

/** Valor por el que se ordena; null va siempre al final. */
function sortValue(row: ProductMetrics, key: SortKey): number | null {
  switch (key) {
    case 'ventas':
      return row.netSalesCents;
    case 'uds12':
      return row.units12;
    case 'uds4':
      return row.units4;
    case 'tendencia':
      return row.trend.changeBp;
    case 'ritmo':
      return row.demand.perDay;
    case 'prevision':
      return row.forecast?.expected ?? null;
    case 'existencias':
      return row.available;
    case 'cobertura':
      return row.coverageDays;
    case 'margen':
      return row.marginBp;
    case 'visitas':
      return row.attention
        ? row.attention.view + row.attention.scent_view
        : null;
  }
}

function perWeek(perDay: number | null) {
  if (perDay === null) return '—';
  return (perDay * 7).toLocaleString('es-ES', {
    maximumFractionDigits: 1,
    minimumFractionDigits: perDay * 7 < 10 ? 1 : 0,
  });
}

type Query = {
  orden?: string;
  dir?: string;
  q?: string;
  marca?: string;
  abc?: string;
  tendencia?: string;
  stock?: string;
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  const { supabase } = await requireControl();
  const query = await searchParams;
  const today = madridToday();
  const { rows, withoutMovements } = await loadProductMetrics(supabase, today);

  const sort: SortKey =
    query.orden && query.orden in COLUMNS ? (query.orden as SortKey) : 'ventas';
  const dir = query.dir === 'asc' ? 'asc' : 'desc';
  const text = (query.q ?? '').trim().toLowerCase();
  const brands = [...new Set(rows.map((r) => r.brandName))].sort((a, b) =>
    a.localeCompare(b, 'es'),
  );

  const href = (patch: Partial<Query>) => {
    const params = new URLSearchParams();
    const merged = { ...query, ...patch };
    for (const [key, value] of Object.entries(merged))
      if (value) params.set(key, value);
    const qs = params.toString();
    return `/admin/control/productos${qs ? `?${qs}` : ''}`;
  };

  const shown = rows
    .filter(
      (r) =>
        (!text ||
          `${r.brandName} ${r.productName}`.toLowerCase().includes(text)) &&
        (!query.marca || r.brandName === query.marca) &&
        (!query.abc || r.abc === query.abc) &&
        (!query.tendencia || r.trend.direction === query.tendencia) &&
        (query.stock !== 'con' || (r.available ?? 0) > 0) &&
        (query.stock !== 'rotura' || (r.available === 0 && r.units12 > 0)),
    )
    .sort((a, b) => {
      const va = sortValue(a, sort);
      const vb = sortValue(b, sort);
      if (va === null && vb === null)
        return a.productName.localeCompare(b.productName, 'es');
      if (va === null) return 1;
      if (vb === null) return -1;
      return dir === 'asc' ? va - vb : vb - va;
    });

  const selling = rows.filter((r) => r.units12 > 0).length;
  const stockout = rows.filter(
    (r) => r.available === 0 && r.units12 > 0,
  ).length;
  const lowCover = rows.filter(
    (r) => r.coverageDays !== null && r.coverageDays < 14,
  ).length;
  const idle = rows.filter(
    (r) => (r.available ?? 0) > 0 && r.units12 <= 0,
  ).length;

  const header = (key: SortKey, numeric = true) => {
    const active = sort === key;
    const next = active && dir === 'desc' ? 'asc' : 'desc';
    return (
      <th
        className={numeric ? 'text-right' : undefined}
        aria-sort={
          active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'
        }
      >
        <Link
          href={href({ orden: key, dir: next })}
          className="hover:text-fg inline-flex min-h-6 items-center gap-1"
        >
          {COLUMNS[key]}
          {active && (
            <span aria-hidden="true">{dir === 'asc' ? '↑' : '↓'}</span>
          )}
        </Link>
      </th>
    );
  };

  return (
    <main>
      <ConsoleHeader
        section="Negocio"
        title="Productos"
        description="Evolución, demanda y tendencia de cada perfume en las últimas 26 semanas. El ritmo cuenta solo los días con existencias (las roturas no lo bajan); la previsión es a 28 días con un intervalo del 80 %."
      />

      <div className="mb-6 grid grid-cols-4 gap-3">
        <KeyFigure
          label="Con ventas (12 sem)"
          value={selling}
          note={`de ${rows.length} con movimientos`}
        />
        <KeyFigure
          label="En rotura"
          value={stockout}
          tone={stockout > 0 ? 'alert' : 'default'}
          note="Se venden y no hay disponible"
          href={href({ stock: 'rotura' })}
        />
        <KeyFigure
          label="Cobertura < 14 días"
          value={lowCover}
          tone={lowCover > 0 ? 'alert' : 'default'}
          note="Al ritmo real de venta"
          href={href({ orden: 'cobertura', dir: 'asc' })}
        />
        <KeyFigure
          label="Inmovilizados"
          value={idle}
          note="Con disponible y sin ventas en 12 semanas"
        />
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-4">
        <form
          className="flex items-end gap-2"
          action="/admin/control/productos"
        >
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-fg-muted">Buscar</span>
            <Input
              name="q"
              defaultValue={query.q ?? ''}
              className="w-56! text-sm!"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-fg-muted">Marca</span>
            <Select
              name="marca"
              defaultValue={query.marca ?? ''}
              className="w-48! text-sm!"
            >
              <option value="">Todas</option>
              {brands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </Select>
          </label>
          {query.orden && (
            <input type="hidden" name="orden" value={query.orden} />
          )}
          {query.dir && <input type="hidden" name="dir" value={query.dir} />}
          <button type="submit" className={buttonClass('outline', 'md')}>
            Filtrar
          </button>
        </form>
        <FilterLinks
          label="Tendencia"
          options={[
            {
              href: href({ tendencia: undefined }),
              label: 'Todas',
              active: !query.tendencia,
            },
            ...(['up', 'down', 'flat', 'insufficient'] as const).map((t) => ({
              href: href({ tendencia: t }),
              label: TRENDS[t].label,
              active: query.tendencia === t,
            })),
          ]}
        />
        <FilterLinks
          label="Clase ABC"
          options={[
            {
              href: href({ abc: undefined }),
              label: 'ABC',
              active: !query.abc,
            },
            ...(['A', 'B', 'C'] as const).map((c) => ({
              href: href({ abc: c }),
              label: c,
              active: query.abc === c,
            })),
          ]}
        />
        <FilterLinks
          label="Existencias"
          options={[
            {
              href: href({ stock: undefined }),
              label: 'Todas',
              active: !query.stock,
            },
            {
              href: href({ stock: 'con' }),
              label: 'Con disponible',
              active: query.stock === 'con',
            },
            {
              href: href({ stock: 'rotura' }),
              label: 'En rotura',
              active: query.stock === 'rotura',
            },
          ]}
        />
      </div>

      {rows.length === 0 ? (
        <p className="text-fg-muted border-border border-y py-10 text-center text-sm">
          Aún no hay movimientos de existencias: cuando se reciba o venda algo,
          aparecerá aquí.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table
            caption="Métricas por perfume"
            stacked={false}
            density="compact"
            stickyHeader
            className="min-w-[64rem]"
          >
            <thead>
              <tr>
                <th>Perfume</th>
                {header('existencias')}
                {header('uds4')}
                {header('uds12')}
                <th>12 semanas</th>
                {header('tendencia')}
                {header('ritmo')}
                {header('prevision')}
                {header('cobertura')}
                {header('ventas')}
                {header('margen')}
                {header('visitas')}
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const t = TRENDS[r.trend.direction];
                const views = r.attention
                  ? r.attention.view + r.attention.scent_view
                  : null;
                return (
                  <tr key={r.productId}>
                    <td className="max-w-60">
                      <Link
                        href={`/admin/control/productos/${r.productId}`}
                        className="hover:text-accent-fg block truncate"
                      >
                        <span className="text-fg-muted">{r.brandName} · </span>
                        {r.productName}
                      </Link>
                      <span className="text-fg-muted text-2xs">
                        <span
                          className="font-mono"
                          title="Clase ABC por ventas y XYZ por regularidad"
                        >
                          {r.abc}
                          {r.xyz ?? ''}
                        </span>
                        {r.status !== 'published' &&
                          ` · ${r.status === 'draft' ? 'Borrador' : 'Archivado'}`}
                      </span>
                    </td>
                    <td
                      className={`text-right font-mono tabular-nums ${r.available === 0 && r.units12 > 0 ? 'text-danger' : ''}`}
                    >
                      {r.available ?? '—'}
                    </td>
                    <td className="text-right font-mono tabular-nums">
                      {r.units4}
                    </td>
                    <td className="text-right font-mono tabular-nums">
                      {r.units12}
                    </td>
                    <td>
                      <Sparkline
                        values={r.weekly}
                        label={`Unidades por semana: ${r.weekly.join(', ')}`}
                      />
                    </td>
                    <td className="text-right">
                      {r.trend.direction === 'insufficient' ||
                      r.trend.changeBp === null ? (
                        <span
                          className="text-fg-muted"
                          title="Sin datos suficientes para una tendencia"
                        >
                          —<span className="sr-only"> sin datos</span>
                        </span>
                      ) : (
                        <Badge tone={t.tone}>
                          <span aria-hidden="true">{t.mark} </span>
                          {signedPercent(r.trend.changeBp)}
                        </Badge>
                      )}
                    </td>
                    <td className="text-right font-mono whitespace-nowrap tabular-nums">
                      {perWeek(r.demand.perDay)}
                      {r.demand.perDay !== null && (
                        <span className="text-fg-muted"> /sem</span>
                      )}
                    </td>
                    <td className="text-right font-mono tabular-nums">
                      {r.forecast
                        ? `${r.forecast.expected} (${r.forecast.low}–${r.forecast.high})`
                        : '—'}
                    </td>
                    <td
                      className={`text-right font-mono tabular-nums ${r.coverageDays !== null && r.coverageDays < 14 ? 'text-danger' : ''}`}
                    >
                      {r.coverageDays === null ? '—' : `${r.coverageDays} d`}
                    </td>
                    <td className="text-right font-mono tabular-nums">
                      {euros(r.netSalesCents)}
                      {r.estimatedCents > 0 && (
                        <span
                          className="text-fg-muted"
                          title="Incluye ventas sin precio cobrado estimadas con el PVP"
                        >
                          {' '}
                          *
                        </span>
                      )}
                    </td>
                    <td
                      className={`text-right font-mono tabular-nums ${r.uncostedUnits > 0 ? 'text-warning' : ''}`}
                    >
                      {percent(r.marginBp)}
                    </td>
                    <td className="text-right font-mono tabular-nums">
                      {views ?? '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      )}
      <p className="text-fg-muted mt-3 text-xs">
        {shown.length} de {rows.length} perfumes con movimientos
        {withoutMovements > 0 &&
          ` · ${withoutMovements} del catálogo sin movimientos no se listan`}
        {' · '}Previsión a {FORECAST_DAYS} días · * incluye ventas estimadas con
        el PVP · margen en ámbar: hay unidades sin coste · stock: disponible
        ahora · visitas de los últimos 30 días · clase ABC por ventas y XYZ por
        regularidad
      </p>
    </main>
  );
}
