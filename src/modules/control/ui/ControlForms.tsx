'use client';

import type { FormEvent } from 'react';
import { startTransition, useActionState } from 'react';
import { FormMessage, IDLE, useAdminAction } from '@/modules/admin';
import type { ActionState } from '@/modules/admin';
import {
  Field,
  Input,
  Select,
  SubmitButton,
  Textarea,
  useConfirm,
} from '@/components/ui';
import type { ControlCost } from '../domain/costs';
import {
  AREA_LABELS,
  BILLING_STATUSES,
  BILLING_STATUS_LABELS,
  CONTROL_AREAS,
  COST_CATEGORIES,
  COST_CATEGORY_LABELS,
  COST_FREQUENCIES,
  COST_FREQUENCY_LABELS,
  DELIVERY_STATUSES,
  DELIVERY_STATUS_LABELS,
  TASK_OWNERS,
  TASK_OWNER_LABELS,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
} from '../domain/labels';
import type { ControlArea, TaskStatus } from '../domain/labels';
import type { ControlDelivery, ControlTask } from '../domain/work';
import {
  deleteCost,
  deleteDelivery,
  deleteTask,
  saveCost,
  saveDelivery,
  saveTask,
  setTaskStatus,
} from '../server/actions';

/** Céntimos → «80,50» para un campo de importe. */
function eurosValue(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '';
  const euros = Math.trunc(cents / 100);
  const rest = cents % 100;
  return rest === 0
    ? String(euros)
    : `${euros},${String(rest).padStart(2, '0')}`;
}

function Options<T extends string>({
  values,
  labels,
}: {
  values: readonly T[];
  labels: Readonly<Record<T, string>>;
}) {
  return values.map((value) => (
    <option key={value} value={value}>
      {labels[value]}
    </option>
  ));
}

// ---------------------------------------------------------------------------
// Tareas
// ---------------------------------------------------------------------------

