import Link from 'next/link';
import { formatEuros } from '@/lib/money';
import { PageHeader } from '@/modules/admin';
import { isAllowed } from '@/modules/auth';
import { requireStaff } from '@/modules/auth/server';
import {
  getVariantCosts,
  listAdminProducts,
} from '@/modules/catalog/server/admin';
import { DAILY_TASK_PERMISSIONS } from '@/modules/assistant';
import { getLatestReport } from '@/modules/assistant/server';
import { reportDayLabel } from '@/modules/assistant/ui/DailyReportView';
import { MOVEMENT_LABELS } from '@/modules/inventory';
import type { MovementType } from '@/modules/inventory';
import {
  getDefaultLocation,
  listMovements,
  listStock,
} from '@/modules/inventory/server';
import { countOpenConversations } from '@/modules/messaging/server';
import { countOpenWebOrders } from '@/modules/orders/server';
import { buttonClass, cardClass, Eyebrow } from '@/components/ui';

/**
 * Tamaño de la cifra. Las cortas (recuentos) usan el grande de siempre; las
 * largas (importes como «118.518,48 €») bajan por la escala según el ancho de
 * su tarjeta (consultas de contenedor), para que nunca se salgan de ella
 * con dos o cuatro columnas ni en móviles estrechos.
 */
function statValueSize(value: string | number) {
  const length = String(value).length;
  if (length <= 7) return 'text-4xl sm:text-5xl';
  if (length <= 12)
    return 'text-xl @min-[8.25rem]:text-2xl @min-[10.5rem]:text-3xl @min-[12.5rem]:text-4xl @min-[16.5rem]:text-5xl';
  return 'text-lg @min-[8rem]:text-xl @min-[9.5rem]:text-2xl @min-[12rem]:text-3xl @min-[14.5rem]:text-4xl @min-[19rem]:text-5xl';
}

