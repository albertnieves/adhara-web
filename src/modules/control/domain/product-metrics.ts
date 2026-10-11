import type { BasisPoints, Cents } from '@/lib/money';
import { BASIS_POINTS, grossToNet, ratioBp } from '@/lib/money';
import { changeBp } from './business';
import type { IsoDate } from './months';
import { daysBetween, madridToday } from './months';

/**
 * Métricas por producto de la consola del titular, a partir de la serie de
 * admin_control_variant_series (migración 20261011090100): un tramo por día,
 * semana ISO o mes de Madrid, también los vacíos.
 *
 * Hoy hay muy pocas ventas: cada métrica exige un mínimo de datos y, si no lo
 * hay, devuelve null o «insufficient» en vez de una cifra que engañe. Los
 * importes van en céntimos enteros y los porcentajes en puntos básicos; los
 * ritmos (unidades por día), los índices y la elasticidad son decimales solo
 * para mostrar.
 */

export const GRAINS = ['day', 'week', 'month'] as const;
export type Grain = (typeof GRAINS)[number];
export const GRAIN_LABELS: Readonly<Record<Grain, string>> = {
  day: 'Día',
  week: 'Semana',
  month: 'Mes',
};

/** Un tramo de la serie de un formato (claves del jsonb de la base entre paréntesis). */
export type SeriesBucket = {
  /** Primer día del tramo (b). */
  start: IsoDate;
  /** Unidades vendidas por cualquier vía (sold). */
  sold: number;
  /** Unidades devueltas (ret). */
  returned: number;
  /** Mermas y probadores (lost). */
  lost: number;
  /** Entradas: compras recibidas y traspasos (rec). */
  received: number;
  /** Vendidas con precio cobrado: hoy, las del mostrador (psold). */
  pricedSold: number;
  /** Cobrado con IVA de lo vendido (gross). */
  grossCents: Cents;
  /** PVP del momento × unidades de las líneas con precio y PVP (list). */
  listCents: Cents;
  /** Cobrado de lo devuelto (rgross). */
  returnedGrossCents: Cents;
  /** Coste neto de lo vendido menos el de lo devuelto (cogs). */
  cogsCents: Cents;
  /** Unidades vendidas o devueltas sin coste registrado (unc). */
  uncosted: number;
  /** Ventas de mostrador distintas (tickets). */
  tickets: number;
  /** Existencias al cierre, todas las ubicaciones (close). */
  closingOnHand: number;
  /** Días con existencias al empezar el día o con alguna venta (instock). */
  inStockDays: number;
  /** Días del tramo dentro del periodo y no posteriores a hoy (days). */
  days: number;
  /** PVP vigente al cierre (pvp); null si no hay historial. */
  retailPriceCents: Cents | null;
  /** Coste neto vigente al cierre (cost); null si no había ninguno. */
  costNetCents: Cents | null;
};

export type VariantSeries = { variantId: string; buckets: SeriesBucket[] };

/** Totales de una serie; existencias, PVP y coste son los del final. */
export type SeriesTotals = Omit<
  SeriesBucket,
  'start' | 'closingOnHand' | 'retailPriceCents' | 'costNetCents'
> & {
  closingOnHand: number | null;
  retailPriceCents: Cents | null;
  costNetCents: Cents | null;
};

/** Ritmo de venta en unidades por día. */
export type DemandRate = {
  /** Netas / días con existencias: corrige la demanda censurada por roturas. */
  perDay: number | null;
  /** Netas / días observados, sin corregir. */
  rawPerDay: number | null;
  /** Días con existencias sobre días observados, en puntos básicos. */
  inStockShare: BasisPoints | null;
};

export type TrendDirection = 'up' | 'down' | 'flat' | 'insufficient';
export type Trend = {
  /** Últimos `window` tramos frente a los `window` anteriores. */
  changeBp: BasisPoints | null;
  /** Pendiente de Theil–Sen sobre la media de esos tramos, por tramo. */
  slopeBpPerPeriod: BasisPoints | null;
  direction: TrendDirection;
};

export type DemandKind =
  'smooth' | 'erratic' | 'intermittent' | 'lumpy' | 'insufficient';
export type DemandPattern = {
  /** Intervalo medio entre tramos con venta. */
  adi: number | null;
  /** Cuadrado del coeficiente de variación de las ventas no nulas. */
  cv2: number | null;
  kind: DemandKind;
};

/** Unidades previstas: esperadas y el intervalo del 80 % (Poisson). */
export type Forecast = { expected: number; low: number; high: number };

