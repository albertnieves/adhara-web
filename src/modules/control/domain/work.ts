import type { Cents } from '@/lib/money';
import type { ControlCost } from './costs';
import { costsBetween } from './costs';
import type {
  BillingStatus,
  ControlArea,
  DeliveryStatus,
  TaskOwner,
  TaskPriority,
  TaskStatus,
} from './labels';
import type { IsoDate } from './months';
import { daysBetween, madridToday, monthOf } from './months';

/** Tareas pendientes y entregas del proyecto al cliente. */

export type ControlTask = {
  id: string;
  title: string;
  area: ControlArea;
  status: TaskStatus;
  priority: TaskPriority;
  owner: TaskOwner;
  dueOn: IsoDate | null;
  notes: string | null;
  completedAt: string | null;
  createdAt: string;
};

export type ControlDelivery = {
  id: string;
  title: string;
  description: string | null;
  status: DeliveryStatus;
  dueOn: IsoDate | null;
  deliveredOn: IsoDate | null;
  reference: string | null;
  amountNetCents: Cents | null;
  billingStatus: BillingStatus | null;
  createdAt: string;
};

/** Días que se consideran «próximos» en el resumen. */
export const SOON_DAYS = 14;

export function isOpenTask(task: ControlTask): boolean {
  return task.status !== 'done';
}

export function isOverdue(
  item: { dueOn: IsoDate | null },
  today: IsoDate,
): boolean {
  return item.dueOn !== null && item.dueOn < today;
}

export function isDueSoon(
  item: { dueOn: IsoDate | null },
  today: IsoDate,
  days = SOON_DAYS,
): boolean {
  if (item.dueOn === null || item.dueOn < today) return false;
  return daysBetween(today, item.dueOn) <= days;
}

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  high: 0,
  normal: 1,
  low: 2,
};
const STATUS_ORDER: Record<TaskStatus, number> = {
  blocked: 0,
  in_progress: 1,
  pending: 2,
  done: 3,
};

/**
 * Abiertas primero; entre ellas, vencidas y por fecha (sin fecha al final),
 * luego prioridad y estado. Las hechas, de la más reciente a la más antigua.
 */
export function sortTasks(tasks: readonly ControlTask[]): ControlTask[] {
  return [...tasks].sort((a, b) => {
    const openA = isOpenTask(a);
    const openB = isOpenTask(b);
    if (openA !== openB) return openA ? -1 : 1;
    if (!openA) {
      return (b.completedAt ?? '').localeCompare(a.completedAt ?? '');
    }
    if (a.dueOn !== b.dueOn) {
      if (a.dueOn === null) return 1;
      if (b.dueOn === null) return -1;
      return a.dueOn.localeCompare(b.dueOn);
    }
    return (
      PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      a.createdAt.localeCompare(b.createdAt)
    );
  });
}

export type TaskCounts = {
  open: number;
  overdue: number;
  dueSoon: number;
  blocked: number;
  waitingOnClient: number;
  doneThisMonth: number;
};

export function countTasks(
  tasks: readonly ControlTask[],
  today: IsoDate,
): TaskCounts {
  const open = tasks.filter(isOpenTask);
  return {
    open: open.length,
    overdue: open.filter((t) => isOverdue(t, today)).length,
    dueSoon: open.filter((t) => isDueSoon(t, today)).length,
    blocked: open.filter((t) => t.status === 'blocked').length,
    waitingOnClient: open.filter((t) => t.owner === 'client').length,
    doneThisMonth: tasks.filter(
      (t) =>
        t.status === 'done' &&
        t.completedAt !== null &&
        monthOf(madridToday(new Date(t.completedAt))) === monthOf(today),
    ).length,
  };
}

const DELIVERY_ORDER: Record<DeliveryStatus, number> = {
  in_progress: 0,
  planned: 1,
  delivered: 2,
  accepted: 3,
};

/** En curso y planificadas por fecha; después, las entregadas más recientes. */
export function sortDeliveries(
  deliveries: readonly ControlDelivery[],
): ControlDelivery[] {
  return [...deliveries].sort((a, b) => {
    const pendingA = isPendingDelivery(a);
    const pendingB = isPendingDelivery(b);
    if (pendingA !== pendingB) return pendingA ? -1 : 1;
    if (pendingA) {
      if (a.dueOn !== b.dueOn) {
        if (a.dueOn === null) return 1;
        if (b.dueOn === null) return -1;
        return a.dueOn.localeCompare(b.dueOn);
      }
      return (
        DELIVERY_ORDER[a.status] - DELIVERY_ORDER[b.status] ||
        a.createdAt.localeCompare(b.createdAt)
      );
    }
    return (
      (b.deliveredOn ?? '').localeCompare(a.deliveredOn ?? '') ||
      b.createdAt.localeCompare(a.createdAt)
    );
  });
}

export function isPendingDelivery(delivery: ControlDelivery): boolean {
  return delivery.status === 'planned' || delivery.status === 'in_progress';
}

export type Billing = {
  /** Entregado o aceptado con importe y aún sin facturar. */
  toInvoiceCents: Cents;
  /** Facturado y aún sin cobrar. */
  invoicedCents: Cents;
  paidCents: Cents;
  /** Importe de lo que aún no se ha entregado. */
  plannedCents: Cents;
  /** Entregas con importe sin estado de facturación decidido. */
  undecided: number;
};

export function billing(deliveries: readonly ControlDelivery[]): Billing {
  const result: Billing = {
    toInvoiceCents: 0,
    invoicedCents: 0,
    paidCents: 0,
    plannedCents: 0,
    undecided: 0,
  };
  for (const d of deliveries) {
    const amount = d.amountNetCents ?? 0;
    if (d.billingStatus === 'none') continue;
    if (d.billingStatus === null) {
      if (d.amountNetCents !== null) result.undecided += 1;
      continue;
    }
    if (d.billingStatus === 'paid') result.paidCents += amount;
    else if (d.billingStatus === 'invoiced') result.invoicedCents += amount;
    else if (isPendingDelivery(d)) result.plannedCents += amount;
    else result.toInvoiceCents += amount;
  }
  return result;
}

export type ProjectBalance = {
  /** Facturado (cobrado o no) de las entregas. */
  billedCents: Cents;
  paidCents: Cents;
  /** Costes del proyecto pagados desde el primer coste hasta este mes. */
  costsCents: Cents;
  /** Facturado − costes del proyecto. */
  balanceCents: Cents;
};

export function projectBalance(
  deliveries: readonly ControlDelivery[],
  costs: readonly ControlCost[],
  today: IsoDate,
): ProjectBalance {
  const b = billing(deliveries);
  const projectCosts = costs.filter((c) => c.area === 'project');
  const first = projectCosts.reduce<string | null>(
    (min, c) => (min === null || c.startsOn < min ? c.startsOn : min),
    null,
  );
  const costsCents =
    first === null || monthOf(first) > monthOf(today)
      ? 0
      : costsBetween(projectCosts, monthOf(first), monthOf(today));
  const billedCents = b.invoicedCents + b.paidCents;
  return {
    billedCents,
    paidCents: b.paidCents,
    costsCents,
    balanceCents: billedCents - costsCents,
  };
}
