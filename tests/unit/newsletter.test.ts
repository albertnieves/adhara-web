import { describe, expect, it } from 'vitest';
import {
  CONSENT_VERSION,
  subscribeInput,
  subscriberStatus,
} from '../../src/modules/newsletter/domain';

describe('suscripción a promociones', () => {
  it('normaliza el email y exige el consentimiento', () => {
    const ok = subscribeInput.safeParse({
      email: '  Ana@Example.COM ',
      consent: 'on',
      locale: 'ca',
    });
    expect(ok.success && ok.data.email).toBe('ana@example.com');
    expect(
      subscribeInput.safeParse({ email: 'ana@example.com', locale: 'es' })
        .success,
    ).toBe(false);
  });

  it('rechaza emails no válidos e idiomas desconocidos', () => {
    for (const email of ['', 'ana', 'ana@', '@example.com', 'a b@c.com'])
      expect(
        subscribeInput.safeParse({ email, consent: 'on', locale: 'es' })
          .success,
      ).toBe(false);
    expect(
      subscribeInput.safeParse({
        email: 'ana@example.com',
        consent: 'on',
        locale: 'fr',
      }).success,
    ).toBe(false);
  });

  it('la versión del consentimiento cabe en la base (1–40)', () => {
    expect(CONSENT_VERSION.length).toBeGreaterThan(0);
    expect(CONSENT_VERSION.length).toBeLessThanOrEqual(40);
  });

  it('estado para el personal: baja, pendiente o en Sender', () => {
    expect(subscriberStatus({ unsubscribedAt: 'x', senderSyncedAt: 'y' })).toBe(
      'unsubscribed',
    );
    expect(
      subscriberStatus({ unsubscribedAt: null, senderSyncedAt: null }),
    ).toBe('pending');
    expect(
      subscriberStatus({ unsubscribedAt: null, senderSyncedAt: 'y' }),
    ).toBe('synced');
  });
});