export type AbcClass = 'A' | 'B' | 'C';
export type XyzClass = 'X' | 'Y' | 'Z';

export type RealizedMargin = {
  netCents: Cents;
  marginCents: Cents;
  marginBp: BasisPoints | null;
};

/** Un cambio del historial de PVP: el precio vigente desde `at`. */
export type PriceEvent = { at: string; priceCents: Cents | null };

export type ElasticityHint = {
  at: string;
  oldPriceCents: Cents;
  newPriceCents: Cents;
  /** Unidades netas por día con existencias antes y después del cambio. */
  rateBefore: number;
  rateAfter: number;
  /** Elasticidad de arco (punto medio), con dos decimales. */
  elasticity: number | null;
  /** Falso con menos de MIN_ELASTICITY_UNITS unidades en las dos ventanas. */
  conclusive: boolean;
};

/** Un ritmo necesita al menos estos días observados… */
export const MIN_RATE_DAYS = 7;
/** …y, con menos de estas unidades, LONG_RATE_DAYS días. */
export const MIN_RATE_UNITS = 3;
export const LONG_RATE_DAYS = 28;
/** Unidades mínimas en los tramos comparados para dar tendencia o XYZ. */
export const MIN_TREND_UNITS = 5;
/** Una variación menor (10 %) es estable. */
export const FLAT_TREND_BP = 1_000;
/** Tramos con venta mínimos para clasificar la demanda. */
export const MIN_DEMAND_PERIODS = 3;
/** Umbrales de Syntetos–Boylan. */
export const ADI_CUTOFF = 1.32;
export const CV2_CUTOFF = 0.49;
/** Tramos mínimos para la clase XYZ. */
export const MIN_XYZ_PERIODS = 4;
/** Por encima, el intervalo de Poisson usa la aproximación normal. */
export const NORMAL_LAMBDA = 100;
/** Horizonte de la previsión de la tabla de productos. */
export const FORECAST_DAYS = 28;
export const MIN_ELASTICITY_UNITS = 10;

// ---------------------------------------------------------------------------
// Utilidades numéricas
// ---------------------------------------------------------------------------

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function mean(values: readonly number[]): number {
  return sum(values) / values.length;
}

/** Redondeo sin «−0». */
function roundInt(value: number): number {
  return Math.round(value) || 0;
}

/** Cuantil con interpolación lineal (tipo 7 de R); null sin valores. */
export function quantile(values: readonly number[], q: number): number | null {
  if (!(q >= 0 && q <= 1)) throw new RangeError('Cuantil fuera de 0–1');
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const below = sorted[lower] ?? 0;
  const above = sorted[Math.ceil(position)] ?? below;
  return below + (above - below) * (position - lower);
}

// ---------------------------------------------------------------------------
// Serie de la base de datos
// ---------------------------------------------------------------------------

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function unexpected(): Error {
  return new Error('Serie inesperada de la base de datos');
}

function integer(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw unexpected();
  }
  return value;
}

function nullableInteger(value: unknown): number | null {
  return value === null ? null : integer(value);
}

/** El jsonb `series` de admin_control_variant_series, ya validado. */
export function parseSeriesBuckets(value: unknown): SeriesBucket[] {
  if (!Array.isArray(value)) throw unexpected();
  return value.map((item: unknown) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw unexpected();
    }
    const raw = item as Record<string, unknown>;
    if (typeof raw.b !== 'string' || !ISO_DATE.test(raw.b)) throw unexpected();
    return {
      start: raw.b,
      sold: integer(raw.sold),
      returned: integer(raw.ret),
      lost: integer(raw.lost),
      received: integer(raw.rec),
      pricedSold: integer(raw.psold),
      grossCents: integer(raw.gross),
      listCents: integer(raw.list),
      returnedGrossCents: integer(raw.rgross),
      cogsCents: integer(raw.cogs),
      uncosted: integer(raw.unc),
      tickets: integer(raw.tickets),
      closingOnHand: integer(raw.close),
      inStockDays: integer(raw.instock),
      days: integer(raw.days),
      retailPriceCents: nullableInteger(raw.pvp),
      costNetCents: nullableInteger(raw.cost),
    };
  });
}

/** Días naturales de un tramo completo que empieza en `start`. */
export function bucketDays(start: IsoDate, grain: Grain): number {
  if (grain === 'day') return 1;
  if (grain === 'week') return 7;
  const [year, month] = start.split('-').map(Number);
  // El día 0 del mes siguiente es el último de este.
  return new Date(Date.UTC(year ?? 0, month ?? 0, 0)).getUTCDate();
}