function Stat({
  label,
  value,
  href,
  note,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  href?: string;
  note?: string;
  tone?: 'default' | 'alert';
}) {
  const body = (
    <div
      className={cardClass({
        padding: 'sm',
        interactive: Boolean(href),
        className: '@container h-full sm:p-6',
      })}
    >
      <Eyebrow className="tracking-caps! sm:tracking-caps-lg!">{label}</Eyebrow>
      <p
        className={`font-display mt-2 font-light whitespace-nowrap lining-nums tabular-nums sm:mt-3 ${statValueSize(value)} ${tone === 'alert' ? 'text-danger' : ''}`}
      >
        {value}
      </p>
      {note && <p className="text-fg-muted mt-2 text-xs">{note}</p>}
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}

export default async function AdminHome() {
  const staff = await requireStaff();
  const can = (p: Parameters<typeof isAllowed>[1]) =>
    isAllowed({ role: staff.role, aal: 'aal2' }, p);
  const canCatalog = can('catalog.edit');
  const canStock = can('inventory.view');
  const canCost = canCatalog && can('pricing.view_cost');

  const [products, location, latestResult, webOrders, messages] =
    await Promise.all([
      canCatalog ? listAdminProducts(staff.supabase, canStock) : [],
      canStock ? getDefaultLocation(staff.supabase) : null,
      // El informe es secundario: si su tabla aún no existe en el entorno (sin
      // migrar) o falla la lectura, el inicio se muestra igual.
      can('agent.use')
        ? getLatestReport(staff.supabase).catch((error: unknown) => {
            console.error('[admin] informe diario', error);
            return 'error' as const;
          })
        : null,
      // Igual que el informe: si la tabla aún no existe (entorno sin migrar), el
      // inicio se muestra sin el indicador.
      can('orders.view')
        ? countOpenWebOrders(staff.supabase).catch((error: unknown) => {
            console.error('[admin] pedidos web', error);
            return null;
          })
        : null,
      // Igual: sin la tabla de mensajes (entorno sin migrar), sin indicador.
      can('messages.view')
        ? countOpenConversations(staff.supabase).catch((error: unknown) => {
            console.error('[admin] mensajes', error);
            return null;
          })
        : null,
    ]);
  const [stock, movements] = location
    ? await Promise.all([
        listStock(staff.supabase, location.id),
        listMovements(staff.supabase, { limit: 6 }),
      ])
    : [[], []];

  const published = products.filter((p) => p.status === 'published').length;
  const drafts = products.filter((p) => p.status === 'draft').length;
  const missingPrice = products.filter(
    (p) =>
      p.status !== 'archived' &&
      (p.variants.filter((v) => v.active).length === 0 ||
        p.variants.some((v) => v.active && v.priceCents === null)),
  );
  const missingImages = products.filter(
    (p) => p.status !== 'archived' && !p.heroUrl,
  );
  const missingTranslations = products.filter(
    (p) => p.status !== 'archived' && p.missingTranslations.length > 0,
  );
  const low = stock.filter(
    (row) =>
      row.active &&
      (row.onHand - row.reserved <= 0 ||
        (row.reorderPoint !== null &&
          row.onHand - row.reserved <= row.reorderPoint)),
  );
  const units = stock.reduce((sum, row) => sum + row.onHand, 0);

  // Costes: solo con pricing.view_cost (MFA). Formatos activos de perfumes no
  // archivados sin coste registrado, y valor del stock de la tienda a coste.
  const costedVariants = products
    .filter((p) => p.status !== 'archived')
    .flatMap((p) => p.variants.filter((v) => v.active).map((v) => v.id));
  const costs = canCost
    ? await getVariantCosts(staff.supabase, [
        ...new Set([...costedVariants, ...stock.map((row) => row.variantId)]),
      ])
    : new Map<string, { costNetCents: number }>();
  const withoutCost = costedVariants.filter((id) => !costs.has(id)).length;
  const stockAtCost = stock.reduce(
    (sum, row) =>
      sum + row.onHand * (costs.get(row.variantId)?.costNetCents ?? 0),
    0,
  );
  const unitsWithoutCost = stock
    .filter((row) => row.onHand > 0 && !costs.has(row.variantId))
    .reduce((sum, row) => sum + row.onHand, 0);
  const latest = latestResult === 'error' ? null : latestResult;
  const quickActions =
    can('inventory.sell_in_store') ||
    canCatalog ||
    can('pricing.edit_retail') ||
    can('inventory.receive') ||
    can('content.edit');
  const firstName = (staff.displayName ?? staff.email ?? '').split(/[ @]/)[0];

  return (
    <main>
      <PageHeader eyebrow="Panel" title={`Hola, ${firstName}`} />

      {quickActions && (
        <nav
          aria-label="Acciones frecuentes"
          className="mb-8 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3"
        >
          {can('inventory.sell_in_store') && (
            <Link className={buttonClass('primary')} href="/admin/mostrador">
              Mostrador
            </Link>
          )}
          {canCatalog && (
            <Link className={buttonClass('outline')} href="/admin/catalogo">
              Editar catálogo
            </Link>
          )}
          {can('pricing.edit_retail') && (
            <Link
              className={buttonClass('outline')}
              href="/admin/catalogo/precios"
            >
              Revisar precios
            </Link>
          )}
          {can('inventory.receive') && (
            <Link className={buttonClass('outline')} href="/admin/inventario">
              Recibir mercancía
            </Link>
          )}
          {can('content.edit') && (
            <Link className={buttonClass('outline')} href="/admin/contenido">
              Editar portada
            </Link>
          )}
        </nav>
      )}
      {can('agent.use') && (
        <section
          aria-labelledby="informe-diario"
          data-tone="dark"
          className="bg-surface text-fg mb-8 grid gap-6 px-6 py-6 sm:px-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start"
        >
          <div className="min-w-0">
            <p className="text-accent-fg text-2xs tracking-caps font-semibold uppercase">
              Asistente · informe diario
            </p>
            <h2
              id="informe-diario"
              className="mt-2 text-2xl font-light first-letter:uppercase"
            >
              {latest
                ? reportDayLabel(latest.report.day)
                : latestResult === 'error'
                  ? 'Informe no disponible ahora mismo'
                  : 'Aún no hay informes guardados'}
            </h2>
            {latest?.summary ? (
              <p className="text-fg-muted mt-3 line-clamp-6 text-sm leading-relaxed whitespace-pre-line">
                {latest.summary}
              </p>
            ) : latest ? (
              <ul className="text-fg-muted mt-3 space-y-1 text-sm">
                {latest.report.tasks
                  .filter((task) => can(DAILY_TASK_PERMISSIONS[task.key]))
                  .slice(0, 4)
                  .map((task) => (
                    <li key={task.key}>
                      {task.label}: {task.count}
                    </li>
                  ))}
                {!latest.report.tasks.some((task) =>
                  can(DAILY_TASK_PERMISSIONS[task.key]),
                ) && <li>Nada pendiente en ese informe.</li>}
              </ul>
            ) : (
              <p className="text-fg-muted mt-3 text-sm">
                Cada mañana se guardará el del día anterior. Mientras tanto,
                puedes verlo en directo.
              </p>
            )}
          </div>
          <Link href="/admin/asistente" className={buttonClass('outline')}>
            Abrir el asistente
          </Link>
        </section>
      )}

      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {webOrders && (
          <>
            <Stat
              label="Pedidos web por preparar"
              value={webOrders.toPrepare}
              href="/admin/pedidos"
              note={
                webOrders.pickup > 0
                  ? `${webOrders.pickup} listos para recoger`
                  : 'Pagados, pendientes de preparar o entregar'
              }
            />
            {webOrders.attention > 0 && (
              <Stat
                label="Incidencias de pago"
                value={webOrders.attention}
                href="/admin/pedidos?vista=incidencias"
                tone="alert"
                note="Revisa el cobro en el TPV"
              />
            )}
          </>
        )}
        {messages && (
          <Stat
            label="Mensajes por responder"
            value={messages.open}
            href="/admin/mensajes"
            tone={messages.overdue > 0 ? 'alert' : 'default'}
            note={
              messages.overdue > 0
                ? `${messages.overdue} fuera de plazo (más de 24 h)`
                : 'Consultas de clientes que esperan respuesta'
            }
          />
        )}
        {canCatalog && (
          <>
            <Stat
              label="Publicados"
              value={published}
              href="/admin/catalogo?estado=published"
            />
            <Stat
              label="Sin imagen"
              value={missingImages.length}
              href="/admin/catalogo?pendiente=imagen"
            />
            <Stat
              label="Traducciones pendientes"
              value={missingTranslations.length}
              href="/admin/catalogo?pendiente=traducciones"
              note="Perfumes con descripción pendiente en algún idioma"
            />
            <Stat
              label="Borradores"
              value={drafts}
              href="/admin/catalogo?estado=draft"
            />
            <Stat
              label="Sin PVP completo"
              value={missingPrice.length}
              href="/admin/catalogo?pendiente=precio"
              tone={missingPrice.length ? 'alert' : 'default'}
            />
          </>
        )}
        {canStock && (
          <Stat
            label="Stock bajo o agotado"
            value={low.length}
            href="/admin/inventario?filtro=bajo"
            tone={low.length ? 'alert' : 'default'}
          />
        )}
        {canCost && (
          <Stat
            label="Formatos sin coste"
            value={withoutCost}
            href="/admin/catalogo?pendiente=coste"
            tone={withoutCost ? 'alert' : 'default'}
          />
        )}
        {canCost && canStock && (
          <Stat
            label="Stock a coste"
            value={formatEuros(stockAtCost, 'es')}
            href="/admin/inventario"
            note={
              unitsWithoutCost > 0
                ? `${unitsWithoutCost} ${unitsWithoutCost === 1 ? 'unidad' : 'unidades'} sin coste no suman`
                : 'Coste neto, sin IVA'
            }
          />
        )}
      </section>

      <div className="mt-12 grid gap-10 xl:grid-cols-2">
        {canCatalog && missingPrice.length > 0 && (
          <section>
            <h2 className="mb-4 text-2xl font-light">Pendientes de precio</h2>
            <ul className="divide-border border-border divide-y border-y">
              {missingPrice.slice(0, 8).map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/admin/catalogo/${p.id}`}
                    className="hover:bg-surface-raised/60 flex items-center justify-between gap-4 py-3 text-sm"
                  >
                    <span>
                      <span className="text-fg-muted">{p.brandName} · </span>
                      {p.name}
                    </span>
                    <span className="text-fg-muted text-xs">
                      {p.variants.length === 0
                        ? 'Sin formatos'
                        : p.variants
                            .map((v) =>
                              v.priceCents === null
                                ? `${v.label}: —`
                                : `${v.label}: ${formatEuros(v.priceCents, 'es')}`,
                            )
                            .join(' · ')}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {canStock && (
          <section>
            <div className="mb-4 flex items-end justify-between">
              <h2 className="text-2xl font-light">Últimos movimientos</h2>
              <Link
                href="/admin/movimientos"
                className="link-underline tracking-caps text-xs uppercase"
              >
                Ver todos
              </Link>
            </div>
            {movements.length === 0 ? (
              <p className="text-fg-muted text-sm">
                Aún no hay movimientos. Registra la primera recepción desde
                Inventario. Unidades en tienda: {units}.
              </p>
            ) : (
              <ul className="divide-border border-border divide-y border-y">
                {movements.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between gap-4 py-3 text-sm"
                  >
                    <span>
                      {MOVEMENT_LABELS[m.type as MovementType] ?? m.type}
                      <span className="text-fg-muted">
                        {' '}
                        · {m.brandName} {m.productName} {m.variantLabel}
                      </span>
                    </span>
                    <span
                      className={`tabular-nums ${m.deltaOnHand < 0 ? 'text-danger' : 'text-success'}`}
                    >
                      {m.deltaOnHand > 0 ? '+' : ''}
                      {m.deltaOnHand}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
