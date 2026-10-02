import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  DAILY_TASK_KEYS,
  DAILY_TASK_PERMISSIONS,
  DAILY_SUMMARY_SYSTEM,
  CHAT_SYSTEM,
  buildDailyReport,
  isReportDay,
  previousDay,
} from '@/modules/assistant';
import type { DailyReportInput } from '@/modules/assistant';
import { PERMISSIONS } from '@/modules/auth';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const read = (path: string) => readFileSync(`${ROOT}/${path}`, 'utf8');

const item = (product: string, variant = '100 ml') => ({
  product,
  brand: 'Lattafa',
  variant,
});

function input(overrides: Partial<DailyReportInput> = {}): DailyReportInput {
  return {
    day: '2026-10-01',
    generatedAt: new Date('2026-10-02T05:15:00Z'),
    locationName: 'Tienda de Castelldefels',
    movements: [
      {
        ...item('Asad'),
        variantId: 'a',
        type: 'SALE_STORE',
        deltaOnHand: -2,
        reference: 'T-1',
      },
      {
        ...item('Asad'),
        variantId: 'a',
        type: 'SALE_STORE',
        deltaOnHand: -1,
        reference: 'T-2',
      },
      {
        ...item('Yara'),
        variantId: 'y',
        type: 'SALE_STORE',
        deltaOnHand: -1,
        reference: 'T-2',
      },
      {
        ...item('Yara'),
        variantId: 'y',
        type: 'PURCHASE_RECEIPT',
        deltaOnHand: 20,
        reference: null,
      },
      {
        ...item('Yara'),
        variantId: 'y',
        type: 'STOCKTAKE_ADJUSTMENT',
        deltaOnHand: -1,
        reference: null,
      },
      {
        ...item('Yara'),
        variantId: 'y',
        type: 'RESERVATION',
        deltaOnHand: 0,
        reference: null,
      },
    ],
    stock: [
      {
        ...item('Asad'),
        variantId: 'a',
        active: true,
        onHand: 0,
        reserved: 0,
        reorderPoint: 2,
      },
      {
        ...item('Yara'),
        variantId: 'y',
        active: true,
        onHand: 3,
        reserved: 1,
        reorderPoint: 2,
      },
      {
        ...item('Khamrah'),
        variantId: 'k',
        active: true,
        onHand: 0,
        reserved: 0,
        reorderPoint: null,
      },
    ],
    // Khamrah está a 0 pero el vigilante no lo marca (nunca tuvo stock).
    findings: [
      {
        kind: 'below_min',
        severity: 'warning',
        variantId: 'y',
        proposedUnits: 6,
      },
      {
        kind: 'out_of_stock',
        severity: 'critical',
        variantId: 'a',
        proposedUnits: null,
      },
    ],
    openOrders: [
      {
        number: 'PC-2026-0001',
        status: 'ordered',
        expectedOn: '2026-09-28',
        unitsOrdered: 10,
        unitsReceived: 4,
      },
      {
        number: 'PC-2026-0002',
        status: 'ordered',
        expectedOn: '2026-10-05',
        unitsOrdered: 5,
        unitsReceived: 0,
      },
    ],
    catalog: [
      {
        status: 'published',
        hasImage: true,
        missingTranslations: 0,
        activeVariants: 1,
        activeWithoutPrice: 0,
      },
      {
        status: 'draft',
        hasImage: false,
        missingTranslations: 2,
        activeVariants: 0,
        activeWithoutPrice: 0,
      },
      {
        status: 'archived',
        hasImage: false,
        missingTranslations: 3,
        activeVariants: 0,
        activeWithoutPrice: 0,
      },
    ],
    ...overrides,
  };
}