/** Tramo completo: todos sus días son pasados o de hoy. */
export function isCompleteBucket(bucket: SeriesBucket, grain: Grain): boolean {
  return bucket.days >= bucketDays(bucket.start, grain);
}

function isIdle(bucket: SeriesBucket): boolean {
  return (
    bucket.closingOnHand === 0 &&
    bucket.inStockDays === 0 &&
    bucket.sold === 0 &&
    bucket.returned === 0 &&
    bucket.lost === 0 &&
    bucket.received === 0
  );
}

/**
 * Sin los tramos iniciales sin existencias ni movimientos: puede que el
 * formato aún no existiera, y contarlos como roturas inventaría demanda
 * perdida. Si ya estaba agotado antes del periodo, se pierde esa parte (la
 * cifra queda corta, nunca inflada).
 */
export function activeBuckets(
  buckets: readonly SeriesBucket[],
): SeriesBucket[] {
  const first = buckets.findIndex((bucket) => !isIdle(bucket));
  return first === -1 ? [] : buckets.slice(first);
}

// ---------------------------------------------------------------------------
// Totales
// ---------------------------------------------------------------------------

/** Vendidas menos devueltas. */
export function netUnits(
  bucket: Pick<SeriesBucket, 'sold' | 'returned'>,
): number {
  return bucket.sold - bucket.returned;
}

/** Totales de la serie; existencias del último tramo y PVP y coste del último con dato. */
export function sumBuckets(buckets: readonly SeriesBucket[]): SeriesTotals {
  const totals: SeriesTotals = {
    sold: 0,
    returned: 0,
    lost: 0,
    received: 0,
    pricedSold: 0,
    grossCents: 0,
    listCents: 0,
    returnedGrossCents: 0,
    cogsCents: 0,
    uncosted: 0,
    tickets: 0,
    inStockDays: 0,
    days: 0,
    closingOnHand: null,
    retailPriceCents: null,
    costNetCents: null,
  };
  for (const b of buckets) {
    totals.sold += b.sold;
    totals.returned += b.returned;
    totals.lost += b.lost;
    totals.received += b.received;
    totals.pricedSold += b.pricedSold;
    totals.grossCents += b.grossCents;
    totals.listCents += b.listCents;
    totals.returnedGrossCents += b.returnedGrossCents;
    totals.cogsCents += b.cogsCents;
    totals.uncosted += b.uncosted;
    totals.tickets += b.tickets;
    totals.inStockDays += b.inStockDays;
    totals.days += b.days;
    totals.closingOnHand = b.closingOnHand;
    totals.retailPriceCents = b.retailPriceCents ?? totals.retailPriceCents;
    totals.costNetCents = b.costNetCents ?? totals.costNetCents;
  }
  return totals;
}

/**
 * Suma por fecha de varios formatos (un perfume). Existencias y unidades se
 * suman; PVP y coste quedan en null porque cada formato tiene los suyos;
 * `days` es el del periodo y `inStockDays` el del formato con más días con
 * existencias (cota inferior de los días en que hubo alguno). Los tickets se
 * suman por formato: una venta con dos formatos cuenta dos veces. Para el
 * ritmo de varios formatos, mejor combinedDemandRate.
 */
export function rollupSeries(series: readonly VariantSeries[]): SeriesBucket[] {
  const byStart = new Map<IsoDate, SeriesBucket>();
  for (const { buckets } of series) {
    for (const b of buckets) {
      const row = byStart.get(b.start);
      if (!row) {
        byStart.set(b.start, {
          ...b,
          retailPriceCents: null,
          costNetCents: null,
        });
        continue;
      }
      row.sold += b.sold;
      row.returned += b.returned;
      row.lost += b.lost;
      row.received += b.received;
      row.pricedSold += b.pricedSold;
      row.grossCents += b.grossCents;
      row.listCents += b.listCents;
      row.returnedGrossCents += b.returnedGrossCents;
      row.cogsCents += b.cogsCents;
      row.uncosted += b.uncosted;
      row.tickets += b.tickets;
      row.closingOnHand += b.closingOnHand;
      row.inStockDays = Math.max(row.inStockDays, b.inStockDays);
      row.days = Math.max(row.days, b.days);
    }
  }
  return [...byStart.values()].sort((a, b) => a.start.localeCompare(b.start));
}

// ---------------------------------------------------------------------------
// Demanda
// ---------------------------------------------------------------------------

