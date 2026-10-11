import type { Cents } from '@/lib/money';
import { divideHalfEven } from '@/lib/money';
import type { ControlArea, CostCategory, CostFrequency } from './labels';
import type { IsoDate, MonthKey } from './months';
import { addMonths, monthOf } from './months';

/**
 * Costes fijos y puntuales, netos (sin IVA). En cada mes cuenta lo que se paga
 * ese mes: los mensuales todos los meses de su vigencia, los anuales en el mes
 * de su fecha de inicio de cada año y los puntuales solo en su mes.
 */
export type ControlCost = {
  id: string;
  concept: string;
  area: ControlArea;
  category: CostCategory;
  amountNetCents: Cents;
  frequency: CostFrequency;
  startsOn: IsoDate;
  endsOn: IsoDate | null;
  notes: string | null;
};

export type CostState = 'active' | 'upcoming' | 'ended';

/** Si el coste está vigente en algún día del mes. */
export function isActiveInMonth(cost: ControlCost, month: MonthKey): boolean {
  if (month < monthOf(cost.startsOn)) return false;
  if (cost.frequency === 'once') return month === monthOf(cost.startsOn);
  return cost.endsOn === null || month <= monthOf(cost.endsOn);
}

/** Lo que se paga del coste en ese mes. */
export function costInMonth(cost: ControlCost, month: MonthKey): Cents {
  if (!isActiveInMonth(cost, month)) return 0;
  if (cost.frequency === 'yearly') {
    return month.slice(5, 7) === cost.startsOn.slice(5, 7)
      ? cost.amountNetCents
      : 0;
  }
  return cost.amountNetCents;
}

/** Equivalente mensual de un coste recurrente; los puntuales no tienen. */
export function monthlyEquivalent(cost: ControlCost): Cents {
  switch (cost.frequency) {
    case 'monthly':
      return cost.amountNetCents;
    case 'yearly':
      return divideHalfEven(cost.amountNetCents, 12);
    case 'once':
      return 0;
  }
}

export function costState(cost: ControlCost, today: IsoDate): CostState {
  if (today < cost.startsOn) return 'upcoming';
  if (cost.frequency === 'once') {
    return monthOf(today) === monthOf(cost.startsOn) ? 'active' : 'ended';
  }
  if (cost.endsOn !== null && today > cost.endsOn) return 'ended';
  return 'active';
}

export type MonthCosts = {
  month: MonthKey;
  totalCents: Cents;
  byCategory: Partial<Record<CostCategory, Cents>>;
};

/** Lo pagado cada mes, en total y por categoría, opcionalmente de un área. */
export function costsByMonth(
  costs: readonly ControlCost[],
  months: readonly MonthKey[],
  area?: ControlArea,
): MonthCosts[] {
  const selected = area ? costs.filter((c) => c.area === area) : costs;
  return months.map((month) => {
    const byCategory: Partial<Record<CostCategory, Cents>> = {};
    let totalCents = 0;
    for (const cost of selected) {
      const amount = costInMonth(cost, month);
      if (amount === 0) continue;
      totalCents += amount;
      byCategory[cost.category] = (byCategory[cost.category] ?? 0) + amount;
    }
    return { month, totalCents, byCategory };
  });
}

/** Coste recurrente mensual (con los anuales repartidos) vigente en el mes. */
export function recurringMonthlyCents(
  costs: readonly ControlCost[],
  month: MonthKey,
  area?: ControlArea,
): Cents {
  return costs
    .filter(
      (c) =>
        (!area || c.area === area) &&
        c.frequency !== 'once' &&
        isActiveInMonth(c, month),
    )
    .reduce((sum, c) => sum + monthlyEquivalent(c), 0);
}

/** Pagado entre dos meses, ambos incluidos. */
export function costsBetween(
  costs: readonly ControlCost[],
  from: MonthKey,
  to: MonthKey,
  area?: ControlArea,
): Cents {
  const months: MonthKey[] = [];
  for (let m = from; m <= to; m = addMonths(m, 1)) months.push(m);
  return costsByMonth(costs, months, area).reduce(
    (sum, row) => sum + row.totalCents,
    0,
  );
}
