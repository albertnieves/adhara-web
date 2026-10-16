/**
 * Bandeja de mensajes con clientes (docs/ADMIN_PLAN.md, fase A6). Una
 * conversación agrupa mensajes de un canal y puede enlazar cliente y pedido.
 * Los borradores del agente nunca se envían sin revisión humana.
 */
export const CHANNELS = ['web_form', 'email', 'whatsapp'] as const;
export type Channel = (typeof CHANNELS)[number];

export const CONVERSATION_STATUSES = [
  'open',
  'waiting_customer',
  'resolved',
  'spam',
] as const;
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];

export type MessageAuthor = 'customer' | 'staff' | 'agent';

/** Tema que elige el cliente en el formulario de contacto. */
export const TOPICS = ['order', 'product', 'other'] as const;
export type Topic = (typeof TOPICS)[number];

/**
 * Mensajes guardados (migración 20261016120000_customer_messages): del
 * cliente, respuesta del personal (sale por email) y nota interna.
 */
export const MESSAGE_KINDS = ['customer', 'reply', 'note'] as const;
export type MessageKind = (typeof MESSAGE_KINDS)[number];

/** Plazo de respuesta: 24 horas naturales (DECISIONS §156). */
export const RESPONSE_TARGET_MINUTES = 24 * 60;

/** Estado tras registrar un mensaje; null si el mensaje no procede. */
export function statusAfterMessage(
  status: ConversationStatus,
  author: MessageAuthor,
): ConversationStatus | null {
  if (author === 'agent') return status;
  if (author === 'customer') return status === 'spam' ? 'spam' : 'open';
  return status === 'spam' ? null : 'waiting_customer';
}

export const MANUAL_STATUS_CHANGES: Readonly<
  Record<ConversationStatus, readonly ConversationStatus[]>
> = {
  open: ['resolved', 'spam'],
  waiting_customer: ['resolved', 'spam'],
  resolved: ['open'],
  spam: ['open'],
};

export function canSetStatus(
  from: ConversationStatus,
  to: ConversationStatus,
): boolean {
  return MANUAL_STATUS_CHANGES[from].includes(to);
}

/** Un mensaje del agente es un borrador: solo sale si una persona lo aprueba. */
export function requiresHumanReview(author: MessageAuthor): boolean {
  return author === 'agent';
}

export type ConversationClock = {
  status: ConversationStatus;
  lastCustomerMessageAt: Date | null;
  lastStaffMessageAt: Date | null;
};

/** Pendiente de respuesta más allá del plazo acordado (en minutos naturales). */
export function isOverdue(
  conversation: ConversationClock,
  now: Date,
  responseTargetMinutes: number,
): boolean {
  const { status, lastCustomerMessageAt, lastStaffMessageAt } = conversation;
  if (status !== 'open' || lastCustomerMessageAt === null) return false;
  if (
    lastStaffMessageAt !== null &&
    lastStaffMessageAt >= lastCustomerMessageAt
  ) {
    return false;
  }
  const waitingMs = now.getTime() - lastCustomerMessageAt.getTime();
  return waitingMs > responseTargetMinutes * 60_000;
}
