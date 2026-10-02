import 'server-only';
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { BetaToolRunnerParams } from '@anthropic-ai/sdk/lib/tools/BetaToolRunner';
import { z } from 'zod';
import { isAllowed } from '@/modules/auth';
import type { StaffContext } from '@/modules/auth/server';
import { listAdminProducts } from '@/modules/catalog/server/admin';
import {
  FINDING_LABELS,
  MOVEMENT_LABELS,
  MOVEMENT_TYPES,
  SEVERITY_LABELS,
  describeFinding,
} from '@/modules/inventory';
import type { MovementType } from '@/modules/inventory';
import {
  getDefaultLocation,
  getStockWatch,
  listMovements,
  listStock,
} from '@/modules/inventory/server';
import { dayRangePeriod, madridDay } from '@/modules/reports';
import { getInventoryPeriod } from '@/modules/reports/server';
import { isReportDay } from '../domain/daily-report';
import { collectDailyReport } from './daily-report';

/*
 * Herramientas del asistente: todas leen con la sesión de quien pregunta
 * (RLS y permisos de su rol) y ninguna escribe. Devuelven JSON compacto y
 * acotado; sin costes, márgenes ni datos personales.
 */

const day = z
  .string()
  .refine(isReportDay, 'Fecha AAAA-MM-DD')
  .describe('Día de la tienda en formato AAAA-MM-DD');

