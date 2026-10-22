import 'server-only';
import { chunk, fetchAll } from '@/lib/supabase/paginate';
import type { StaffContext } from '@/modules/auth/server';
import type {
  Channel,
  ConversationStatus,
  MessageKind,
  Topic,
} from '../domain/conversations';
import type { MessageEmailStatus } from '../domain/labels';
import { overdue } from '../domain/labels';

/*
 * Lecturas de la bandeja con la sesión de quien mira: la RLS exige
 * messages.view y, para el nombre y el email del cliente, también
 * customers.view. Sin ese permiso ni siquiera se piden (withCustomer).
 */

type Supabase = StaffContext['supabase'];

export type ConversationRow = {
  id: string;
  number: number;
  channel: Channel;
  status: ConversationStatus;
  topic: Topic;
  subject: string;
  locale: 'es' | 'ca' | 'en';
  orderId: string | null;
  assignedTo: string | null;
  lastCustomerMessageAt: string | null;
  lastStaffMessageAt: string | null;
  lastMessageAt: string;
  createdAt: string;
  revision: number;
  overdue: boolean;
  /** null sin customers.view. */
  customerName: string | null;
};

const CONVERSATION_COLUMNS =
  'id, number, channel, status, topic, subject, locale, order_id, assigned_to, last_customer_message_at, last_staff_message_at, last_message_at, created_at, revision';

type ConversationRecord = {
  id: string;
  number: number;
  channel: string;
  status: string;
  topic: string;
  subject: string;
  locale: string;
  order_id: string | null;
  assigned_to: string | null;
  last_customer_message_at: string | null;
  last_staff_message_at: string | null;
  last_message_at: string;
  created_at: string;
  revision: number;
};

function toRow(
  row: ConversationRecord,
  now: Date,
  customerName: string | null,
): ConversationRow {
  const status = row.status as ConversationStatus;
  return {
    id: row.id,
    number: row.number,
    channel: row.channel as Channel,
    status,
    topic: row.topic as Topic,
    subject: row.subject,
    locale: row.locale as ConversationRow['locale'],
    orderId: row.order_id,
    assignedTo: row.assigned_to,
    lastCustomerMessageAt: row.last_customer_message_at,
    lastStaffMessageAt: row.last_staff_message_at,
    lastMessageAt: row.last_message_at,
    createdAt: row.created_at,
    revision: row.revision,
    overdue: overdue(
      {
        status,
        lastCustomerMessageAt: row.last_customer_message_at
          ? new Date(row.last_customer_message_at)
          : null,
        lastStaffMessageAt: row.last_staff_message_at
          ? new Date(row.last_staff_message_at)
          : null,
      },
      now,
    ),
    customerName,
  };
}

/** Nombre (o, sin nombre, email) del cliente de cada conversación. */
async function customerNames(
  supabase: Supabase,
  ids: string[],
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  // `.in()` viaja en la URL: tramos de 100 ids para no pasar del límite.
  for (const part of chunk(ids, 100)) {
    const { data, error } = await supabase
      .from('conversation_contacts')
      .select('conversation_id, full_name, email')
      .in('conversation_id', part);
    if (error) throw new Error(error.message);
    for (const contact of data ?? [])
      names.set(contact.conversation_id, contact.full_name ?? contact.email);
  }
  return names;
}

export async function listConversations(
  supabase: Supabase,
  options: { withCustomer: boolean },
  now: Date = new Date(),
): Promise<ConversationRow[]> {
  const rows = await fetchAll((from, to) =>
    supabase
      .from('conversations')
      .select(CONVERSATION_COLUMNS)
      .order('last_message_at', { ascending: false })
      .order('id')
      .range(from, to),
  );
  const names =
    options.withCustomer && rows.length > 0
      ? await customerNames(
          supabase,
          rows.map((row) => row.id),
        )
      : new Map<string, string>();
  return rows.map((row) => toRow(row, now, names.get(row.id) ?? null));
}

