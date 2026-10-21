import type { BadgeTone } from '@/components/ui';
import type {
  Channel,
  ConversationClock,
  ConversationStatus,
  MessageKind,
  Topic,
} from './conversations';
import {
  MANUAL_STATUS_CHANGES,
  RESPONSE_TARGET_MINUTES,
  isOverdue,
} from './conversations';

/*
 * Textos del panel para la bandeja de mensajes (español; el panel no se
 * traduce) y vistas de la lista. Los códigos de error repiten los de la
 * migración 20261021120000_customer_messages.
 */

export const CONVERSATION_STATUS_LABELS: Readonly<
  Record<ConversationStatus, string>
> = {
  open: 'Por responder',
  waiting_customer: 'Esperando al cliente',
  resolved: 'Resuelta',
  spam: 'Spam',
};

const STATUS_TONES: Readonly<Record<ConversationStatus, BadgeTone>> = {
  open: 'warning',
  waiting_customer: 'accent',
  resolved: 'success',
  spam: 'neutral',
};

export function conversationStatusBadge(status: ConversationStatus): {
  label: string;
  tone: BadgeTone;
} {
  return {
    label: CONVERSATION_STATUS_LABELS[status],
    tone: STATUS_TONES[status],
  };
}

export const CHANNEL_LABELS: Readonly<Record<Channel, string>> = {
  web_form: 'Formulario web',
  email: 'Email',
  whatsapp: 'WhatsApp',
};

export const TOPIC_LABELS: Readonly<Record<Topic, string>> = {
  order: 'Un pedido',
  product: 'Un perfume',
  other: 'Otra consulta',
};

export const MESSAGE_KIND_LABELS: Readonly<Record<MessageKind, string>> = {
  customer: 'Cliente',
  reply: 'Respuesta',
  note: 'Nota interna',
};

export type MessageEmailStatus = 'pending' | 'sending' | 'sent' | 'failed';

export function messageEmailBadge(status: MessageEmailStatus | null): {
  label: string;
  tone: BadgeTone;
} {
  switch (status) {
    case 'sent':
      return { label: 'Enviada por email', tone: 'success' };
    case 'failed':
      return { label: 'No se pudo enviar', tone: 'danger' };
    case 'sending':
      return { label: 'Enviando', tone: 'accent' };
    default:
      return { label: 'En cola de envío', tone: 'neutral' };
  }
}

/** Cambios de estado a mano que ofrece la ficha, con su botón. */
export type StatusAction = {
  to: ConversationStatus;
  label: string;
  variant: 'outline' | 'danger';
};

const STATUS_ACTION_LABELS: Readonly<
  Record<ConversationStatus, Omit<StatusAction, 'to'>>
> = {
  resolved: { label: 'Marcar como resuelta', variant: 'outline' },
  open: { label: 'Reabrir', variant: 'outline' },
  spam: { label: 'Es spam', variant: 'danger' },
  waiting_customer: { label: 'Esperando al cliente', variant: 'outline' },
};

export function statusActions(status: ConversationStatus): StatusAction[] {
  return MANUAL_STATUS_CHANGES[status].map((to) => ({
    to,
    ...STATUS_ACTION_LABELS[to],
  }));
}

/** Fuera de plazo con el plazo de la tienda (24 h). */
export function overdue(conversation: ConversationClock, now: Date): boolean {
  return isOverdue(conversation, now, RESPONSE_TARGET_MINUTES);
}

// ---------------------------------------------------------------------------
// Vistas de la lista
// ---------------------------------------------------------------------------

export const INBOX_VIEWS = [
  'por-responder',
  'esperando',
  'mias',
  'resueltas',
  'spam',
  'todas',
] as const;
export type InboxView = (typeof INBOX_VIEWS)[number];

export const INBOX_VIEW_LABELS: Readonly<Record<InboxView, string>> = {
  'por-responder': 'Por responder',
  esperando: 'Esperando al cliente',
  mias: 'Asignadas a mí',
  resueltas: 'Resueltas',
  spam: 'Spam',
  todas: 'Todas',
};

export type InboxFacts = {
  status: ConversationStatus;
  assignedTo: string | null;
};

export function matchesInboxView(
  conversation: InboxFacts,
  view: InboxView,
  me: string,
): boolean {
  switch (view) {
    case 'por-responder':
      return conversation.status === 'open';
    case 'esperando':
      return conversation.status === 'waiting_customer';
    case 'mias':
      return (
        conversation.assignedTo === me &&
        (conversation.status === 'open' ||
          conversation.status === 'waiting_customer')
      );
    case 'resueltas':
      return conversation.status === 'resolved';
    case 'spam':
      return conversation.status === 'spam';
    case 'todas':
      return true;
  }
}

export function parseInboxView(value: unknown): InboxView {
  return INBOX_VIEWS.find((view) => view === value) ?? 'por-responder';
}

export function inboxViewHref(view: InboxView): string {
  return view === 'por-responder'
    ? '/admin/mensajes'
    : `/admin/mensajes?vista=${view}`;
}

export function conversationNumberLabel(number: number): string {
  return `Consulta nº ${number}`;
}

/** Errores de las funciones de la migración, en palabras del panel. */
export const MESSAGE_ERRORS: Readonly<Record<string, string>> = {
  forbidden:
    'No tienes permiso para esto o falta la verificación en dos pasos.',
  unknown_conversation: 'Esa conversación ya no existe.',
  stale_revision:
    'La conversación ha cambiado mientras la mirabas (otra respuesta o un cambio de estado). Recarga la página y vuelve a intentarlo.',
  invalid_message: 'Escribe un texto de entre 1 y 5000 caracteres.',
  conversation_spam:
    'Está marcada como spam: reábrela antes de responder si no lo es.',
  invalid_transition: 'Ese cambio de estado no es posible desde el actual.',
  invalid_assignee:
    'Solo se puede asignar a personal activo que pueda responder mensajes.',
  unknown_order: 'No hay ningún pedido con ese número.',
  invalid_template: 'Revisa el título (hasta 80), el idioma y el texto.',
  unknown_template: 'Esa plantilla ya no existe.',
  duplicate_template: 'Ya hay una plantilla con ese título en ese idioma.',
};