function normalize(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function json(value: unknown) {
  return JSON.stringify(value);
}

type RunnableTool = BetaToolRunnerParams['tools'][number];

export type ToolSet = {
  tools: RunnableTool[];
  labels: Record<string, string>;
};

/** Herramientas permitidas para esta sesión, con su texto para la interfaz. */
export function assistantTools(staff: StaffContext, now = new Date()): ToolSet {
  const { supabase } = staff;
  const can = (permission: Parameters<typeof isAllowed>[1]) =>
    isAllowed({ role: staff.role, aal: 'aal2' }, permission);
  const today = madridDay(now);
  const location = async () => {
    const found = await getDefaultLocation(supabase);
    if (!found) throw new Error('No hay ninguna ubicación activa.');
    return found;
  };

  const tools: { label: string; tool: RunnableTool & { name: string } }[] = [];

  if (can('inventory.view')) {
    tools.push({
      label: 'Consultando el stock',
      tool: betaZodTool({
        name: 'buscar_stock',
        description:
          'Stock actual de la tienda por formato: unidades en tienda, reservadas, disponibles y aviso de stock bajo. Filtra por texto (perfume, marca o SKU) y, si se pide, solo agotados o por debajo del aviso.',
        inputSchema: z.object({
          texto: z
            .string()
            .max(80)
            .optional()
            .describe('Parte del nombre del perfume, la marca o el SKU'),
          solo_bajo: z
            .boolean()
            .optional()
            .describe('Solo formatos agotados o en el punto de pedido'),
          limite: z.number().int().min(1).max(50).optional(),
        }),
        run: async ({ texto, solo_bajo, limite = 20 }) => {
          const rows = await listStock(supabase, (await location()).id);
          const needle = texto ? normalize(texto) : '';
          const matches = rows
            .filter((r) => r.active)
            .filter(
              (r) =>
                !needle ||
                normalize(
                  `${r.brandName} ${r.productName} ${r.sku ?? ''}`,
                ).includes(needle),
            )
            .filter((r) => {
              if (!solo_bajo) return true;
              const available = r.onHand - r.reserved;
              return (
                available <= 0 ||
                (r.reorderPoint !== null && available <= r.reorderPoint)
              );
            });
          return json({
            coincidencias: matches.length,
            filas: matches.slice(0, limite).map((r) => ({
              perfume: r.productName,
              marca: r.brandName,
              formato: r.variantLabel,
              sku: r.sku,
              en_tienda: r.onHand,
              reservado: r.reserved,
              disponible: r.onHand - r.reserved,
              aviso_en: r.reorderPoint,
            })),
          });
        },
      }),
    });

    tools.push({
      label: 'Revisando los movimientos',
      tool: betaZodTool({
        name: 'movimientos',
        description:
          'Movimientos de stock (recepciones, ventas, devoluciones, mermas, ajustes…) más recientes primero, con filtros por tipo, fechas y texto del perfume o la marca.',
        inputSchema: z.object({
          tipo: z.enum(MOVEMENT_TYPES).optional(),
          desde: day.optional(),
          hasta: day.optional(),
          texto: z.string().max(80).optional(),
          limite: z.number().int().min(1).max(100).optional(),
        }),
        run: async ({ tipo, desde, hasta, texto, limite = 30 }) => {
          const period =
            desde || hasta
              ? dayRangePeriod(desde ?? '2026-01-01', hasta ?? today)
              : null;
          if ((desde || hasta) && !period)
            return json({
              error: 'Fechas no válidas: «desde» va antes que «hasta».',
            });
          const rows = await listMovements(supabase, {
            type: tipo,
            from: period?.from,
            to: period?.to,
            limit: texto ? 1000 : limite,
          });
          const needle = texto ? normalize(texto) : '';
          const matches = needle
            ? rows.filter((m) =>
                normalize(`${m.brandName} ${m.productName}`).includes(needle),
              )
            : rows;
          return json({
            mostrados: Math.min(matches.length, limite),
            filas: matches.slice(0, limite).map((m) => ({
              fecha: m.createdAt,
              tipo: MOVEMENT_LABELS[m.type as MovementType] ?? m.type,
              perfume: m.productName,
              marca: m.brandName,
              formato: m.variantLabel,
              cambio: m.deltaOnHand,
              queda: m.onHandAfter,
              motivo: m.reason,
              referencia: m.reference,
            })),
          });
        },
      }),
    });

    tools.push({
      label: 'Calculando la reposición',
      tool: betaZodTool({
        name: 'reposicion',
        description:
          'Hallazgos del vigilante de stock (agotados, bajo mínimo, cobertura que no llega a la próxima entrega, stock inmovilizado, niveles que no cuadran) con la cantidad de reposición propuesta cuando hay datos.',
        inputSchema: z.object({
          limite: z.number().int().min(1).max(60).optional(),
        }),
        run: async ({ limite = 30 }) => {
          const watch = await getStockWatch(
            supabase,
            (await location()).id,
            now,
          );
          return json({
            parametros: watch.settings,
            total: watch.findings.length,
            hallazgos: watch.findings.slice(0, limite).map((f) => {
              const v = watch.directory.get(f.variantId);
              return {
                perfume: v?.productName ?? '—',
                marca: v?.brandName ?? '—',
                formato: v?.variantLabel ?? '—',
                tipo: FINDING_LABELS[f.kind],
                gravedad: SEVERITY_LABELS[f.severity],
                explicacion: describeFinding(f),
                reponer:
                  f.proposal?.kind === 'reorder' ? f.proposal.quantity : null,
              };
            }),
          });
        },
      }),
    });

    tools.push({
      label: 'Preparando el informe del día',
      tool: betaZodTool({
        name: 'informe_diario',
        description:
          'Informe de un día de la tienda: actividad de ese día (entradas, ventas, devoluciones, mermas, ajustes y más vendidos) y, con los datos de ahora, agotados, hallazgos, pedidos de compra abiertos y vencidos y tareas pendientes del catálogo. Sin fecha, el de hoy hasta ahora.',
        inputSchema: z.object({ fecha: day.optional() }),
        run: async ({ fecha }) => {
          const collected = await collectDailyReport(
            supabase,
            fecha ?? today,
            now,
          );
          return json(collected?.report ?? { error: 'Sin ubicación activa' });
        },
      }),
    });
  }

  if (can('reports.view')) {
    tools.push({
      label: 'Sumando las ventas',
      tool: betaZodTool({
        name: 'ventas_por_periodo',
        description:
          'Unidades vendidas, recibidas, devueltas y perdidas por formato entre dos días (incluidos), ordenadas por ventas. Solo unidades: el mostrador no guarda importes.',
        inputSchema: z.object({
          desde: day,
          hasta: day,
          limite: z.number().int().min(1).max(50).optional(),
        }),
        run: async ({ desde, hasta, limite = 20 }) => {
          const period = dayRangePeriod(desde, hasta);
          if (!period) return json({ error: 'Periodo no válido' });
          const rows = await getInventoryPeriod(
            supabase,
            (await location()).id,
            period,
          );
          const sold = rows
            .filter((r) => r.soldUnits > 0 || r.receivedUnits > 0)
            .sort((a, b) => b.soldUnits - a.soldUnits);
          return json({
            dias: period.days,
            total_vendidas: rows.reduce((sum, r) => sum + r.soldUnits, 0),
            total_recibidas: rows.reduce((sum, r) => sum + r.receivedUnits, 0),
            filas: sold.slice(0, limite).map((r) => ({
              perfume: r.productName,
              marca: r.brandName,
              formato: r.variantLabel,
              vendidas: r.soldUnits,
              recibidas: r.receivedUnits,
              devueltas: r.returnedUnits,
              mermas: r.lostUnits,
              quedan: r.closingUnits,
            })),
          });
        },
      }),
    });
  }

  if (can('catalog.edit')) {
    tools.push({
      label: 'Revisando el catálogo',
      tool: betaZodTool({
        name: 'pendientes_catalogo',
        description:
          'Perfumes con trabajo pendiente en el catálogo: sin PVP completo, sin imagen, con textos pendientes en algún idioma, o borradores.',
        inputSchema: z.object({
          tipo: z.enum(['precio', 'imagen', 'traducciones', 'borradores']),
          limite: z.number().int().min(1).max(50).optional(),
        }),
        run: async ({ tipo, limite = 20 }) => {
          const products = (await listAdminProducts(supabase, false)).filter(
            (p) => p.status !== 'archived',
          );
          const matches = products.filter((p) =>
            tipo === 'precio'
              ? p.variants.filter((v) => v.active).length === 0 ||
                p.variants.some((v) => v.active && v.priceCents === null)
              : tipo === 'imagen'
                ? !p.heroUrl
                : tipo === 'traducciones'
                  ? p.missingTranslations.length > 0
                  : p.status === 'draft',
          );
          return json({
            total: matches.length,
            filas: matches.slice(0, limite).map((p) => ({
              perfume: p.name,
              marca: p.brandName,
              estado: p.status,
              formatos: p.variants.length,
              idiomas_pendientes: p.missingTranslations,
            })),
            enlace:
              tipo === 'borradores'
                ? '/admin/catalogo?estado=draft'
                : `/admin/catalogo?pendiente=${tipo}`,
          });
        },
      }),
    });
  }

  return {
    // Las entradas son pequeñas y se validan con el esquema antes de run().
    tools: tools.map(({ tool }) => ({ ...tool, eager_input_streaming: true })),
    labels: Object.fromEntries(
      tools.map(({ tool, label }) => [tool.name, label]),
    ),
  };
}
