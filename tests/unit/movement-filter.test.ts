import { describe, expect, it } from 'vitest';
import {
  madridMidnight,
  parseMovementFilter,
} from '@/modules/inventory/domain/movement-filter';

describe('filtros del historial de movimientos', () => {
  it('convierte días de Madrid a UTC, también con cambio de hora', () => {
    expect(madridMidnight('2026-09-30')).toBe('2026-09-29T22:00:00.000Z');
    expect(madridMidnight('2026-12-01')).toBe('2026-11-30T23:00:00.000Z');
    // Último domingo de marzo y de octubre de 2026.
    expect(madridMidnight('2026-03-29')).toBe('2026-03-28T23:00:00.000Z');
    expect(madridMidnight('2026-10-25')).toBe('2026-10-24T22:00:00.000Z');
  });

  it('«hasta» incluye el día completo', () => {
    const filter = parseMovementFilter({
      desde: '2026-09-01',
      hasta: '2026-09-30',
    });
    expect(filter.from).toBe('2026-08-31T22:00:00.000Z');
    expect(filter.to).toBe('2026-09-30T22:00:00.000Z');
    expect(filter.search.toString()).toBe('desde=2026-09-01&hasta=2026-09-30');
  });

  it('descarta valores no válidos', () => {
    const filter = parseMovementFilter({
      perfume: "x' or 1=1",
      tipo: 'BORRAR_TODO',
      desde: '2026-02-30',
      hasta: 'ayer',
    });
    expect(filter).toEqual({ search: new URLSearchParams() });
  });

  it('acepta perfume y tipo conocidos', () => {
    const filter = parseMovementFilter({
      perfume: '86e690ee-7d09-4d7f-9826-e06beb11a122',
      tipo: 'SALE_STORE',
    });
    expect(filter.productId).toBe('86e690ee-7d09-4d7f-9826-e06beb11a122');
    expect(filter.type).toBe('SALE_STORE');
  });
});