describe('informe diario', () => {
  const report = buildDailyReport(input());

  it('suma la actividad por categoría, con los ajustes con signo', () => {
    expect(report.activity.movements).toBe(6);
    expect(report.activity.units).toEqual({
      received: 20,
      sold: 4,
      returned: 0,
      lost: 0,
      adjusted: -1,
      transferred: 0,
    });
    expect(report.activity.storeTickets).toBe(2);
    expect(report.activity.topSold).toEqual([
      { ...item('Asad'), units: 3 },
      { ...item('Yara'), units: 1 },
    ]);
  });

  it('toma agotados y stock bajo del vigilante, no del nivel a cero', () => {
    expect(report.stock.outOfStock).toEqual({
      count: 1,
      items: [item('Asad')],
    });
    expect(report.stock.low).toEqual({
      count: 1,
      items: [{ ...item('Yara'), available: 2, reorderPoint: 2 }],
    });
    expect(report.stock.unitsOnHand).toBe(3);
    expect(report.watch.items.map((f) => f.severity)).toEqual([
      'critical',
      'warning',
    ]);
    expect(report.watch.reorderProposals).toBe(1);
  });

  it('marca los pedidos vencidos y lo pendiente de recibir', () => {
    expect(report.purchasing).toEqual({
      open: 2,
      unitsPending: 11,
      overdue: [
        { number: 'PC-2026-0001', expectedOn: '2026-09-28', unitsPending: 6 },
      ],
    });
  });

  it('cuenta el catálogo sin los archivados', () => {
    expect(report.catalog).toEqual({
      published: 1,
      drafts: 1,
      missingPrice: 1,
      missingImage: 1,
      missingTranslations: 1,
    });
  });

  it('solo lista tareas con algo pendiente, cada una con su pantalla', () => {
    expect(report.tasks.map((t) => [t.key, t.count])).toEqual([
      ['reorder', 1],
      ['overdue', 1],
      ['out', 1],
      ['low', 1],
      ['price', 1],
      ['image', 1],
      ['translations', 1],
    ]);
    expect(report.tasks.every((t) => t.href.startsWith('/admin/'))).toBe(true);
  });

  it('un día sin datos da un informe vacío, sin inventar nada', () => {
    const empty = buildDailyReport(
      input({
        movements: [],
        stock: [],
        findings: [],
        openOrders: [],
        catalog: [],
      }),
    );
    expect(empty.tasks).toEqual([]);
    expect(empty.activity.topSold).toEqual([]);
    expect(empty.stock.unitsOnHand).toBe(0);
  });

  it('no guarda costes ni importes', () => {
    expect(JSON.stringify(report)).not.toMatch(/cost|cents|€|importe/i);
  });

  it('cada tarea tiene un permiso del panel', () => {
    for (const key of DAILY_TASK_KEYS)
      expect(PERMISSIONS).toContain(DAILY_TASK_PERMISSIONS[key]);
  });

  it('fechas de la tienda', () => {
    expect(previousDay('2026-10-01')).toBe('2026-09-30');
    expect(previousDay('2026-03-01')).toBe('2026-02-28');
    expect(isReportDay('2026-02-30')).toBe(false);
    expect(isReportDay('2026-10-01')).toBe(true);
    expect(isReportDay(null)).toBe(false);
  });
});

describe('el asistente solo lee', () => {
  const tools = read('src/modules/assistant/server/tools.ts');
  const chat = read('src/modules/assistant/server/chat.ts');

  it('sus herramientas no escriben ni llaman a funciones de escritura', () => {
    expect(tools).not.toMatch(/\.(insert|update|upsert|delete)\(/);
    expect(tools).not.toMatch(/server\/actions|['"]use server['"]/);
    const rpcs = [...tools.matchAll(/\.rpc\(\s*'([a-z_]+)'/g)].map((m) => m[1]);
    expect(rpcs).toEqual([]);
  });

  it('las herramientas usan la sesión de quien pregunta, no la clave privilegiada', () => {
    expect(tools + chat).not.toMatch(/createJobClient|createAuthAdminClient/);
    expect(tools).toMatch(/const \{ supabase \} = staff;/);
  });

  it('el chat solo escribe su propio registro de uso', () => {
    const writes = [
      ...chat.matchAll(/\.from\('([a-z_]+)'\)\.(insert|update|upsert|delete)/g),
    ];
    expect(writes.map((m) => `${m[1]}.${m[2]}`)).toEqual([
      'assistant_usage.insert',
    ]);
  });

  it('las instrucciones prohíben inventar datos y cambiar stock o precios', () => {
    expect(CHAT_SYSTEM).toMatch(/nunca lo supongas/);
    expect(CHAT_SYSTEM).toMatch(
      /No puedes registrar movimientos, cambiar precios/,
    );
    expect(DAILY_SUMMARY_SYSTEM).toMatch(/No inventes/);
    // Sin fechas ni datos variables: el prefijo se puede cachear.
    expect(CHAT_SYSTEM + DAILY_SUMMARY_SYSTEM).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});