/** Para el inicio del panel: por responder y, de ellas, fuera de plazo. */
export async function countOpenConversations(
  supabase: Supabase,
  now: Date = new Date(),
): Promise<{ open: number; overdue: number }> {
  const { data, error } = await supabase
    .from('conversations')
    .select('status, last_customer_message_at, last_staff_message_at')
    .eq('status', 'open')
    .limit(1000);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  return {
    open: rows.length,
    overdue: rows.filter((row) =>
      overdue(
        {
          status: 'open',
          lastCustomerMessageAt: row.last_customer_message_at
            ? new Date(row.last_customer_message_at)
            : null,
          lastStaffMessageAt: row.last_staff_message_at
            ? new Date(row.last_staff_message_at)
            : null,
        },
        now,
      ),
    ).length,
  };
}

export type ConversationMessage = {
  id: number;
  kind: MessageKind;
  source: 'web_form' | 'email' | 'panel';
  body: string;
  authorId: string | null;
  attachments: number;
  createdAt: string;
  /** Solo las respuestas: estado de su correo. */
  emailStatus: MessageEmailStatus | null;
  emailError: string | null;
};

export type ConversationDetail = {
  conversation: ConversationRow;
  /** null sin customers.view. */
  contact: { fullName: string | null; email: string } | null;
  messages: ConversationMessage[];
  order: { id: string; number: number } | null;
};

export async function getConversation(
  supabase: Supabase,
  id: string,
  options: { withCustomer: boolean },
  now: Date = new Date(),
): Promise<ConversationDetail | null> {
  const { data: row, error } = await supabase
    .from('conversations')
    .select(CONVERSATION_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) return null;

  const [messages, contact, order] = await Promise.all([
    supabase
      .from('conversation_messages')
      .select(
        'id, kind, source, body, author_id, attachments, created_at, message_emails(status, last_error)',
      )
      .eq('conversation_id', id)
      .order('created_at')
      .order('id'),
    options.withCustomer
      ? supabase
          .from('conversation_contacts')
          .select('full_name, email')
          .eq('conversation_id', id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    row.order_id
      ? supabase
          .from('orders')
          .select('id, number')
          .eq('id', row.order_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (messages.error) throw new Error(messages.error.message);
  if (contact.error) throw new Error(contact.error.message);
  if (order.error) throw new Error(order.error.message);

  const name = contact.data
    ? (contact.data.full_name ?? contact.data.email)
    : null;
  return {
    conversation: toRow(row, now, name),
    contact: contact.data
      ? { fullName: contact.data.full_name, email: contact.data.email }
      : null,
    messages: (messages.data ?? []).map((message) => {
      const email = Array.isArray(message.message_emails)
        ? message.message_emails[0]
        : message.message_emails;
      return {
        id: message.id,
        kind: message.kind as MessageKind,
        source: message.source as ConversationMessage['source'],
        body: message.body,
        authorId: message.author_id,
        attachments: message.attachments,
        createdAt: message.created_at,
        emailStatus: (email?.status as MessageEmailStatus | undefined) ?? null,
        emailError: email?.last_error ?? null,
      };
    }),
    order: order.data,
  };
}

export type Assignee = { userId: string; name: string };

/** Personal activo que puede responder (para asignar y para firmar el hilo). */
export async function listAssignees(supabase: Supabase): Promise<Assignee[]> {
  const { data, error } = await supabase.rpc('admin_message_assignees');
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({ userId: row.user_id, name: row.name }));
}

export type MessageTemplate = {
  id: string;
  title: string;
  locale: 'es' | 'ca' | 'en';
  body: string;
  active: boolean;
  revision: number;
  updatedAt: string;
};

export async function listMessageTemplates(
  supabase: Supabase,
  options: { onlyActive?: boolean } = {},
): Promise<MessageTemplate[]> {
  let query = supabase
    .from('message_templates')
    .select('id, title, locale, body, active, revision, updated_at')
    .order('title')
    .order('locale');
  if (options.onlyActive) query = query.eq('active', true);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    locale: row.locale as MessageTemplate['locale'],
    body: row.body,
    active: row.active,
    revision: row.revision,
    updatedAt: row.updated_at,
  }));
}
