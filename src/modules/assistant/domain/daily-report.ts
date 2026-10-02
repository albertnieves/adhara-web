/**
 * Informe diario del asistente (docs/ADMIN_PLAN.md A4.1): foto determinista de
 * un día de la tienda a partir de datos que ya existen (movimientos, niveles,
 * hallazgos del vigilante, pedidos abiertos y catálogo). Sin costes ni nombres
 * de proveedor: lo lee también el encargado. Si falta un dato no se inventa:
 * la sección queda vacía o en null.
 */
import type { Permission } from '@/modules/auth';
import type {
  FindingKind,
  FindingSeverity,
  MovementType,
} from '@/modules/inventory';
import { MOVEMENT_TYPES } from '@/modules/inventory';
import type { ReportBucket } from '@/modules/reports';
import { MOVEMENT_REPORT_BUCKET, REPORT_BUCKETS } from '@/modules/reports';

export const DAILY_REPORT_VERSION = 1;
/** Elementos por lista: el informe completo está en el panel. */
const LIST_LIMIT = 10;

export type ReportItem = {
  product: string;
  brand: string;
  variant: string;
};

export type DailyReportInput = {
  /** Día de la tienda (AAAA-MM-DD, Europe/Madrid). */
  day: string;
  generatedAt: Date;
  locationName: string;
  /** Movimientos del día en la ubicación. */
  movements: readonly (ReportItem & {
    variantId: string;
    type: string;
    deltaOnHand: number;
    reference: string | null;
  })[];
  stock: readonly (ReportItem & {
    variantId: string;
    active: boolean;
    onHand: number;
    reserved: number;
    reorderPoint: number | null;
  })[];
  /** Hallazgos del vigilante (watchStock) con la sesión o la tarea programada. */
  findings: readonly {
    kind: FindingKind;
    severity: FindingSeverity;
    variantId: string;
    proposedUnits: number | null;
  }[];
  openOrders: readonly {
    number: string;
    status: string;
    expectedOn: string | null;
    unitsOrdered: number;
    unitsReceived: number;
  }[];
  catalog: readonly {
    status: string;
    hasImage: boolean;
    missingTranslations: number;
    activeVariants: number;
    activeWithoutPrice: number;
  }[];
};

export const DAILY_TASK_KEYS = [
  'reorder',
  'overdue',
  'out',
  'low',
  'price',
  'image',
  'translations',
] as const;
export type DailyTaskKey = (typeof DAILY_TASK_KEYS)[number];

/** Permiso de la pantalla a la que lleva cada tarea: sin él, no se muestra. */
export const DAILY_TASK_PERMISSIONS: Readonly<
  Record<DailyTaskKey, Permission>
> = {
  reorder: 'inventory.view',
  overdue: 'purchasing.manage',
  out: 'inventory.view',
  low: 'inventory.view',
  price: 'catalog.edit',
  image: 'catalog.edit',
  translations: 'catalog.edit',
};

export type DailyTask = {
  key: DailyTaskKey;
  label: string;
  count: number;
  href: string;
  tone: 'alert' | 'normal';
};

export type DailyReport = {
  version: typeof DAILY_REPORT_VERSION;
  day: string;
  generatedAt: string;
  location: string;
  activity: {
    movements: number;
    units: Record<ReportBucket, number>;
    /** Tickets distintos de las ventas en mostrador (referencia del TPV). */
    storeTickets: number;
    topSold: (ReportItem & { units: number })[];
  };
  stock: {
    unitsOnHand: number;
    activeFormats: number;
    outOfStock: { count: number; items: ReportItem[] };
    low: {
      count: number;
      items: (ReportItem & { available: number; reorderPoint: number })[];
    };
  };
  watch: {
    critical: number;
    warning: number;
    info: number;
    reorderProposals: number;
    items: (ReportItem & {
      kind: FindingKind;
      severity: FindingSeverity;
      proposedUnits: number | null;
    })[];
  };
  purchasing: {
    open: number;
    unitsPending: number;
    overdue: { number: string; expectedOn: string; unitsPending: number }[];
  };
  catalog: {
    published: number;
    drafts: number;
    missingPrice: number;
    missingImage: number;
    missingTranslations: number;
  };
  /** Trabajo pendiente con su enlace en el panel, de lo más urgente a lo menos. */
  tasks: DailyTask[];
};

const SEVERITY_ORDER: Record<FindingSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

function isMovementType(type: string): type is MovementType {
  return (MOVEMENT_TYPES as readonly string[]).includes(type);
}

function item(row: ReportItem): ReportItem {
  return { product: row.product, brand: row.brand, variant: row.variant };
}

