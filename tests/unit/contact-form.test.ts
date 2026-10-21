import { describe, expect, it } from 'vitest';
import ca from '../../messages/ca.json';
import en from '../../messages/en.json';
import es from '../../messages/es.json';
import {
  CONTACT_ERRORS,
  INBOX_VIEWS,
  RESPONSE_TARGET_MINUTES,
  contactFieldErrors,
  contactInput,
  matchesInboxView,
  overdue,
  parseInboxView,
  statusActions,
} from '@/modules/messaging';

const VALID = {
  requestId: '6f1b8f4e-8a1f-4e8b-9a43-1d2b3c4d5e6f',
  locale: 'es',
  topic: 'order',
  fullName: '  Clienta ',
  email: ' Clienta@Example.COM ',
  orderNumber: '',
  subject: '',
  message: ' Hola ',
};

describe('formulario de contacto', () => {
  it('normaliza el email y recorta los textos', () => {
    const parsed = contactInput.parse(VALID);
    expect(parsed).toMatchObject({
      fullName: 'Clienta',
      email: 'clienta@example.com',
      orderNumber: null,
      subject: '',
      message: 'Hola',
    });
  });

  it('acepta el número de pedido como «1001», «Nº 1001» o «#1001»', () => {
    for (const value of ['1001', 'Nº 1001', 'nº1001', '#1001', 'No. 1001'])
      expect(
        contactInput.parse({ ...VALID, orderNumber: value }).orderNumber,
      ).toBe(1001);
  });

  it('cada error con su clave de texto', () => {
    const result = contactInput.safeParse({
      ...VALID,
      fullName: ' ',
      email: 'no-email',
      orderNumber: 'abc',
      message: 'x'.repeat(5001),
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(contactFieldErrors(result.error.issues)).toEqual({
      fullName: 'nameRequired',
      email: 'emailInvalid',
      orderNumber: 'orderNumberInvalid',
      message: 'messageTooLong',
    });
  });

  it('los tres idiomas tienen los textos y los errores', () => {
    for (const copy of [es, ca, en]) {
      expect(Object.keys(copy.contact.errors).sort()).toEqual(
        [...CONTACT_ERRORS, 'fields'].sort(),
      );
      expect(Object.keys(copy.contact.topics)).toEqual([
        'order',
        'product',
        'other',
      ]);
      expect(copy.contact.privacy).toMatch(/<link>.+<\/link>/);
    }
  });
});

describe('bandeja del panel', () => {
  const me = 'u-1';
  it('vistas por estado y las asignadas a mí abiertas', () => {
    expect(
      matchesInboxView(
        { status: 'open', assignedTo: null },
        'por-responder',
        me,
      ),
    ).toBe(true);
    expect(
      matchesInboxView(
        { status: 'waiting_customer', assignedTo: me },
        'mias',
        me,
      ),
    ).toBe(true);
    expect(
      matchesInboxView({ status: 'resolved', assignedTo: me }, 'mias', me),
    ).toBe(false);
    expect(
      matchesInboxView({ status: 'spam', assignedTo: null }, 'todas', me),
    ).toBe(true);
    expect(parseInboxView('spam')).toBe('spam');
    expect(parseInboxView('otra')).toBe('por-responder');
    expect(INBOX_VIEWS[0]).toBe('por-responder');
  });

  it('botones de estado según el actual', () => {
    expect(statusActions('open').map((a) => a.to)).toEqual([
      'resolved',
      'spam',
    ]);
    expect(statusActions('resolved').map((a) => a.to)).toEqual(['open']);
    expect(statusActions('spam').map((a) => a.label)).toEqual(['Reabrir']);
  });

  it('fuera de plazo a las 24 horas sin respuesta', () => {
    expect(RESPONSE_TARGET_MINUTES).toBe(1440);
    const now = new Date('2026-10-16T12:00:00Z');
    const clock = (hoursAgo: number) => ({
      status: 'open' as const,
      lastCustomerMessageAt: new Date(now.getTime() - hoursAgo * 3_600_000),
      lastStaffMessageAt: null,
    });
    expect(overdue(clock(23), now)).toBe(false);
    expect(overdue(clock(25), now)).toBe(true);
  });
});
