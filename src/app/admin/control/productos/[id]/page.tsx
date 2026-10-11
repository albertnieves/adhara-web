import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import type { DemandKind, Grain, SeriesBucket } from '@/modules/control';
import {
  FORECAST_DAYS,
  activeBuckets,
  addDays,
  attentionSeries,
  combinedDemandRate,
  coverageDays,
  dayLabel,
  demandPattern,
  discountDepthBp,
  elasticityHints,
  estimatedLostUnits,
  euros,
  forecast,
  isCompleteBucket,
  madridToday,
  netUnits,
  percent,
  realizedMargin,
  rollupSeries,
  shortDayLabel,
  signedPercent,
  sumBuckets,
  trend,
  weekStart,
  xyzClass,
} from '@/modules/control';
import {
  listAttention,
  listVariantEvents,
  listVariantSeries,
  requireControl,
} from '@/modules/control/server';
import {
  ConsoleHeader,
  FilterLinks,
  KeyFigure,
  SeriesBars,
} from '@/modules/control/ui';
import { getDefaultLocation, listLevels } from '@/modules/inventory/server';
import { VAT_GENERAL_BP } from '@/modules/pricing';
import { listAllVariants } from '@/modules/reports/server';
import { Table, buttonClass } from '@/components/ui';

export const metadata: Metadata = { title: 'Producto' };

const PERIODS = {
  '12': { label: '12 semanas', grain: 'week', weeks: 12 },
  '26': { label: '26 semanas', grain: 'week', weeks: 26 },
  '52': { label: '52 semanas', grain: 'week', weeks: 52 },
  diario: { label: 'Diario 90 días', grain: 'day', weeks: 0 },
} as const satisfies Record<
  string,
  { label: string; grain: Grain; weeks: number }
>;
type PeriodKey = keyof typeof PERIODS;

const DEMAND: Record<DemandKind, string> = {
  smooth: 'Regular: vende casi todas las semanas y en cantidades parecidas.',
  erratic: 'Errática: vende casi siempre, pero con cantidades muy distintas.',
  intermittent: 'Intermitente: semanas sin ventas entre ventas parecidas.',
  lumpy: 'Irregular: semanas sin ventas y cantidades muy distintas.',
  insufficient: 'Sin datos suficientes para clasificar la demanda.',
};

