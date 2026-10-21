import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CHANNELS,
  CONVERSATION_STATUSES,
  MANUAL_STATUS_CHANGES,
  MESSAGE_KINDS,
  TOPICS,
  statusAfterMessage,
} from '@/modules/messaging';

const sql = readFileSync(
  new URL(
    '../../supabase/migrations/20261021120000_customer_messages.sql',
    import.meta.url,
  ),
  'utf8',
);

function between(start: string, end: string): string {
  const block = sql.split(start)[1]?.split(end)[0];
  if (!block) throw new Error(`Bloque no encontrado: ${start}`);
  return block;
}

describe('la migración de mensajes repite las reglas del dominio', () => {
  it('mismos canales, estados, temas y tipos de mensaje', () => {
    const list = (values: readonly string[]) =>
      values.map((value) => `'${value}'`).join(', ');
    expect(sql).toContain(`check (channel in (${list(CHANNELS)}))`);
    expect(sql).toContain(`check (status in (${list(CONVERSATION_STATUSES)}))`);
    expect(sql).toContain(`check (topic in (${list(TOPICS)}))`);
    expect(sql).toContain(`check (kind in (${list(MESSAGE_KINDS)}))`);
  });

  it('mismos cambios de estado a mano, en el mismo orden', () => {
    const block = between('select (p_from, p_to) in (', ');');
    const pairs = [...block.matchAll(/\('([a-z_]+)', '([a-z_]+)'\)/g)].map(
      ([, from, to]) => [from, to],
    );
    const expected = CONVERSATION_STATUSES.flatMap((from) =>
      MANUAL_STATUS_CHANGES[from].map((to) => [from, to]),
    );
    expect(pairs).toEqual(expected);
  });

  it('mismo efecto de un mensaje del cliente o de una respuesta', () => {
    const block = between(
      'create function private.message_status_after',
      '$$;',
    );
    expect(block).toContain(
      "when 'customer' then case when p_status = 'spam' then 'spam' else 'open' end",
    );
    expect(block).toContain(
      "when 'reply' then case when p_status = 'spam' then null else 'waiting_customer' end",
    );
    for (const status of CONVERSATION_STATUSES) {
      expect(statusAfterMessage(status, 'customer')).toBe(
        status === 'spam' ? 'spam' : 'open',
      );
      expect(statusAfterMessage(status, 'staff')).toBe(
        status === 'spam' ? null : 'waiting_customer',
      );
    }
  });

  it('las funciones del servidor solo para service_role y las del panel nunca para anon', () => {
    const server = between(
      '-- Solo el servidor con la clave privilegiada.',
      '-- El panel',
    );
    for (const name of [
      'web_contact_submit',
      'web_inbound_email_record',
      'web_message_emails_claim',
      'web_message_email_result',
    ])
      expect(server.match(new RegExp(`public\\.${name}\\(`, 'g'))).toHaveLength(
        2,
      );
    expect(server).toContain('from public, anon, authenticated;');
    expect(server).toContain('to service_role;');
    const panel = sql.split(
      '-- El panel: permiso y MFA se comprueban dentro.',
    )[1];
    expect(panel).toContain('from public, anon;');
    expect(panel).toContain('to authenticated;');
  });
});