export function buildDailyReport(input: DailyReportInput): DailyReport {
  const units = Object.fromEntries(REPORT_BUCKETS.map((b) => [b, 0])) as Record<
    ReportBucket,
    number
  >;
  const sold = new Map<string, ReportItem & { units: number }>();
  const tickets = new Set<string>();
  for (const m of input.movements) {
    const bucket = isMovementType(m.type)
      ? MOVEMENT_REPORT_BUCKET[m.type]
      : null;
    if (!bucket) continue;
    // Entradas, ventas, devoluciones, mermas y traslados en positivo; los
    // ajustes conservan el signo (un recuento puede sumar o restar).
    units[bucket] +=
      bucket === 'adjusted' ? m.deltaOnHand : Math.abs(m.deltaOnHand);
    if (bucket === 'sold') {
      const current = sold.get(m.variantId) ?? { ...item(m), units: 0 };
      current.units += Math.abs(m.deltaOnHand);
      sold.set(m.variantId, current);
      if (m.type === 'SALE_STORE' && m.reference) tickets.add(m.reference);
    }
  }
  const topSold = [...sold.values()]
    .sort(
      (a, b) => b.units - a.units || a.product.localeCompare(b.product, 'es'),
    )
    .slice(0, 5);

  const active = input.stock.filter((row) => row.active);
  const byVariant = new Map(input.stock.map((row) => [row.variantId, row]));
  // Agotados y bajo mínimo según el vigilante (como Reposición): un borrador
  // que nunca tuvo stock no cuenta como agotado.
  const ofKind = (kind: FindingKind) =>
    input.findings
      .filter((f) => f.kind === kind && byVariant.has(f.variantId))
      .map((f) => byVariant.get(f.variantId)!);
  const outOfStock = ofKind('out_of_stock');
  const low = ofKind('below_min').map((row) => ({
    ...item(row),
    available: row.onHand - row.reserved,
    reorderPoint: row.reorderPoint ?? 0,
  }));

  const watchItems = [...input.findings]
    .filter((f) => byVariant.has(f.variantId))
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
    .map((f) => ({
      ...item(byVariant.get(f.variantId)!),
      kind: f.kind,
      severity: f.severity,
      proposedUnits: f.proposedUnits,
    }));
  const count = (severity: FindingSeverity) =>
    input.findings.filter((f) => f.severity === severity).length;

  const pending = (o: { unitsOrdered: number; unitsReceived: number }) =>
    Math.max(0, o.unitsOrdered - o.unitsReceived);
  const overdue = input.openOrders
    .filter((o) => o.expectedOn !== null && o.expectedOn < input.day)
    .map((o) => ({
      number: o.number,
      expectedOn: o.expectedOn as string,
      unitsPending: pending(o),
    }));

  const live = input.catalog.filter((p) => p.status !== 'archived');
  const catalog = {
    published: input.catalog.filter((p) => p.status === 'published').length,
    drafts: input.catalog.filter((p) => p.status === 'draft').length,
    missingPrice: live.filter(
      (p) => p.activeVariants === 0 || p.activeWithoutPrice > 0,
    ).length,
    missingImage: live.filter((p) => !p.hasImage).length,
    missingTranslations: live.filter((p) => p.missingTranslations > 0).length,
  };

  const reorderProposals = input.findings.filter(
    (f) => f.proposedUnits !== null && f.proposedUnits > 0,
  ).length;
  const tasks: DailyTask[] = (
    [
      {
        key: 'reorder',
        label: 'Propuestas de reposición por revisar',
        count: reorderProposals,
        href: '/admin/reposicion',
        tone: 'alert' as const,
      },
      {
        key: 'overdue',
        label: 'Pedidos de compra con la entrega vencida',
        count: overdue.length,
        href: '/admin/compras',
        tone: 'alert' as const,
      },
      {
        key: 'out',
        label: 'Formatos agotados',
        count: outOfStock.length,
        href: '/admin/inventario?filtro=bajo',
        tone: 'alert' as const,
      },
      {
        key: 'low',
        label: 'Formatos por debajo del punto de pedido',
        count: low.length,
        href: '/admin/inventario?filtro=bajo',
        tone: 'normal' as const,
      },
      {
        key: 'price',
        label: 'Perfumes sin PVP completo',
        count: catalog.missingPrice,
        href: '/admin/catalogo?pendiente=precio',
        tone: 'normal' as const,
      },
      {
        key: 'image',
        label: 'Perfumes sin imagen',
        count: catalog.missingImage,
        href: '/admin/catalogo?pendiente=imagen',
        tone: 'normal' as const,
      },
      {
        key: 'translations',
        label: 'Perfumes con textos pendientes',
        count: catalog.missingTranslations,
        href: '/admin/catalogo?pendiente=traducciones',
        tone: 'normal' as const,
      },
    ] satisfies DailyTask[]
  ).filter((task) => task.count > 0);

  return {
    version: DAILY_REPORT_VERSION,
    day: input.day,
    generatedAt: input.generatedAt.toISOString(),
    location: input.locationName,
    activity: {
      movements: input.movements.length,
      units,
      storeTickets: tickets.size,
      topSold,
    },
    stock: {
      unitsOnHand: input.stock.reduce((sum, row) => sum + row.onHand, 0),
      activeFormats: active.length,
      outOfStock: {
        count: outOfStock.length,
        items: outOfStock.slice(0, LIST_LIMIT).map(item),
      },
      low: { count: low.length, items: low.slice(0, LIST_LIMIT) },
    },
    watch: {
      critical: count('critical'),
      warning: count('warning'),
      info: count('info'),
      reorderProposals,
      items: watchItems.slice(0, LIST_LIMIT),
    },
    purchasing: {
      open: input.openOrders.length,
      unitsPending: input.openOrders.reduce((sum, o) => sum + pending(o), 0),
      overdue,
    },
    catalog,
    tasks,
  };
}

/** El día anterior de la tienda (el informe programado resume el día cerrado). */
export function previousDay(day: string): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function isReportDay(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    new Date(`${value}T00:00:00Z`).toISOString().startsWith(value)
  );
}
