import type { Metadata } from 'next';
import Link from 'next/link';
import type { AttentionCounts } from '@/modules/control';
import {
  ATTENTION_KIND_LABELS,
  MIN_CONVERSION_VIEWS,
  addDays,
  attentionByProduct,
  attentionScore,
  changeBp,
  conversionBp,
  dayRange,
  emptyAttention,
  integer,
  interestGaps,
  madridToday,
  netUnits,
  percent,
  shortDayLabel,
  signedPercent,
} from '@/modules/control';
import {
  listAttention,
  listVariantSeries,
  requireControl,
} from '@/modules/control/server';
import {
  ConsoleHeader,
  ConsoleNotice,
  ConsoleSection,
  FilterLinks,
  KeyFigure,
  SeriesBars,
} from '@/modules/control/ui';
import { listAllVariants } from '@/modules/reports/server';
import { Table } from '@/components/ui';

export const metadata: Metadata = { title: 'Atención' };

const PERIODS = { '7': 7, '30': 30, '90': 90 } as const;
type PeriodKey = keyof typeof PERIODS;

function totals(map: Map<string, AttentionCounts>): AttentionCounts {
  const sum = emptyAttention();
  for (const counts of map.values()) {
    sum.view += counts.view;
    sum.scent_view += counts.scent_view;
    sum.unboxing += counts.unboxing;
    sum.add_to_cart += counts.add_to_cart;
  }
  return sum;
}

function change(current: number, previous: number) {
  const bp = changeBp(current, previous);
  return bp === null
    ? 'sin datos del periodo anterior'
    : `${signedPercent(bp)} frente al periodo anterior`;
}