/** Unidades por día, o null si los datos no bastan para un ritmo. */
function rateFrom(units: number, days: number): number | null {
  if (days < MIN_RATE_DAYS) return null;
  if (units < MIN_RATE_UNITS && days < LONG_RATE_DAYS) return null;
  return units / days;
}

type DemandParts = { units: number; days: number; inStockDays: number };

function demandParts(buckets: readonly SeriesBucket[]): DemandParts {
  let net = 0;
  let days = 0;
  let inStockDays = 0;
  for (const b of activeBuckets(buckets)) {
    net += netUnits(b);
    days += b.days;
    inStockDays += b.inStockDays;
  }
  // Más devoluciones que ventas no es demanda negativa.
  return { units: Math.max(0, net), days, inStockDays };
}

function rateOf(parts: DemandParts): DemandRate {
  return {
    perDay: rateFrom(parts.units, parts.inStockDays),
    rawPerDay: rateFrom(parts.units, parts.days),
    inStockShare:
      parts.days > 0 ? ratioBp(parts.inStockDays, parts.days) : null,
  };
}

/**
 * Ritmo de un formato. Una venta suelta en pocos días no es un ritmo: hacen
 * falta MIN_RATE_DAYS días y, con menos de MIN_RATE_UNITS unidades,
 * LONG_RATE_DAYS (entonces cero ventas sí dicen algo).
 */
export function demandRate(buckets: readonly SeriesBucket[]): DemandRate {
  return rateOf(demandParts(buckets));
}

/**
 * Ritmo de varios formatos (un perfume): la suma de los ritmos de cada uno,
 * cada cual corregido por sus propias roturas. Los formatos sin datos
 * suficientes no suman (la cifra queda corta, nunca inflada); null si
 * ninguno los tiene. La parte con existencias es la de formato-días.
 */
export function combinedDemandRate(
  series: readonly VariantSeries[],
): DemandRate {
  const parts = series.map((s) => demandParts(s.buckets));
  const rates = parts.map(rateOf);
  const known = (values: (number | null)[]) => {
    const present = values.filter((v): v is number => v !== null);
    return present.length > 0 ? sum(present) : null;
  };
  const days = sum(parts.map((p) => p.days));
  return {
    perDay: known(rates.map((r) => r.perDay)),
    rawPerDay: known(rates.map((r) => r.rawPerDay)),
    inStockShare:
      days > 0 ? ratioBp(sum(parts.map((p) => p.inStockDays)), days) : null,
  };
}

/** Unidades que se habrían vendido en los días sin existencias, redondeadas. */
export function estimatedLostUnits(
  buckets: readonly SeriesBucket[],
): number | null {
  const parts = demandParts(buckets);
  const { perDay } = rateOf(parts);
  if (perDay === null) return null;
  return roundInt(perDay * (parts.days - parts.inStockDays));
}

// ---------------------------------------------------------------------------
// Suavizado y tendencia
// ---------------------------------------------------------------------------

function assertWindow(window: number) {
  if (!Number.isSafeInteger(window) || window < 1) {
    throw new RangeError('La ventana debe ser un entero positivo');
  }
}

/** Media de los `window` últimos valores en cada punto; null hasta tenerlos. */
export function movingAverage(
  values: readonly number[],
  window: number,
): (number | null)[] {
  assertWindow(window);
  return values.map((_, i) =>
    i + 1 < window ? null : mean(values.slice(i + 1 - window, i + 1)),
  );
}

/** Suavizado exponencial simple, empezando en el primer valor. */
export function exponentialSmoothing(
  values: readonly number[],
  alpha = 0.3,
): number[] {
  if (!(alpha > 0 && alpha <= 1)) {
    throw new RangeError('alpha debe estar entre 0 (excluido) y 1');
  }
  const smoothed: number[] = [];
  values.forEach((value, i) => {
    const previous = smoothed[i - 1];
    smoothed.push(
      previous === undefined ? value : alpha * value + (1 - alpha) * previous,
    );
  });
  return smoothed;
}

/** Mediana de las pendientes entre cada par de puntos; null con menos de dos. */
export function theilSenSlope(values: readonly number[]): number | null {
  const slopes: number[] = [];
  values.forEach((a, i) => {
    values.slice(i + 1).forEach((b, k) => slopes.push((b - a) / (k + 1)));
  });
  return quantile(slopes, 0.5);
}

function relativeChangeBp(
  current: number,
  previous: number,
): BasisPoints | null {
  if (Number.isSafeInteger(current) && Number.isSafeInteger(previous)) {
    return changeBp(current, previous);
  }
  if (previous === 0) return null;
  return roundInt(((current - previous) / Math.abs(previous)) * BASIS_POINTS);
}

