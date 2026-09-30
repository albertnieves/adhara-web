import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  MOVEMENT_EFFECTS,
  MOVEMENT_PERMISSIONS,
  MOVEMENT_TYPES,
  isSignedMovement,
  requiresReason,
} from '@/modules/inventory';

const sql = readFileSync(
  new URL(
    '../../supabase/migrations/20260929220840_inventory.sql',
    import.meta.url,
  ),
  'utf8',
);

function between(start: string, end: string): string {
  const block = sql.split(start)[1]?.split(end)[0];
  if (!block) throw new Error(`Bloque no encontrado: ${start}`);
  return block;
}

describe('la migración de inventario repite las reglas del dominio', () => {
  it('mismos tipos de movimiento en el CHECK', () => {
    const block = between('type text not null check (type in (', '))');
    const types = [...block.matchAll(/'([A-Z_]+)'/g)].map((match) => match[1]);
    expect(types).toEqual([...MOVEMENT_TYPES]);
  });

  it('mismo efecto de cada tipo sobre on_hand y reserved', () => {
    const block = between('from (values', ') as e(type, on_hand, reserved)');
    const rows = [...block.matchAll(/\('([A-Z_]+)', (-?\d), (-?\d)\)/g)];
    const effects = Object.fromEntries(
      rows.map(([, type, onHand, reserved]) => [
        type,
        { onHand: Number(onHand), reserved: Number(reserved) },
      ]),
    );
    expect(effects).toEqual(MOVEMENT_EFFECTS);
  });

  it('mismo permiso por tipo; los automáticos no se registran a mano', () => {
    const block = between('select case p_type', 'end;');
    const mapped = Object.fromEntries(
      [...block.matchAll(/when '([A-Z_]+)' then '([a-z_.]+)'/g)].map(
        ([, type, permission]) => [type, permission],
      ),
    );
    const expected = Object.fromEntries(
      Object.entries(MOVEMENT_PERMISSIONS).filter(([, p]) => p !== null),
    );
    expect(mapped).toEqual(expected);
  });

  it('mismos tipos con signo y con motivo obligatorio', () => {
    const listAfter = (marker: string) =>
      [...between(marker, ')').matchAll(/'([A-Z_]+)'/g)]
        .map((match) => match[1])
        .sort();
    expect(listAfter('(p_quantity < 0 and p_type not in (')).toEqual(
      MOVEMENT_TYPES.filter(isSignedMovement).sort(),
    );
    expect(listAfter('if p_type in (')).toEqual(
      MOVEMENT_TYPES.filter(requiresReason).sort(),
    );
  });
});