export default async function AttentionPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const { supabase } = await requireControl();
  const { periodo } = await searchParams;
  const period: PeriodKey =
    periodo && periodo in PERIODS ? (periodo as PeriodKey) : '30';
  const days = PERIODS[period];
  const today = madridToday();
  const to = addDays(today, 1);
  const from = addDays(today, -(days - 1));
  const previousFrom = addDays(from, -days);

  const [rows, series, variants] = await Promise.all([
    listAttention(supabase, previousFrom, to),
    listVariantSeries(supabase, from, to, 'day'),
    listAllVariants(supabase),
  ]);
  const currentRows = rows.filter((r) => r.day >= from);
  const previousRows = rows.filter((r) => r.day < from);
  const byProduct = attentionByProduct(currentRows);
  const previousByProduct = attentionByProduct(previousRows);
  const total = totals(byProduct);
  const previousTotal = totals(previousByProduct);

  const names = new Map<string, { name: string; brand: string }>();
  for (const v of variants.values())
    names.set(v.productId, { name: v.productName, brand: v.brandName });
  const units = new Map<string, number>();
  for (const s of series) {
    const productId = variants.get(s.variantId)?.productId;
    if (!productId) continue;
    const net = s.buckets.reduce((sum, b) => sum + netUnits(b), 0);
    units.set(productId, (units.get(productId) ?? 0) + net);
  }

  const ranked = [...byProduct.entries()]
    .map(([productId, counts]) => {
      const previous = previousByProduct.get(productId);
      const sold = units.get(productId) ?? 0;
      return {
        productId,
        ...(names.get(productId) ?? { name: 'Perfume borrado', brand: '—' }),
        counts,
        score: attentionScore(counts),
        previousScore: previous ? attentionScore(previous) : 0,
        units: sold,
        conversion: conversionBp(sold, counts.view + counts.scent_view),
      };
    })
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'es'));
  const gaps = interestGaps(
    ranked.map((r) => ({
      productId: r.productId,
      score: r.score,
      units: r.units,
    })),
  );
  const rankedById = new Map(ranked.map((r) => [r.productId, r]));

  const daily = new Map<string, number>();
  for (const r of currentRows)
    if (r.kind === 'view' || r.kind === 'scent_view')
      daily.set(r.day, (daily.get(r.day) ?? 0) + r.hits);
  const bars = dayRange(from, to).map((day) => ({
    key: day,
    label: shortDayLabel(day),
    short: days <= 30 ? shortDayLabel(day).split(' ')[0]! : '',
    value: daily.get(day) ?? 0,
  }));

  const views = total.view + total.scent_view;
  const previousViews = previousTotal.view + previousTotal.scent_view;
  const soldInPeriod = [...units.values()].reduce((s, n) => s + n, 0);

  return (
    <main>
      <ConsoleHeader
        section="Negocio"
        title="Atención"
        description="Qué perfumes se miran, cuáles interesan y cuáles convierten. Contadores anónimos por perfume y día: sin cookies, sin IP y sin nada que identifique a quien visita."
      >
        <FilterLinks
          label="Periodo"
          options={(Object.keys(PERIODS) as PeriodKey[]).map((p) => ({
            href: `/admin/control/atencion?periodo=${p}`,
            label: `${p} días`,
            active: p === period,
          }))}
        />
      </ConsoleHeader>

      <div className="mb-6">
        <ConsoleNotice title="Cifras orientativas mientras la web no esté indexada">
          <p>
            La web es pública desde el 10/10/2026, pero los buscadores aún no la
            indexan: hay pocas visitas y parte son del equipo. Tampoco cuentan
            los bots, otros orígenes ni los navegadores con «No rastrear» o
            Global Privacy Control.
          </p>
        </ConsoleNotice>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <KeyFigure
          label="Visitas a fichas"
          value={integer(views)}
          note={change(views, previousViews)}
        />
        <KeyFigure
          label={ATTENTION_KIND_LABELS.unboxing}
          value={integer(total.unboxing)}
          note={change(total.unboxing, previousTotal.unboxing)}
        />
        <KeyFigure
          label="Perfumes vistos"
          value={byProduct.size}
          note={`${integer(previousByProduct.size)} en el periodo anterior`}
        />
        <KeyFigure
          label="Unidades por visita"
          value={percent(conversionBp(soldInPeriod, views))}
          note={`${integer(soldInPeriod)} uds netas vendidas; incluye el mostrador`}
        />
      </div>

      <div className="mt-8">
        <SeriesBars
          title="Visitas a fichas por día"
          data={bars}
          format={(v) => `${integer(v)} visitas`}
        />
      </div>

      <div className="mt-10 grid grid-cols-[3fr_2fr] gap-8">
        <ConsoleSection
          id="mas-vistos"
          title="Lo que más atención recibe"
          className=""
        >
          {ranked.length === 0 ? (
            <p className="text-fg-muted border-border border-y py-8 text-center text-sm">
              Sin visitas en este periodo.
            </p>
          ) : (
            <Table
              caption="Perfumes por atención en el periodo"
              stacked={false}
              density="compact"
              stickyHeader
            >
              <thead>
                <tr>
                  <th>Perfume</th>
                  <th className="text-right">Ficha</th>
                  <th className="text-right">Olfativa</th>
                  <th className="text-right">3D</th>
                  <th className="text-right">Interés</th>
                  <th className="text-right">Cambio</th>
                  <th className="text-right">Uds</th>
                  <th className="text-right">Conversión</th>
                </tr>
              </thead>
              <tbody>
                {ranked.slice(0, 30).map((r) => (
                  <tr key={r.productId}>
                    <td className="max-w-64">
                      <Link
                        href={`/admin/control/productos/${r.productId}`}
                        className="hover:text-accent-fg block truncate"
                      >
                        <span className="text-fg-muted">{r.brand} · </span>
                        {r.name}
                      </Link>
                    </td>
                    <td className="text-right font-mono tabular-nums">
                      {integer(r.counts.view)}
                    </td>
                    <td className="text-right font-mono tabular-nums">
                      {integer(r.counts.scent_view)}
                    </td>
                    <td className="text-right font-mono tabular-nums">
                      {integer(r.counts.unboxing)}
                    </td>
                    <td className="text-right font-mono tabular-nums">
                      {integer(r.score)}
                    </td>
                    <td className="text-right font-mono tabular-nums">
                      {signedPercent(changeBp(r.score, r.previousScore))}
                    </td>
                    <td className="text-right font-mono tabular-nums">
                      {integer(r.units)}
                    </td>
                    <td className="text-right font-mono tabular-nums">
                      {percent(r.conversion)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          <p className="text-fg-muted mt-2 text-xs">
            Interés = visitas a la ficha y a la ficha olfativa + el doble de las
            aperturas 3D. La conversión (unidades vendidas por visita) solo se
            da con {MIN_CONVERSION_VIEWS} visitas o más y es aproximada: las
            ventas incluyen el mostrador.
          </p>
        </ConsoleSection>

        <div className="flex flex-col gap-10">
          <ConsoleSection
            id="interes-sin-venta"
            title="Mucho interés, pocas ventas"
            className=""
          >
            {gaps.length === 0 ? (
              <p className="text-fg-muted text-sm">
                Ningún perfume destaca por atención sin vender. Hacen falta al
                menos cuatro perfumes con visitas para comparar.
              </p>
            ) : (
              <ul className="divide-border border-border divide-y border-y">
                {gaps.map((g) => {
                  const r = rankedById.get(g.productId)!;
                  return (
                    <li key={g.productId}>
                      <Link
                        href={`/admin/control/productos/${g.productId}`}
                        className="hover:bg-surface-raised flex items-center justify-between gap-4 py-2 text-sm"
                      >
                        <span className="min-w-0 truncate">
                          <span className="text-fg-muted">{r.brand} · </span>
                          {r.name}
                        </span>
                        <span className="text-fg-muted shrink-0 font-mono text-xs tabular-nums">
                          {integer(g.score)} interés · {integer(g.units)} uds
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="text-fg-muted mt-2 text-xs">
              Atención en el cuartil superior y conversión por debajo de la
              mediana: revisa precio, fotos, disponibilidad o descripción.
            </p>
          </ConsoleSection>

          <ConsoleSection
            id="carritos"
            title="Carritos abandonados"
            className=""
          >
            <ConsoleNotice title="Llegará con el checkout">
              <p>
                La tienda todavía no tiene cesta ni cuentas de cliente, así que
                no hay carritos que medir. Cuando llegue el pago, se contará
                «añadido a la cesta» de forma agregada y aquí aparecerán los
                perfumes que se añaden y no se compran, sin identificar a nadie.
              </p>
            </ConsoleNotice>
          </ConsoleSection>
        </div>
      </div>
    </main>
  );
}