const NO_TREND: Trend = {
  changeBp: null,
  slopeBpPerPeriod: null,
  direction: 'insufficient',
};

/**
 * Tendencia de los 2 × `window` últimos tramos (completos: uno a medias la
 * hundiría). Sin tantos tramos o con menos de MIN_TREND_UNITS unidades en
 * ellos, «insufficient».
 */
export function trend(
  values: readonly number[],
  { window = 4 }: { window?: number } = {},
): Trend {
  assertWindow(window);
  if (values.length < 2 * window) return NO_TREND;
  const span = values.slice(-2 * window);
  const total = sum(span);
  if (total < MIN_TREND_UNITS) return NO_TREND;
  const previous = sum(span.slice(0, window));
  const current = sum(span.slice(window));
  const change = relativeChangeBp(current, previous);
  const slope = theilSenSlope(span);
  const average = total / span.length;
  let direction: TrendDirection;
  if (change === null) direction = current > previous ? 'up' : 'flat';
  else if (Math.abs(change) < FLAT_TREND_BP) direction = 'flat';
  else direction = change > 0 ? 'up' : 'down';
  return {
    changeBp: change,
    slopeBpPerPeriod:
      slope === null ? null : roundInt((slope / average) * BASIS_POINTS),
    direction,
  };
}

/**
 * Patrón de demanda de Syntetos–Boylan: ADI = tramos / tramos con venta y
 * CV² de las ventas no nulas. Regular (smooth), errática, intermitente o
 * irregular (lumpy); con menos de MIN_DEMAND_PERIODS tramos con venta,
 * «insufficient».
 */
export function demandPattern(values: readonly number[]): DemandPattern {
  const sizes = values.filter((value) => value > 0);
  if (sizes.length < MIN_DEMAND_PERIODS) {
    return { adi: null, cv2: null, kind: 'insufficient' };
  }
  const adi = values.length / sizes.length;
  const average = mean(sizes);
  const cv2 = mean(sizes.map((size) => (size - average) ** 2)) / average ** 2;
  const frequent = adi < ADI_CUTOFF;
  const regular = cv2 < CV2_CUTOFF;
  const kind: DemandKind = frequent
    ? regular
      ? 'smooth'
      : 'erratic'
    : regular
      ? 'intermittent'
      : 'lumpy';
  return { adi, cv2, kind };
}

// ---------------------------------------------------------------------------
// Previsión
// ---------------------------------------------------------------------------

function polynomial(coefficients: readonly number[], x: number): number {
  return coefficients.reduce((acc, c) => acc * x + c, 0);
}

// Inversa de la normal de Acklam (error relativo < 1,2 · 10⁻⁹).
const ACKLAM_A = [
  -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
  1.38357751867269e2, -3.066479806614716e1, 2.506628277459239,
];
const ACKLAM_B = [
  -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
  6.680131188771972e1, -1.328068155288572e1, 1,
];
const ACKLAM_C = [
  -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
  -2.549732539343734, 4.374664141464968, 2.938163982698783,
];
const ACKLAM_D = [
  7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
  3.754408661907416, 1,
];
const ACKLAM_TAIL = 0.02425;

/** Cuantil de la normal estándar. */
export function normalQuantile(p: number): number {
  if (!(p > 0 && p < 1)) throw new RangeError('Probabilidad fuera de (0, 1)');
  if (p < ACKLAM_TAIL || p > 1 - ACKLAM_TAIL) {
    const q = Math.sqrt(-2 * Math.log(Math.min(p, 1 - p)));
    const z = polynomial(ACKLAM_C, q) / polynomial(ACKLAM_D, q);
    return p < ACKLAM_TAIL ? z : -z;
  }
  const q = p - 0.5;
  const r = q * q;
  return (polynomial(ACKLAM_A, r) * q) / polynomial(ACKLAM_B, r);
}

/** Menor k con P(X ≤ k) ≥ q para X ~ Poisson(λ). */
function poissonQuantile(lambda: number, q: number): number {
  if (lambda > NORMAL_LAMBDA) {
    // Aproximación normal con corrección de continuidad.
    return Math.max(
      0,
      Math.ceil(lambda + normalQuantile(q) * Math.sqrt(lambda) - 0.5),
    );
  }
  let k = 0;
  let term = Math.exp(-lambda);
  let cdf = term;
  // El tope solo protege de un bucle sin fin por redondeo.
  const cap = lambda + 20 * Math.sqrt(lambda) + 20;
  while (cdf < q && k < cap) {
    k += 1;
    term *= lambda / k;
    cdf += term;
  }
  return k;
}

