import type { Metadata } from 'next';
import {
  MODEL_PRICES,
  PRICING_SOURCE,
  addDays,
  dayRange,
  formatMicroUsd,
  integer,
  madridToday,
  shortDayLabel,
  usageCostMicroUsd,
} from '@/modules/control';
import type { AssistantUsageRow } from '@/modules/control/server';
import {
  getEnvStatus,
  listAssistantUsage,
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
import { Table } from '@/components/ui';

export const metadata: Metadata = { title: 'Asistente' };

const PERIODS = { '7': 7, '30': 30, '90': 90 } as const;
type PeriodKey = keyof typeof PERIODS;

const KINDS: Record<string, string> = {
  chat: 'Consultas del panel',
  daily_summary: 'Resumen del informe diario',
};

type Totals = {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  /** Solo de los modelos con precio en la tabla. */
  costMicroUsd: number;
};

function emptyTotals(): Totals {
  return {
    calls: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    costMicroUsd: 0,
  };
}

function add(totals: Totals, row: AssistantUsageRow) {
  const cost = usageCostMicroUsd(row);
  totals.calls += row.calls;
  totals.inputTokens += row.inputTokens;
  totals.outputTokens += row.outputTokens;
  totals.cacheReadTokens += row.cacheReadTokens;
  totals.costMicroUsd += cost ?? 0;
}

function groupBy(
  rows: readonly AssistantUsageRow[],
  key: (r: AssistantUsageRow) => string,
) {
  const groups = new Map<string, Totals>();
  for (const row of rows) {
    const k = key(row);
    const totals = groups.get(k) ?? emptyTotals();
    add(totals, row);
    groups.set(k, totals);
  }
  return [...groups.entries()].sort(
    (a, b) => b[1].calls - a[1].calls || a[0].localeCompare(b[0], 'es'),
  );
}

function tokens(n: number) {
  if (n >= 1_000_000)
    return `${(n / 1_000_000).toLocaleString('es-ES', { maximumFractionDigits: 2 })} M`;
  if (n >= 10_000)
    return `${(n / 1000).toLocaleString('es-ES', { maximumFractionDigits: 1 })} k`;
  return integer(n);
}

function UsageTable({
  caption,
  label,
  groups,
  names = (k: string) => k,
}: {
  caption: string;
  label: string;
  groups: [string, Totals][];
  names?: (key: string) => string;
}) {
  return (
    <Table caption={caption} stacked={false} density="compact">
      <thead>
        <tr>
          <th>{label}</th>
          <th className="text-right">Llamadas</th>
          <th className="text-right">Entrada</th>
          <th className="text-right">Salida</th>
          <th className="text-right">Caché</th>
          <th className="text-right">Coste</th>
        </tr>
      </thead>
      <tbody>
        {groups.map(([key, t]) => (
          <tr key={key}>
            <td>{names(key)}</td>
            <td className="text-right font-mono tabular-nums">
              {integer(t.calls)}
            </td>
            <td className="text-right font-mono tabular-nums">
              {tokens(t.inputTokens)}
            </td>
            <td className="text-right font-mono tabular-nums">
              {tokens(t.outputTokens)}
            </td>
            <td className="text-right font-mono tabular-nums">
              {tokens(t.cacheReadTokens)}
            </td>
            <td className="text-right font-mono tabular-nums">
              {formatMicroUsd(t.costMicroUsd)}
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

export default async function AssistantPage({
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
  const [rows, previousRows] = await Promise.all([
    listAssistantUsage(supabase, from, to),
    listAssistantUsage(supabase, previousFrom, from),
  ]);
  const env = getEnvStatus();
  const apiKey =
    env.variables.find((v) => v.name === 'ANTHROPIC_API_KEY')?.configured ??
    false;

  const total = emptyTotals();
  for (const row of rows) add(total, row);
  const previous = emptyTotals();
  for (const row of previousRows) add(previous, row);
  const unpriced = [
    ...new Set(rows.map((r) => r.model).filter((m) => !MODEL_PRICES[m])),
  ];

  const byDay = new Map<string, Totals>();
  for (const row of rows) {
    const totals = byDay.get(row.day) ?? emptyTotals();
    add(totals, row);
    byDay.set(row.day, totals);
  }
  const series = dayRange(from, to).map((day) => ({
    key: day,
    label: shortDayLabel(day),
    short: days <= 30 ? shortDayLabel(day).split(' ')[0]! : '',
    calls: byDay.get(day)?.calls ?? 0,
    cost: byDay.get(day)?.costMicroUsd ?? 0,
  }));

  const chatToday = rows
    .filter((r) => r.day === today && r.kind === 'chat')
    .reduce(
      (map, r) => map.set(r.person, (map.get(r.person) ?? 0) + r.calls),
      new Map<string, number>(),
    );
  const topToday = Math.max(0, ...chatToday.values());

  return (
    <main>
      <ConsoleHeader
        section="Sistema"
        title="Uso y coste del asistente"
        description="Llamadas a la API de Anthropic del asistente del panel y del resumen del informe diario, con su coste estimado."
      >
        <FilterLinks
          label="Periodo"
          options={(Object.keys(PERIODS) as PeriodKey[]).map((p) => ({
            href: `/admin/control/asistente?periodo=${p}`,
            label: `${p} días`,
            active: p === period,
          }))}
        />
      </ConsoleHeader>

      {!apiKey && (
        <div className="mb-6">
          <ConsoleNotice
            tone="warning"
            title="ANTHROPIC_API_KEY no está configurada en este entorno"
          >
            <p>El asistente y el resumen del informe diario no funcionan.</p>
          </ConsoleNotice>
        </div>
      )}

      <div className="grid grid-cols-4 gap-3">
        <KeyFigure
          label={`Coste ${days} días`}
          value={formatMicroUsd(total.costMicroUsd)}
          note={`Periodo anterior: ${formatMicroUsd(previous.costMicroUsd)}`}
        />
        <KeyFigure
          label="Llamadas"
          value={integer(total.calls)}
          note={`Periodo anterior: ${integer(previous.calls)}`}
        />
        <KeyFigure
          label="Tokens"
          value={tokens(total.inputTokens + total.outputTokens)}
          note={`${tokens(total.inputTokens)} entrada · ${tokens(total.outputTokens)} salida · ${tokens(total.cacheReadTokens)} caché`}
        />
        <KeyFigure
          label="Límite diario"
          value={`${topToday}/${env.assistantDailyLimit}`}
          tone={topToday >= env.assistantDailyLimit ? 'alert' : 'default'}
          note="Consultas de hoy de quien más ha usado, frente al límite por persona"
        />
      </div>

      <div className="mt-8 grid grid-cols-2 gap-8">
        <SeriesBars
          title="Llamadas por día"
          data={series.map((d) => ({
            key: d.key,
            label: d.label,
            short: d.short,
            value: d.calls,
          }))}
          format={(v) => `${integer(v)} llamadas`}
        />
        <SeriesBars
          title="Coste por día"
          data={series.map((d) => ({
            key: d.key,
            label: d.label,
            short: d.short,
            value: d.cost,
          }))}
          format={formatMicroUsd}
        />
      </div>

      {rows.length === 0 ? (
        <p className="text-fg-muted border-border mt-10 border-y py-8 text-center text-sm">
          Sin uso del asistente en este periodo.
        </p>
      ) : (
        <div className="mt-10 grid grid-cols-2 gap-8">
          <ConsoleSection id="personas" title="Por persona" className="">
            <UsageTable
              caption="Uso del asistente por persona"
              label="Persona"
              groups={groupBy(rows, (r) => r.person)}
            />
          </ConsoleSection>
          <ConsoleSection id="tipos" title="Por uso y modelo" className="">
            <UsageTable
              caption="Uso del asistente por tipo"
              label="Uso"
              groups={groupBy(rows, (r) => r.kind)}
              names={(k) => KINDS[k] ?? k}
            />
            <div className="mt-4">
              <UsageTable
                caption="Uso del asistente por modelo"
                label="Modelo"
                groups={groupBy(rows, (r) => r.model)}
              />
            </div>
          </ConsoleSection>
        </div>
      )}

      <p className="text-fg-muted mt-8 max-w-3xl text-xs leading-relaxed">
        {PRICING_SOURCE} Es una estimación: el registro no guarda la escritura
        de caché, así que el coste real puede ser algo mayor.
        {unpriced.length > 0 &&
          ` Sin precio en la tabla (no se suman): ${unpriced.join(', ')}.`}
      </p>
    </main>
  );
}