export function TaskForm({
  task,
  defaultArea = 'project',
}: {
  task?: ControlTask;
  defaultArea?: ControlArea;
}) {
  const { state, pending, onSubmit } = useAdminAction(saveTask);
  return (
    <form onSubmit={onSubmit} className="grid gap-5 sm:grid-cols-2">
      <input type="hidden" name="id" value={task?.id ?? ''} />
      <Field label="Tarea" className="sm:col-span-2">
        <Input
          name="title"
          required
          maxLength={200}
          defaultValue={task?.title}
        />
      </Field>
      <Field label="Área">
        <Select name="area" defaultValue={task?.area ?? defaultArea}>
          <Options values={CONTROL_AREAS} labels={AREA_LABELS} />
        </Select>
      </Field>
      <Field label="Estado">
        <Select name="status" defaultValue={task?.status ?? 'pending'}>
          <Options values={TASK_STATUSES} labels={TASK_STATUS_LABELS} />
        </Select>
      </Field>
      <Field label="Prioridad">
        <Select name="priority" defaultValue={task?.priority ?? 'normal'}>
          <Options values={TASK_PRIORITIES} labels={TASK_PRIORITY_LABELS} />
        </Select>
      </Field>
      <Field label="Responsable" hint="Quién tiene que moverla.">
        <Select name="owner" defaultValue={task?.owner ?? 'me'}>
          <Options values={TASK_OWNERS} labels={TASK_OWNER_LABELS} />
        </Select>
      </Field>
      <Field label="Fecha límite" hint="Opcional.">
        <Input name="dueOn" type="date" defaultValue={task?.dueOn ?? ''} />
      </Field>
      <Field label="Notas" className="sm:col-span-2">
        <Textarea
          name="notes"
          rows={3}
          maxLength={2000}
          defaultValue={task?.notes ?? ''}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
        <SubmitButton pending={pending}>
          {task ? 'Guardar tarea' : 'Crear tarea'}
        </SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

/** Marcar como hecha o reabrir desde la lista. */
export function TaskDoneToggle({
  id,
  status,
  title,
}: {
  id: string;
  status: TaskStatus;
  title: string;
}) {
  const { state, pending, onSubmit } = useAdminAction(setTaskStatus);
  const done = status === 'done';
  return (
    <form onSubmit={onSubmit} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={done ? 'pending' : 'done'} />
      <SubmitButton pending={pending} pendingLabel="…" variant="outline">
        {done ? 'Reabrir' : 'Hecha'}
        <span className="sr-only"> «{title}»</span>
      </SubmitButton>
      {state.status === 'error' && <FormMessage state={state} />}
    </form>
  );
}

// ---------------------------------------------------------------------------
// Costes
// ---------------------------------------------------------------------------

export function CostForm({
  cost,
  defaultArea = 'business',
  today,
}: {
  cost?: ControlCost;
  defaultArea?: ControlArea;
  today: string;
}) {
  const { state, pending, onSubmit } = useAdminAction(saveCost);
  return (
    <form onSubmit={onSubmit} className="grid gap-5 sm:grid-cols-2">
      <input type="hidden" name="id" value={cost?.id ?? ''} />
      <Field label="Concepto" className="sm:col-span-2">
        <Input
          name="concept"
          required
          maxLength={120}
          defaultValue={cost?.concept}
        />
      </Field>
      <Field
        label="Área"
        hint="Negocio: cuenta en el beneficio de la tienda. Proyecto: lo que cuesta mantener la web y el panel."
      >
        <Select name="area" defaultValue={cost?.area ?? defaultArea}>
          <Options values={CONTROL_AREAS} labels={AREA_LABELS} />
        </Select>
      </Field>
      <Field label="Categoría">
        <Select name="category" defaultValue={cost?.category ?? 'other'}>
          <Options values={COST_CATEGORIES} labels={COST_CATEGORY_LABELS} />
        </Select>
      </Field>
      <Field
        label="Importe sin IVA (€)"
        hint="Por cada pago: al mes, al año o una vez."
      >
        <Input
          name="amount"
          required
          inputMode="decimal"
          defaultValue={eurosValue(cost?.amountNetCents)}
          className="tabular-nums"
        />
      </Field>
      <Field label="Frecuencia">
        <Select name="frequency" defaultValue={cost?.frequency ?? 'monthly'}>
          <Options values={COST_FREQUENCIES} labels={COST_FREQUENCY_LABELS} />
        </Select>
      </Field>
      <Field
        label="Desde"
        hint="Primer pago. Los anuales se cargan cada año en este mes."
      >
        <Input
          name="startsOn"
          type="date"
          required
          defaultValue={cost?.startsOn ?? today}
        />
      </Field>
      <Field
        label="Hasta"
        hint="Vacío: sigue vigente. No aplica a los puntuales."
      >
        <Input name="endsOn" type="date" defaultValue={cost?.endsOn ?? ''} />
      </Field>
      <Field label="Notas" className="sm:col-span-2">
        <Textarea
          name="notes"
          rows={2}
          maxLength={1000}
          defaultValue={cost?.notes ?? ''}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
        <SubmitButton pending={pending}>
          {cost ? 'Guardar coste' : 'Añadir coste'}
        </SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Entregas
// ---------------------------------------------------------------------------

export function DeliveryForm({ delivery }: { delivery?: ControlDelivery }) {
  const { state, pending, onSubmit } = useAdminAction(saveDelivery);
  return (
    <form onSubmit={onSubmit} className="grid gap-5 sm:grid-cols-2">
      <input type="hidden" name="id" value={delivery?.id ?? ''} />
      <Field label="Entrega" className="sm:col-span-2">
        <Input
          name="title"
          required
          maxLength={200}
          defaultValue={delivery?.title}
        />
      </Field>
      <Field label="Estado">
        <Select name="status" defaultValue={delivery?.status ?? 'planned'}>
          <Options values={DELIVERY_STATUSES} labels={DELIVERY_STATUS_LABELS} />
        </Select>
      </Field>
      <Field label="Fecha prevista">
        <Input name="dueOn" type="date" defaultValue={delivery?.dueOn ?? ''} />
      </Field>
      <Field label="Fecha de entrega">
        <Input
          name="deliveredOn"
          type="date"
          defaultValue={delivery?.deliveredOn ?? ''}
        />
      </Field>
      <Field label="Referencia" hint="PR, enlace o documento de la entrega.">
        <Input
          name="reference"
          maxLength={300}
          defaultValue={delivery?.reference ?? ''}
        />
      </Field>
      <Field
        label="Importe sin IVA (€)"
        hint="Vacío si no tiene importe propio."
      >
        <Input
          name="amount"
          inputMode="decimal"
          defaultValue={eurosValue(delivery?.amountNetCents)}
          className="tabular-nums"
        />
      </Field>
      <Field label="Facturación">
        <Select
          name="billingStatus"
          defaultValue={delivery?.billingStatus ?? ''}
        >
          <option value="">Sin decidir</option>
          <Options values={BILLING_STATUSES} labels={BILLING_STATUS_LABELS} />
        </Select>
      </Field>
      <Field label="Descripción" className="sm:col-span-2">
        <Textarea
          name="description"
          rows={3}
          maxLength={2000}
          defaultValue={delivery?.description ?? ''}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
        <SubmitButton pending={pending}>
          {delivery ? 'Guardar entrega' : 'Crear entrega'}
        </SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Borrar, con confirmación
// ---------------------------------------------------------------------------

const DELETE_ACTIONS = {
  task: { action: deleteTask, noun: 'esta tarea' },
  cost: { action: deleteCost, noun: 'este coste' },
  delivery: { action: deleteDelivery, noun: 'esta entrega' },
} as const satisfies Record<
  string,
  {
    action: (state: ActionState, formData: FormData) => Promise<ActionState>;
    noun: string;
  }
>;

export function DeleteControlItem({
  kind,
  id,
  name,
}: {
  kind: keyof typeof DELETE_ACTIONS;
  id: string;
  name: string;
}) {
  const { action, noun } = DELETE_ACTIONS[kind];
  const [state, dispatch, pending] = useActionState(action, IDLE);
  const [confirm, confirmDialog] = useConfirm();
  async function guarded(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const confirmed = await confirm({
      title: `¿Borrar ${noun}?`,
      description: `«${name}» desaparece del control. No se puede deshacer.`,
      confirmLabel: 'Borrar',
      tone: 'danger',
    });
    if (confirmed) startTransition(() => dispatch(formData));
  }
  return (
    <form onSubmit={guarded} className="flex flex-wrap items-center gap-4">
      <input type="hidden" name="id" value={id} />
      <SubmitButton variant="danger" pending={pending} pendingLabel="Borrando…">
        Borrar
      </SubmitButton>
      <FormMessage state={state} />
      {confirmDialog}
    </form>
  );
}