/** Intervalo de unidades de una Poisson(λ): cuantiles `low` y `high`. */
export function poissonInterval(
  lambda: number,
  { low = 0.1, high = 0.9 }: { low?: number; high?: number } = {},
): { low: number; high: number } {
  if (!Number.isFinite(lambda) || lambda < 0) {
    throw new RangeError('λ debe ser un número no negativo');
  }
  if (!(low > 0 && low < high && high < 1)) {
    throw new RangeError('Cuantiles fuera de 0 < low < high < 1');
  }
  return {
    low: poissonQuantile(lambda, low),
    high: poissonQuantile(lambda, high),
  };
}

/** Unidades previstas en `horizonDays` días al ritmo dado; null sin ritmo. */
export function forecast(
  perDay: number | null,
  horizonDays: number,
): Forecast | null {
  if (!Number.isSafeInteger(horizonDays) || horizonDays <= 0) {
    throw new RangeError('El horizonte debe ser un entero positivo de días');
  }
  if (perDay === null) return null;
  if (!Number.isFinite(perDay) || perDay < 0) {
    throw new RangeError('El ritmo debe ser un número no negativo');
  }
  const lambda = perDay * horizonDays;
  return { expected: roundInt(lambda), ...poissonInterval(lambda) };
}

/**
 * Días que cubre el disponible al ritmo dado (hacia abajo). Null sin ritmo o
 * sin demanda: sin ventas no hay cobertura que calcular.
 */
export function coverageDays(
  available: number | null,
  perDay: number | null,
): number | null {
  if (available === null || perDay === null || !(perDay > 0)) return null;
  if (available <= 0) return 0;
  return Math.floor(available / perDay);
}

// ---------------------------------------------------------------------------
// Clasificación
// ---------------------------------------------------------------------------

/**
 * Pareto por valor acumulado: A hasta el `a` del total (incluido el que lo
 * cruza), B hasta el `b`, y C el resto. Valor ≤ 0, C.
 */
export function abcClasses(
  items: readonly { id: string; value: number }[],
  { a = 0.8, b = 0.95 }: { a?: number; b?: number } = {},
): Map<string, AbcClass> {
  if (!(a > 0 && a < b && b <= 1)) {
    throw new RangeError('Umbrales fuera de 0 < a < b ≤ 1');
  }
  const classes = new Map<string, AbcClass>();
  const positive = items
    .filter((item) => item.value > 0)
    .sort((x, y) => y.value - x.value || x.id.localeCompare(y.id));
  const total = sum(positive.map((item) => item.value));
  let before = 0;
  for (const item of positive) {
    if (classes.has(item.id)) continue;
    const share = before / total;
    classes.set(item.id, share < a ? 'A' : share < b ? 'B' : 'C');
    before += item.value;
  }
  for (const item of items) {
    if (!classes.has(item.id)) classes.set(item.id, 'C');
  }
  return classes;
}

/**
 * Regularidad por coeficiente de variación de los tramos: X < 0,5, Y < 1 y
 * Z el resto. Null con menos de MIN_XYZ_PERIODS tramos o de MIN_TREND_UNITS
 * unidades.
 */
export function xyzClass(values: readonly number[]): XyzClass | null {
  if (values.length < MIN_XYZ_PERIODS) return null;
  const total = sum(values);
  if (total < MIN_TREND_UNITS) return null;
  const average = total / values.length;
  const deviation = Math.sqrt(
    mean(values.map((value) => (value - average) ** 2)),
  );
  const cv = deviation / average;
  return cv < 0.5 ? 'X' : cv < 1 ? 'Y' : 'Z';
}

// ---------------------------------------------------------------------------
// Dinero
// ---------------------------------------------------------------------------

/** Ventas netas (sin IVA), margen bruto y su porcentaje sobre las netas. */
export function realizedMargin(
  { grossCents, cogsCents }: { grossCents: Cents; cogsCents: Cents },
  vatBp: BasisPoints,
): RealizedMargin {
  const netCents = grossToNet(grossCents, vatBp);
  const marginCents = netCents - cogsCents;
  return {
    netCents,
    marginCents,
    marginBp: netCents > 0 ? ratioBp(marginCents, netCents) : null,
  };
}