function perWeek(perDay: number | null) {
  return perDay === null
    ? '—'
    : `${(perDay * 7).toLocaleString('es-ES', { maximumFractionDigits: 1 })} uds/sem`;
}

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ periodo?: string }>;
}) {
  const { supabase } = await requireControl();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { periodo } = await searchParams;
  const key: PeriodKey =
    periodo && periodo in PERIODS ? (periodo as PeriodKey) : '26';
  const period = PERIODS[key];

  const today = madridToday();
  const to = addDays(today, 1);
  const from =
    period.grain === 'day'
      ? addDays(today, -89)
      : addDays(weekStart(today), -7 * (period.weeks - 1));

  const [{ data: product }, variants, series, attentionRows, location] =
    await Promise.all([
      supabase
        .from('products')
        .select('id, slug, name, status, brand:brands!inner(name)')
        .eq('id', id)
        .maybeSingle(),
      listAllVariants(supabase),
      listVariantSeries(supabase, from, to, period.grain),
      listAttention(supabase, from, to),
      getDefaultLocation(supabase),
    ]);
  if (!product) notFound();

  const own = [...variants.values()].filter((v) => v.productId === id);
  const ownIds = new Set(own.map((v) => v.variantId));
  const ownSeries = series.filter((s) => ownIds.has(s.variantId));
  const [events, levels] = await Promise.all([
    listVariantEvents(supabase, [...ownIds]),
    location ? listLevels(supabase, location.id) : null,
  ]);

  const rolled = rollupSeries(ownSeries).filter((b) => b.days > 0);
  const totals = sumBuckets(rolled);
  const net = netUnits(totals);
  let estimatedCents = 0;
  for (const s of ownSeries)
    for (const b of s.buckets)
      if (b.days > 0 && b.retailPriceCents !== null)
        estimatedCents +=
          Math.max(0, b.sold - b.pricedSold) * b.retailPriceCents;
  const salesCents =
    totals.grossCents - totals.returnedGrossCents + estimatedCents;
  const margin = realizedMargin(
    { grossCents: salesCents, cogsCents: totals.cogsCents },
    VAT_GENERAL_BP,
  );
  const demand = combinedDemandRate(ownSeries);
  const lost = ownSeries
    .map((s) => estimatedLostUnits(s.buckets))
    .filter((n): n is number => n !== null)
    .reduce((a, b) => a + b, 0);
  const available = levels
    ? own.reduce((sum, v) => {
        const level = levels.get(v.variantId);
        return sum + (level ? Math.max(0, level.onHand - level.reserved) : 0);
      }, 0)
    : null;
  const complete = rolled.filter((b) => isCompleteBucket(b, period.grain));
  const units = complete.map(netUnits);
  const pattern = demandPattern(units);
  const productTrend = trend(units);
  const prediction = forecast(demand.perDay, FORECAST_DAYS);
  const cover = coverageDays(available, demand.perDay);
  // Los tramos anteriores al primer movimiento no cuentan como roturas: el
  // perfume aún no estaba en la tienda.
  const firstActive = rolled.length - activeBuckets(rolled).length;
  const stockoutDays = rolled
    .slice(firstActive)
    .reduce((n, b) => n + (b.days - b.inStockDays), 0);

  const label = (b: SeriesBucket) =>
    period.grain === 'day'
      ? dayLabel(b.start)
      : `Semana del ${dayLabel(b.start)}`;
  const short = (b: SeriesBucket, i: number) =>
    period.grain === 'day'
      ? i % 7 === 0
        ? shortDayLabel(b.start)
        : ''
      : i % Math.max(1, Math.round(rolled.length / 13)) === 0
        ? shortDayLabel(b.start)
        : '';

  const attentionDays = attentionSeries(
    attentionRows,
    id,
    rolled.length && period.grain === 'day'
      ? rolled.map((b) => b.start)
      : Array.from({ length: 90 }, (_, i) => addDays(today, i - 89)),
  );
  const views = attentionDays.reduce((n, d) => n + d.view + d.scent_view, 0);
  const unboxing = attentionDays.reduce((n, d) => n + d.unboxing, 0);

  const priceEvents = events.filter((e) => e.kind === 'price');
  const hints = ownSeries.flatMap((s) =>
    elasticityHints(
      s.buckets,
      priceEvents
        .filter((e) => e.variantId === s.variantId)
        .map((e) => ({ at: e.at, priceCents: e.priceCents })),
    ).filter((h) => h.conclusive),
  );
  const brandName = product.brand.name;

  return (
    <main>
      <ConsoleHeader
        section={`Productos · ${brandName}`}
        title={product.name}
        description={
          product.status === 'published'
            ? 'Publicado en la tienda.'
            : product.status === 'draft'
              ? 'Borrador: no se ve en la tienda.'
              : 'Archivado.'
        }
      >
        <Link
          href={`/admin/catalogo/${id}`}
          className={buttonClass('outline', 'md')}
        >
          Ficha en el catálogo
        </Link>
        {product.status === 'published' && (
          <Link
            href={`/es/perfume/${product.slug}`}
            target="_blank"
            className={buttonClass('outline', 'md')}
          >
            Ver en la tienda ↗
          </Link>
        )}
      </ConsoleHeader>

      <div className="mb-6">
        <FilterLinks
          label="Periodo"
          options={(Object.keys(PERIODS) as PeriodKey[]).map((k) => ({
            href: `/admin/control/productos/${id}?periodo=${k}`,
            label: PERIODS[k].label,
            active: k === key,
          }))}
        />
      </div>

      {ownSeries.length === 0 ? (
        <p className="text-fg-muted border-border border-y py-10 text-center text-sm">
          Este perfume no tiene movimientos en el periodo.
        </p>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-4 gap-3 2xl:grid-cols-8">
            <KeyFigure
              label="Uds netas"
              value={net}
              note={`${totals.sold} vendidas · ${totals.returned} devueltas`}
            />
            <KeyFigure
              label="Ventas sin IVA"
              value={euros(margin.netCents)}
              note={
                estimatedCents > 0
                  ? 'Incluye ventas estimadas con el PVP'
                  : `${totals.tickets} tickets de mostrador`
              }
            />
            <KeyFigure
              label="Margen realizado"
              value={percent(margin.marginBp)}
              note={
                totals.uncosted > 0
                  ? `${totals.uncosted} uds sin coste: margen real menor`
                  : euros(margin.marginCents)
              }
              tone={totals.uncosted > 0 ? 'alert' : 'default'}
            />
            <KeyFigure
              label="Descuento medio"
              value={percent(
                discountDepthBp(totals.grossCents, totals.listCents),
              )}
              note="Sobre el PVP, en lo cobrado"
            />
            <KeyFigure
              label="Ritmo real"
              value={perWeek(demand.perDay)}
              note={`Sin corregir: ${perWeek(demand.rawPerDay)}`}
            />
            <KeyFigure
              label="Roturas"
              value={`${stockoutDays} d`}
              tone={stockoutDays > 0 ? 'alert' : 'default'}
              note={
                lost > 0
                  ? `≈ ${lost} uds perdidas`
                  : 'Sin ventas perdidas estimadas'
              }
            />
            <KeyFigure
              label="Disponible"
              value={available ?? '—'}
              note={
                cover === null ? 'Cobertura sin datos' : `Cubre ${cover} días`
              }
              tone={cover !== null && cover < 14 ? 'alert' : 'default'}
            />
            <KeyFigure
              label={`Previsión ${FORECAST_DAYS} d`}
              value={prediction ? prediction.expected : '—'}
              note={
                prediction
                  ? `Entre ${prediction.low} y ${prediction.high} uds (80 %)`
                  : 'Sin ritmo suficiente'
              }
            />
          </div>

          <div className="mb-6 grid grid-cols-3 gap-3 text-sm">
            <p className="border-border border p-3">
              <span className="text-fg-muted text-2xs tracking-caps-sm block font-semibold uppercase">
                Tendencia
              </span>
              {productTrend.direction === 'insufficient' ||
              productTrend.changeBp === null
                ? 'Sin datos suficientes (hacen falta 8 tramos completos y 5 unidades).'
                : `${productTrend.direction === 'up' ? 'Sube' : productTrend.direction === 'down' ? 'Baja' : 'Estable'}: ${signedPercent(productTrend.changeBp)} en los 4 últimos tramos frente a los 4 anteriores.`}
            </p>
            <p className="border-border border p-3">
              <span className="text-fg-muted text-2xs tracking-caps-sm block font-semibold uppercase">
                Patrón de demanda
              </span>
              {DEMAND[pattern.kind]}
            </p>
            <p className="border-border border p-3">
              <span className="text-fg-muted text-2xs tracking-caps-sm block font-semibold uppercase">
                Regularidad (XYZ)
              </span>
              {(() => {
                const xyz = xyzClass(units);
                return xyz === null
                  ? 'Sin datos suficientes.'
                  : xyz === 'X'
                    ? 'X: ventas estables entre tramos.'
                    : xyz === 'Y'
                      ? 'Y: ventas variables.'
                      : 'Z: ventas muy irregulares.';
              })()}
            </p>
          </div>

          <div className="mb-8 grid grid-cols-2 gap-8">
            <SeriesBars
              title="Unidades netas"
              note="en ámbar, tramos con días sin existencias"
              data={rolled.map((b, i) => ({
                key: b.start,
                label: label(b),
                short: short(b, i),
                value: netUnits(b),
                flagged: i >= firstActive && b.inStockDays < b.days,
              }))}
              format={(v) => `${v} uds`}
            />
            <SeriesBars
              title="Existencias al cierre"
              data={rolled.map((b, i) => ({
                key: b.start,
                label: label(b),
                short: short(b, i),
                value: b.closingOnHand,
              }))}
              format={(v) => `${v} uds`}
            />
            <SeriesBars
              title="Cobrado con IVA"
              note="sin las ventas estimadas"
              data={rolled.map((b, i) => ({
                key: b.start,
                label: label(b),
                short: short(b, i),
                value: b.grossCents - b.returnedGrossCents,
              }))}
              format={euros}
            />
            <SeriesBars
              title="Visitas por día (90 días)"
              note={`${views} visitas · ${unboxing} aperturas 3D`}
              data={attentionDays.map((d, i) => ({
                key: d.day,
                label: dayLabel(d.day),
                short: i % 14 === 0 ? shortDayLabel(d.day) : '',
                value: d.view + d.scent_view,
              }))}
              format={(v) => `${v} visitas`}
            />
          </div>

          <h2 className="mb-2 text-lg font-semibold">Por formato</h2>
          <div className="mb-8 overflow-x-auto">
            <Table
              caption="Métricas por formato"
              stacked={false}
              density="compact"
              className="min-w-[60rem]"
            >
              <thead>
                <tr>
                  <th>Formato</th>
                  <th className="text-right">PVP</th>
                  <th className="text-right">Coste</th>
                  <th className="text-right">Margen teórico</th>
                  <th className="text-right">Uds netas</th>
                  <th className="text-right">Cobrado</th>
                  <th className="text-right">Ritmo</th>
                  <th className="text-right">Disponible</th>
                  <th className="text-right">Cobertura</th>
                  <th>Última venta</th>
                </tr>
              </thead>
              <tbody>
                {own.map((v) => {
                  const s = ownSeries.find((x) => x.variantId === v.variantId);
                  const buckets = (s?.buckets ?? []).filter((b) => b.days > 0);
                  const t = sumBuckets(buckets);
                  const rate = combinedDemandRate(s ? [s] : []).perDay;
                  const level = levels?.get(v.variantId);
                  const avail = level
                    ? Math.max(0, level.onHand - level.reserved)
                    : null;
                  const cost =
                    [...buckets].reverse().find((b) => b.costNetCents !== null)
                      ?.costNetCents ?? null;
                  const theoretical =
                    v.priceCents !== null && cost !== null
                      ? realizedMargin(
                          { grossCents: v.priceCents, cogsCents: cost },
                          VAT_GENERAL_BP,
                        ).marginBp
                      : null;
                  const lastSale =
                    [...buckets].reverse().find((b) => b.sold > 0)?.start ??
                    null;
                  return (
                    <tr key={v.variantId}>
                      <td>
                        {v.variantLabel}
                        {!v.active && (
                          <span className="text-fg-muted text-2xs">
                            {' '}
                            · inactivo
                          </span>
                        )}
                      </td>
                      <td className="text-right font-mono tabular-nums">
                        {v.priceCents === null ? '—' : euros(v.priceCents)}
                      </td>
                      <td className="text-right font-mono tabular-nums">
                        {cost === null ? '—' : euros(cost)}
                      </td>
                      <td className="text-right font-mono tabular-nums">
                        {percent(theoretical)}
                      </td>
                      <td className="text-right font-mono tabular-nums">
                        {netUnits(t)}
                      </td>
                      <td className="text-right font-mono tabular-nums">
                        {euros(t.grossCents - t.returnedGrossCents)}
                      </td>
                      <td className="text-right font-mono tabular-nums">
                        {perWeek(rate)}
                      </td>
                      <td className="text-right font-mono tabular-nums">
                        {avail ?? '—'}
                      </td>
                      <td className="text-right font-mono tabular-nums">
                        {(() => {
                          const c = coverageDays(avail, rate);
                          return c === null ? '—' : `${c} d`;
                        })()}
                      </td>
                      <td>
                        {lastSale
                          ? period.grain === 'day'
                            ? dayLabel(lastSale)
                            : `semana del ${dayLabel(lastSale)}`
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>

          <div className="grid grid-cols-2 gap-8">
            <section>
              <h2 className="mb-2 text-lg font-semibold">
                Cambios de PVP y de coste
              </h2>
              {events.length === 0 ? (
                <p className="text-fg-muted text-sm">
                  Sin cambios registrados.
                </p>
              ) : (
                <ul className="divide-border border-border divide-y border-y text-sm">
                  {[...events]
                    .sort((a, b) => b.at.localeCompare(a.at))
                    .slice(0, 20)
                    .map((e, i) => {
                      const v = variants.get(e.variantId);
                      return (
                        <li
                          key={`${e.variantId}-${e.at}-${i}`}
                          className="flex justify-between gap-4 py-2"
                        >
                          <span>
                            <span className="text-fg-muted">
                              {dayLabel(e.at.slice(0, 10))} · {v?.variantLabel}{' '}
                              ·{' '}
                            </span>
                            {e.kind === 'price' ? 'PVP' : 'Coste neto'}
                          </span>
                          <span className="font-mono tabular-nums">
                            {e.kind === 'price'
                              ? e.priceCents === null
                                ? 'sin PVP'
                                : euros(e.priceCents)
                              : e.costNetCents === null
                                ? '—'
                                : euros(e.costNetCents)}
                          </span>
                        </li>
                      );
                    })}
                </ul>
              )}
            </section>
            <section>
              <h2 className="mb-2 text-lg font-semibold">
                Respuesta al precio
              </h2>
              {hints.length === 0 ? (
                <p className="text-fg-muted text-sm">
                  Sin datos suficientes: hacen falta cambios de PVP con al menos
                  4 semanas con existencias antes y después y 10 unidades
                  vendidas.
                </p>
              ) : (
                <ul className="divide-border border-border divide-y border-y text-sm">
                  {hints.map((h) => (
                    <li key={h.at} className="py-2">
                      {dayLabel(h.at.slice(0, 10))}: de {euros(h.oldPriceCents)}{' '}
                      a {euros(h.newPriceCents)}, el ritmo pasó de{' '}
                      {perWeek(h.rateBefore)} a {perWeek(h.rateAfter)}
                      {h.elasticity !== null &&
                        ` (elasticidad ${h.elasticity.toLocaleString('es-ES')})`}
                      . Es una pista: la temporada o una promoción también
                      mueven las ventas.
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </main>
  );
}
