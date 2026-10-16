'use client';

import type { FormEvent } from 'react';
import { startTransition, useActionState, useRef, useState } from 'react';
import type { ActionState } from '@/modules/admin';
import { FormMessage, IDLE, useAdminAction } from '@/modules/admin';
import {
  Field,
  Input,
  Select,
  SubmitButton,
  Textarea,
  toast,
  useConfirm,
} from '@/components/ui';
import type { StatusAction } from '../domain/labels';
import {
  addConversationNote,
  assignConversation,
  changeConversationStatus,
  deleteConversation,
  linkConversationOrder,
  replyToConversation,
} from '../server/actions';

type Action = (state: ActionState, form: FormData) => Promise<ActionState>;

/** Al terminar bien: aviso, y el formulario vuelve a empezar. */
function useMessageAction(action: Action, onOk?: () => void) {
  return useAdminAction(async (state: ActionState, form: FormData) => {
    const result = await action(state, form);
    if (result.status === 'ok') {
      toast(result.message ?? 'Hecho.');
      onOk?.();
      return { status: 'idle' } satisfies ActionState;
    }
    return result;
  });
}

export type TemplateOption = {
  id: string;
  title: string;
  locale: 'es' | 'ca' | 'en';
  body: string;
};

const LOCALE_NAMES = { es: 'español', ca: 'catalán', en: 'inglés' } as const;

/**
 * Respuesta al cliente: se guarda en la conversación y sale por email. Las
 * plantillas solo rellenan el texto, que se puede cambiar antes de enviar.
 */
export function ReplyForm({
  conversationId,
  revision,
  locale,
  templates,
  disabled,
}: {
  conversationId: string;
  revision: number;
  locale: 'es' | 'ca' | 'en';
  templates: TemplateOption[];
  disabled?: string;
}) {
  const [text, setText] = useState('');
  const { state, pending, onSubmit } = useMessageAction(
    replyToConversation,
    () => setText(''),
  );
  // Primero las del idioma de la conversación.
  const sorted = [...templates].sort(
    (a, b) =>
      Number(b.locale === locale) - Number(a.locale === locale) ||
      a.title.localeCompare(b.title, 'es'),
  );
  if (disabled)
    return <p className="text-fg-muted max-w-2xl text-sm">{disabled}</p>;
  return (
    <form onSubmit={onSubmit} className="flex max-w-3xl flex-col gap-4">
      <input type="hidden" name="conversationId" value={conversationId} />
      <input type="hidden" name="revision" value={revision} />
      {sorted.length > 0 && (
        <Field
          label="Plantilla"
          hint="Rellena el texto; puedes cambiarlo antes de enviar."
          className="max-w-md"
        >
          <Select
            value=""
            onChange={(event) => {
              const chosen = sorted.find((t) => t.id === event.target.value);
              if (chosen) setText(chosen.body);
            }}
          >
            <option value="">Elegir plantilla…</option>
            {sorted.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title} ({LOCALE_NAMES[t.locale]})
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field
        label="Respuesta al cliente"
        hint={`Sale por email en ${LOCALE_NAMES[locale]}: escríbela en ese idioma. Debajo van la firma de la tienda y su último mensaje.`}
      >
        <Textarea
          name="body"
          rows={8}
          required
          maxLength={5000}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pending={pending} pendingLabel="Enviando…">
          Enviar respuesta
        </SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

/** Nota interna: la ve el personal, nunca el cliente. */
export function NoteForm({ conversationId }: { conversationId: string }) {
  const form = useRef<HTMLFormElement>(null);
  const { state, pending, onSubmit } = useMessageAction(
    addConversationNote,
    () => form.current?.reset(),
  );
  return (
    <form
      ref={form}
      onSubmit={onSubmit}
      className="flex max-w-3xl flex-col gap-4"
    >
      <input type="hidden" name="conversationId" value={conversationId} />
      <Field label="Nota interna" hint="Solo la ve el personal.">
        <Textarea name="body" rows={3} required maxLength={5000} />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pending={pending} variant="outline">
          Añadir nota
        </SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function StatusForm({
  conversationId,
  revision,
  actions,
}: {
  conversationId: string;
  revision: number;
  actions: StatusAction[];
}) {
  const { state, pending, onSubmit } = useMessageAction(
    changeConversationStatus,
  );
  if (actions.length === 0) return null;
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <input type="hidden" name="conversationId" value={conversationId} />
      <input type="hidden" name="revision" value={revision} />
      <div className="flex flex-wrap items-center gap-3">
        {actions.map((action) => (
          <SubmitButton
            key={action.to}
            name="to"
            value={action.to}
            pending={pending}
            pendingLabel="…"
            variant={action.variant}
          >
            {action.label}
          </SubmitButton>
        ))}
      </div>
      <FormMessage state={state} />
    </form>
  );
}

export function AssignForm({
  conversationId,
  revision,
  assignedTo,
  assignees,
}: {
  conversationId: string;
  revision: number;
  assignedTo: string | null;
  assignees: { userId: string; name: string }[];
}) {
  const { state, pending, onSubmit } = useMessageAction(assignConversation);
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <input type="hidden" name="conversationId" value={conversationId} />
      <input type="hidden" name="revision" value={revision} />
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Asignada a" className="min-w-56">
          <Select
            name="assignee"
            defaultValue={assignedTo ?? ''}
            key={assignedTo}
          >
            <option value="">Sin asignar</option>
            {assignees.map((person) => (
              <option key={person.userId} value={person.userId}>
                {person.name}
              </option>
            ))}
          </Select>
        </Field>
        <SubmitButton pending={pending} variant="outline">
          Guardar
        </SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

export function OrderLinkForm({
  conversationId,
  revision,
  orderNumber,
}: {
  conversationId: string;
  revision: number;
  orderNumber: number | null;
}) {
  const { state, pending, onSubmit } = useMessageAction(linkConversationOrder);
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <input type="hidden" name="conversationId" value={conversationId} />
      <input type="hidden" name="revision" value={revision} />
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Nº de pedido" className="max-w-40">
          <Input
            name="orderNumber"
            inputMode="numeric"
            autoComplete="off"
            maxLength={16}
            defaultValue={orderNumber ?? ''}
            key={orderNumber}
          />
        </Field>
        <SubmitButton pending={pending} variant="outline">
          Enlazar
        </SubmitButton>
      </div>
      <p className="text-fg-muted text-xs">
        Déjalo vacío y pulsa «Enlazar» para quitar el pedido.
      </p>
      <FormMessage state={state} />
    </form>
  );
}

/** Borrar la conversación entera: spam o derecho de supresión. */
export function DeleteConversationForm({
  conversationId,
  revision,
  number,
}: {
  conversationId: string;
  revision: number;
  number: number;
}) {
  const [state, dispatch, pending] = useActionState(deleteConversation, IDLE);
  const [confirm, confirmDialog] = useConfirm();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const confirmed = await confirm({
      title: `¿Borrar la consulta nº ${number}?`,
      description:
        'Se borran sus mensajes, notas y datos del cliente, y no se puede deshacer. Es para spam o para cuando el cliente pide que borremos sus datos.',
      confirmLabel: 'Borrar',
      tone: 'danger',
    });
    if (confirmed) startTransition(() => dispatch(formData));
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <input type="hidden" name="conversationId" value={conversationId} />
      <input type="hidden" name="revision" value={revision} />
      <div>
        <SubmitButton
          pending={pending}
          variant="danger"
          pendingLabel="Borrando…"
        >
          Borrar conversación
        </SubmitButton>
      </div>
      <FormMessage state={state} />
      {confirmDialog}
    </form>
  );
}