/** Descuento medio sobre el PVP: (PVP − cobrado) / PVP; null sin PVP. */
export function discountDepthBp(
  grossCents: Cents,
  listCents: Cents,
): BasisPoints | null {
  return listCents > 0 ? ratioBp(listCents - grossCents, listCents) : null;
}

/** Vendido sobre lo que había para vender (disponible + vendido). */
export function sellThroughBp(
  sold: number,
  stockBase: number,
): BasisPoints | null {
  return stockBase > 0 ? ratioBp(Math.max(0, sold), stockBase) : null;
}

// ---------------------------------------------------------------------------
// Elasticidad
// ---------------------------------------------------------------------------

/**
 * Posición del día en la serie: índice del tramo que lo contiene, -1 si es
 * anterior y `buckets.length` si es posterior a lo observado.
 */
function bucketIndexOf(buckets: readonly SeriesBucket[], day: IsoDate) {
  let index = -1;
  for (const [i, bucket] of buckets.entries()) {
    if (bucket.start > day) break;
    index = i;
  }
  const last = buckets[index];
  if (
    index === buckets.length - 1 &&
    last !== undefined &&
    daysBetween(last.start, day) >= last.days
  ) {
    return buckets.length;
  }
  return index;
}

function windowRate(window: readonly SeriesBucket[]) {
  const units = Math.max(0, sum(window.map(netUnits)));
  const days = sum(window.map((b) => b.inStockDays));
  return { units, rate: units / days };
}

/**
 * Pistas de elasticidad al precio: por cada cambio de PVP con `minWeeks`
 * tramos con existencias antes y después (sin cruzar otro cambio ni contar el
 * tramo del cambio), el ritmo por día con existencias de cada lado y la
 * elasticidad de arco. Son pistas, no causas: la temporada o la promoción
 * también mueven las ventas.
 */
export function elasticityHints(
  buckets: readonly SeriesBucket[],
  priceEvents: readonly PriceEvent[],
  { minWeeks = 4 }: { minWeeks?: number } = {},
): ElasticityHint[] {
  assertWindow(minWeeks);
  const observed = buckets.filter((b) => b.days > 0);
  const events = [...priceEvents].sort(
    (x, y) => Date.parse(x.at) - Date.parse(y.at),
  );
  // Cada cambio de PVP (también a o desde «sin PVP») corta las ventanas.
  const changes: {
    at: string;
    oldPriceCents: Cents | null | undefined;
    newPriceCents: Cents | null;
    index: number;
  }[] = [];
  let current: Cents | null | undefined;
  for (const event of events) {
    if (event.priceCents !== current) {
      changes.push({
        at: event.at,
        oldPriceCents: current,
        newPriceCents: event.priceCents,
        index: bucketIndexOf(observed, madridToday(new Date(event.at))),
      });
    }
    current = event.priceCents;
  }

  const hints: ElasticityHint[] = [];
  changes.forEach((change, i) => {
    const { oldPriceCents, newPriceCents } = change;
    if (
      oldPriceCents === null ||
      oldPriceCents === undefined ||
      newPriceCents === null
    ) {
      return;
    }
    const lower = changes[i - 1]?.index ?? -1;
    const upper = changes[i + 1]?.index ?? observed.length;
    const withStock = (from: number, to: number) =>
      observed
        .slice(Math.max(0, from), Math.max(0, to))
        .filter((b) => b.inStockDays > 0);
    const before = withStock(lower + 1, change.index).slice(-minWeeks);
    const after = withStock(change.index + 1, upper).slice(0, minWeeks);
    if (before.length < minWeeks || after.length < minWeeks) return;
    const b = windowRate(before);
    const a = windowRate(after);
    const quantityMid = (a.rate + b.rate) / 2;
    const priceMid = (newPriceCents + oldPriceCents) / 2;
    const elasticity =
      quantityMid > 0 && priceMid > 0
        ? (a.rate - b.rate) /
          quantityMid /
          ((newPriceCents - oldPriceCents) / priceMid)
        : null;
    hints.push({
      at: change.at,
      oldPriceCents,
      newPriceCents,
      rateBefore: b.rate,
      rateAfter: a.rate,
      elasticity: elasticity === null ? null : roundInt(elasticity * 100) / 100,
      conclusive: b.units + a.units >= MIN_ELASTICITY_UNITS,
    });
  });
  return hints;
}

// ---------------------------------------------------------------------------
// Fila de la tabla de productos
// ---------------------------------------------------------------------------

