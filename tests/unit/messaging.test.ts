import { describe, expect, it } from 'vitest';
import {
  canSetStatus,
  isOverdue,
  requiresHumanReview,
  statusAfterMessage,
} from '@/modules/messaging';

describe('conversaciones con clientes', () => {
  it('la respuesta del cliente reabre y la del personal deja en espera', () => {
    expect(statusAfterMessage('resolved', 'customer')).toBe('open');
    expect(statusAfterMessage('waiting_customer', 'customer')).toBe('open');
    expect(statusAfterMessage('open', 'staff')).toBe('waiting_customer');
    expect(statusAfterMessage('spam', 'customer')).toBe('spam');
    expect(statusAfterMessage('spam', 'staff')).toBeNull();
  });

  it('un borrador del agente no cambia el estado y exige revisión', () => {
    expect(statusAfterMessage('open', 'agent')).toBe('open');
    expect(requiresHumanReview('agent')).toBe(true);
    expect(requiresHumanReview('staff')).toBe(false);
  });

  it('limita los cambios manuales de estado', () => {
    expect(canSetStatus('open', 'resolved')).toBe(true);
    expect(canSetStatus('spam', 'open')).toBe(true);
    expect(canSetStatus('resolved', 'waiting_customer')).toBe(false);
  });

  it('marca como vencida la conversación sin respuesta en plazo', () => {
    const now = new Date('2026-09-29T12:00:00Z');
    const waiting = {
      status: 'open',
      lastCustomerMessageAt: new Date('2026-09-29T09:00:00Z'),
      lastStaffMessageAt: new Date('2026-09-28T18:00:00Z'),
    } as const;
    expect(isOverdue(waiting, now, 120)).toBe(true);
    expect(isOverdue(waiting, now, 240)).toBe(false);
    expect(
      isOverdue(
        { ...waiting, lastStaffMessageAt: new Date('2026-09-29T10:00:00Z') },
        now,
        120,
      ),
    ).toBe(false);
    expect(isOverdue({ ...waiting, status: 'resolved' }, now, 120)).toBe(false);
  });
});
