import 'server-only';
import type { StaffContext } from '@/modules/auth/server';
import type { MonthFact } from '../domain/business';
import type { ControlCost } from '../domain/costs';
import {
  BILLING_STATUSES,
  CONTROL_AREAS,
  COST_CATEGORIES,
  COST_FREQUENCIES,
  DELIVERY_STATUSES,
  TASK_OWNERS,
  TASK_PRIORITIES,
  TASK_STATUSES,
  isOneOf,
} from '../domain/labels';
import type { MonthKey } from '../domain/months';
import { addMonths, monthOf, monthStart } from '../domain/months';
import type { ControlDelivery, ControlTask } from '../domain/work';

/*
 * Lecturas del control: funciones admin_control_* que exigen business.control
 * con MFA. Quien llama ya pasó requirePermission('business.control'); la base
 * de datos lo vuelve a comprobar.
 */

type Supabase = StaffContext['supabase'];

function pick<T extends string>(values: readonly T[], value: string): T {
  if (!isOneOf(values, value)) {
    throw new Error(`Valor inesperado de la base de datos: ${value}`);
  }
  return value;
}

export async function listTasks(supabase: Supabase): Promise<ControlTask[]> {
  const { data, error } = await supabase.rpc('admin_control_tasks');
  if (error) throw new Error(error.message);
  return data.map((t) => ({
    id: t.id,
    title: t.title,
    area: pick(CONTROL_AREAS, t.area),
    status: pick(TASK_STATUSES, t.status),
    priority: pick(TASK_PRIORITIES, t.priority),
    owner: pick(TASK_OWNERS, t.owner),
    dueOn: t.due_on,
    notes: t.notes,
    completedAt: t.completed_at,
    createdAt: t.created_at,
  }));
}

export async function listCosts(supabase: Supabase): Promise<ControlCost[]> {
  const { data, error } = await supabase.rpc('admin_control_costs');
  if (error) throw new Error(error.message);
  return data.map((c) => ({
    id: c.id,
    concept: c.concept,
    area: pick(CONTROL_AREAS, c.area),
    category: pick(COST_CATEGORIES, c.category),
    amountNetCents: c.amount_net_cents,
    frequency: pick(COST_FREQUENCIES, c.frequency),
    startsOn: c.starts_on,
    endsOn: c.ends_on,
    notes: c.notes,
  }));
}

export async function listDeliveries(
  supabase: Supabase,
): Promise<ControlDelivery[]> {
  const { data, error } = await supabase.rpc('admin_control_deliveries');
  if (error) throw new Error(error.message);
  return data.map((d) => ({
    id: d.id,
    title: d.title,
    description: d.description,
    status: pick(DELIVERY_STATUSES, d.status),
    dueOn: d.due_on,
    deliveredOn: d.delivered_on,
    reference: d.reference,
    amountNetCents: d.amount_net_cents,
    billingStatus:
      d.billing_status === null
        ? null
        : pick(BILLING_STATUSES, d.billing_status),
    createdAt: d.created_at,
  }));
}

/** Hechos del negocio de los meses `from`…`to`, ambos incluidos. */
export async function listMonthFacts(
  supabase: Supabase,
  from: MonthKey,
  to: MonthKey,
): Promise<MonthFact[]> {
  const { data, error } = await supabase.rpc('admin_control_month_facts', {
    p_from: monthStart(from),
    p_to: monthStart(addMonths(to, 1)),
  });
  if (error) throw new Error(error.message);
  return data.map((f) => ({
    month: monthOf(f.month),
    variantId: f.variant_id,
    soldUnits: f.sold_units,
    returnedUnits: f.returned_units,
    pricedSoldUnits: f.priced_sold_units,
    soldGrossCents: f.sold_gross_cents,
    pricedReturnedUnits: f.priced_returned_units,
    returnedGrossCents: f.returned_gross_cents,
    cogsNetCents: f.cogs_net_cents,
    uncostedUnits: f.uncosted_units,
    receivedUnits: f.received_units,
    receivedNetCents: f.received_net_cents,
    uncostedReceivedUnits: f.uncosted_received_units,
    retailPriceCents: f.retail_price_cents,
  }));
}
