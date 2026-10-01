import type { Metadata } from 'next';
import Link from 'next/link';
import { z } from 'zod';
import { PageHeader } from '@/modules/admin';
import { requirePermission } from '@/modules/auth/server';
import {
  AUDIT_AREAS,
  auditArea,
  auditChanges,
  dayRangePeriod,
  isAuditArea,
} from '@/modules/reports';
import { listAuditEntries, listStaffNames } from '@/modules/reports/server';

export const metadata: Metadata = { title: 'Auditoría' };

const DATE = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'short',
  timeStyle: 'medium',
  timeZone: 'Europe/Madrid',
});

type Search = {
  area?: string;
  persona?: string;
  desde?: string;
  hasta?: string;
  pagina?: string;
};

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** Identificadores largos (formato@ubicación…) abreviados a 8 caracteres. */
function shortId(id: string): string {
  return id.replace(UUID, (uuid) => `${uuid.slice(0, 8)}…`);
}

function short(value: unknown): string {
  if (value === undefined || value === null) return '—';
  const text = shortId(
    typeof value === 'string' ? value : JSON.stringify(value),
  );
  return text.length > 40 ? `${text.slice(0, 37)}…` : text;
}

export default async function AuditLog({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const { supabase } = await requirePermission('staff.manage');
  const params = await searchParams;
  const area = params.area && isAuditArea(params.area) ? params.area : '';
  const actorId = z.uuid().safeParse(params.persona).success
    ? params.persona!
    : '';
  const range =
    params.desde && params.hasta
      ? dayRangePeriod(params.desde, params.hasta)
      : null;
  const page = Math.max(0, Math.min(Number(params.pagina) || 0, 1000));
  const [{ entries, hasMore }, names] = await Promise.all([
    listAuditEntries(
      supabase,
      {
        action: area ? `${area}.` : undefined,
        actorId: actorId || undefined,
        from: range?.from,
        to: range?.to,
      },
      page,
    ),
    listStaffNames(supabase),
  ]);
  const query = (overrides: Partial<Search>) => {
    const search = new URLSearchParams();
    const merged = {
      area,
      persona: actorId,
      desde: range ? params.desde : '',
      hasta: range ? params.hasta : '',
      ...overrides,
    };
    for (const [key, value] of Object.entries(merged)) {
      if (value) search.set(key, String(value));
    }
    const text = search.toString();
    return `/admin/informes/auditoria${text ? `?${text}` : ''}`;
  };

  return (
    <main>
      <PageHeader eyebrow="Informes" title="Auditoría" />
      <p className="text-smoke mb-8 max-w-3xl text-sm leading-relaxed">
        Registro de solo inserción: nadie puede cambiarlo ni borrarlo. Los
        cambios de coste se anotan sin importes. Las entradas sin persona son
        cargas de datos hechas fuera del panel.
      </p>
      <form className="border-line mb-8 flex flex-wrap items-end gap-x-6 gap-y-4 border-y py-5">
        <label className="flex flex-col gap-2">
          <span className="eyebrow">Área</span>
          <select name="area" defaultValue={area} className="input min-w-48">
            <option value="">Todas</option>
            {Object.entries(AUDIT_AREAS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2">
          <span className="eyebrow">Persona</span>
          <select
            name="persona"
            defaultValue={actorId}
            className="input min-w-48"
          >
            <option value="">Todas</option>
            {[...names.entries()].map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2">
          <span className="eyebrow">Desde</span>
          <input
            type="date"
            name="desde"
            defaultValue={range ? params.desde : ''}
            className="input"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="eyebrow">Hasta</span>
          <input
            type="date"
            name="hasta"
            defaultValue={range ? params.hasta : ''}
            className="input"
          />
        </label>
        <button
          type="submit"
          className="border-line hover:border-ink inline-flex min-h-11 items-center border px-5 text-xs font-semibold tracking-[0.18em] uppercase"
        >
          Filtrar
        </button>
      </form>

      {entries.length === 0 ? (
        <p className="text-smoke py-16 text-center">
          Ninguna entrada con estos filtros.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table min-w-[40rem]">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Persona</th>
                <th>Acción</th>
                <th>Cambios</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const changes = auditChanges(e.before, e.after);
                const areaKey = auditArea(e.action);
                return (
                  <tr key={e.id} className="align-top">
                    <td className="text-smoke text-sm whitespace-nowrap tabular-nums">
                      {DATE.format(new Date(e.at))}
                    </td>
                    <td className="text-sm">
                      {e.actorId
                        ? (names.get(e.actorId) ?? 'Persona sin acceso')
                        : 'Carga de datos'}
                    </td>
                    <td className="text-sm">
                      <code>{e.action}</code>
                      <p className="text-smoke text-xs">
                        {areaKey ? AUDIT_AREAS[areaKey] : e.entity}
                        {e.entityId && ` · ${shortId(e.entityId)}`}
                      </p>
                    </td>
                    <td className="text-xs">
                      {changes.length === 0 ? (
                        <span className="text-smoke">—</span>
                      ) : (
                        <ul className="space-y-0.5">
                          {changes.slice(0, 6).map((c) => (
                            <li key={c.key}>
                              <span className="text-smoke">{c.key}:</span>{' '}
                              {short(c.before)} → {short(c.after)}
                            </li>
                          ))}
                          {changes.length > 6 && (
                            <li className="text-smoke">
                              y {changes.length - 6} más
                            </li>
                          )}
                        </ul>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <nav className="mt-6 flex justify-between" aria-label="Páginas">
        {page > 0 ? (
          <Link
            href={query({ pagina: String(page - 1) })}
            className="link-underline text-xs tracking-[0.16em] uppercase"
          >
            ← Más recientes
          </Link>
        ) : (
          <span />
        )}
        {hasMore && (
          <Link
            href={query({ pagina: String(page + 1) })}
            className="link-underline text-xs tracking-[0.16em] uppercase"
          >
            Más antiguas →
          </Link>
        )}
      </nav>
    </main>
  );
}