export type ProductRowInput = {
  productId: string;
  /** Series de sus formatos (las de admin_control_variant_series). */
  series: readonly VariantSeries[];
  /** Disponible ahora (existencias − reservas) de todos sus formatos. */
  available: number | null;
  vatBp: BasisPoints;
  /** Grano de las series; la tabla usa semanas. */
  grain?: Grain;
  horizonDays?: number;
};

export type ProductRow = {
  productId: string;
  /** Netas de los 4 y 12 últimos tramos hasta hoy (el actual, aunque vaya a medias). */
  units4: number;
  units12: number;
  /**
   * Ventas con IVA de los 12 últimos tramos: cobrado − devuelto, más lo
   * vendido sin precio cobrado estimado con el PVP del tramo (como en Ventas
   * y beneficio). Las devoluciones sin precio no se descuentan.
   */
  salesCents: Cents;
  estimatedCents: Cents;
  /** Vendidas sin precio cobrado ni PVP: no cuentan en las ventas. */
  unpricedUnits: number;
  netSalesCents: Cents;
  cogsCents: Cents;
  /** Vendidas o devueltas sin coste: el margen sale más alto. */
  uncostedUnits: number;
  marginCents: Cents;
  marginBp: BasisPoints | null;
  /** Descuento medio sobre el PVP en lo cobrado. */
  discountBp: BasisPoints | null;
  /** Netas de los tramos completos de los 12 últimos, desde el primero activo. */
  periodUnits: number[];
  trend: Trend;
  pattern: DemandPattern;
  /** Ritmo de los 12 últimos tramos. */
  demand: DemandRate;
  lostUnits: number | null;
  forecast: Forecast | null;
  available: number | null;
  coverageDays: number | null;
  closingOnHand: number | null;
};

const SHORT_BUCKETS = 4;
const LONG_BUCKETS = 12;

/**
 * Una fila de la tabla de productos con las series de sus formatos. La clase
 * ABC (necesita todos los productos) y la XYZ (xyzClass de `periodUnits`) se
 * asignan fuera.
 */
export function productRow({
  productId,
  series,
  available,
  vatBp,
  grain = 'week',
  horizonDays = FORECAST_DAYS,
}: ProductRowInput): ProductRow {
  // Solo tramos hasta hoy: los posteriores no tienen días.
  const rolled = rollupSeries(series).filter((b) => b.days > 0);
  const recent = rolled.slice(-LONG_BUCKETS);
  const since = recent[0]?.start;
  const recentSeries: VariantSeries[] = series.map((s) => ({
    variantId: s.variantId,
    buckets:
      since === undefined
        ? []
        : s.buckets.filter((b) => b.days > 0 && b.start >= since),
  }));

  let chargedCents = 0;
  let estimatedCents = 0;
  let unpricedUnits = 0;
  let grossCents = 0;
  let listCents = 0;
  for (const { buckets } of recentSeries) {
    for (const b of buckets) {
      chargedCents += b.grossCents - b.returnedGrossCents;
      grossCents += b.grossCents;
      listCents += b.listCents;
      const unpriced = Math.max(0, b.sold - b.pricedSold);
      if (b.retailPriceCents === null) unpricedUnits += unpriced;
      else estimatedCents += unpriced * b.retailPriceCents;
    }
  }
  const totals = sumBuckets(recent);
  const salesCents = chargedCents + estimatedCents;
  const margin = realizedMargin(
    { grossCents: salesCents, cogsCents: totals.cogsCents },
    vatBp,
  );

  const periodUnits = activeBuckets(
    recent.filter((b) => isCompleteBucket(b, grain)),
  ).map(netUnits);
  const demand = combinedDemandRate(recentSeries);
  const lost = recentSeries
    .map((s) => estimatedLostUnits(s.buckets))
    .filter((units): units is number => units !== null);

  return {
    productId,
    units4: sum(rolled.slice(-SHORT_BUCKETS).map(netUnits)),
    units12: netUnits(totals),
    salesCents,
    estimatedCents,
    unpricedUnits,
    netSalesCents: margin.netCents,
    cogsCents: totals.cogsCents,
    uncostedUnits: totals.uncosted,
    marginCents: margin.marginCents,
    marginBp: margin.marginBp,
    discountBp: discountDepthBp(grossCents, listCents),
    periodUnits,
    trend: trend(periodUnits),
    pattern: demandPattern(periodUnits),
    demand,
    lostUnits: lost.length > 0 ? sum(lost) : null,
    forecast: forecast(demand.perDay, horizonDays),
    available,
    coverageDays: coverageDays(available, demand.perDay),
    closingOnHand: rolled.at(-1)?.closingOnHand ?? null,
  };
}
