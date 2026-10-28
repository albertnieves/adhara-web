import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { SearchField } from '@/modules/admin/ui/SearchField';
import { isAllowed } from '@/modules/auth';
import { requirePermission } from '@/modules/auth/server';
import { ORDER_STATUS_LABELS } from '@/modules/orders';
import type { OrderStatus } from '@/modules/orders';
import {
  BOARD_STAGE_INFO,
  BOARD_VIEW_LABELS,
  LATE_AFTER_DAYS,
  PICKUP_API_CARRIERS,
  boardViewHref,
  daysAgoText,
  groupByCarrier,
  madridDaysSince,
  matchesBoardQuery,
  nextWorkingDays,
  paidWaitStep,
  parseBoardFilter,
  shipmentAttention,
  shipmentBoardStatus,
  shipmentNextStep,
  shipmentStage,
  weightText,
} from '@/modules/shipping';
import type {
  BoardSearch,
  BoardStage,
  BoardView,
  NextStep,
} from '@/modules/shipping';
import type {
  BoardOrder,
  BoardShipment,
  ServiceSummary,
  ShippingSettings,
} from '@/modules/shipping/server';
import {
  getShippingBoard,
  getShippingSettings,
  listServiceSummaries,
  sendcloudConfig,
} from '@/modules/shipping/server';
import { PickupForm } from '@/modules/shipping/ui';
import {
  Badge,
  buttonClass,
  cardClass,
  EmptyState,
  Eyebrow,
  Icon,
  Select,
  Table,
} from '@/components/ui';

export const metadata: Metadata = { title: 'Envíos' };
export const dynamic = 'force-dynamic';

const DATE_TIME = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Madrid',
});

const STEP_TONE: Record<NextStep['tone'], string> = {
  muted: 'text-fg-muted',
  default: '',
  warning: 'text-warning font-semibold',
  danger: 'text-danger font-semibold',
};

/** Pedido pagado sin etiqueta, con el transportista que eligió el cliente. */
type PendingOrder = BoardOrder & {
  carrierCode: string | null;
  carrierName: string | null;
};

function orderHref(orderId: string) {
  return `/admin/pedidos/${orderId}#envio`;
}

function Step({ step }: { step: NextStep }) {
  return <span className={STEP_TONE[step.tone]}>{step.text}</span>;
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

/** Bloque de una etapa: título con su recuento, qué hacer y su contenido. */
function Block({
  id,
  title,
  count,
  hint,
  tone,
  children,
}: {
  id: string;
  title: string;
  count: number;
  hint?: string;
  tone?: 'danger' | 'warning';
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={`bloque-${id}`}
      className="border-border border-t pt-8 pb-10 first:border-t-0 first:pt-0"
    >
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h2 id={`bloque-${id}`} className="text-2xl font-light">
          {title}
        </h2>
        <Badge tone={tone ?? 'neutral'}>{count}</Badge>
      </div>
      {hint && (
        <p className="text-fg-muted -mt-2 mb-5 max-w-3xl text-sm">{hint}</p>
      )}
      {children}
    </section>
  );
}

function OrderCell({
  orderId,
  number,
  status,
}: {
  orderId: string;
  number: number;
  status: string;
}) {
  return (
    <td data-primary className="text-sm">
      <Link
        href={orderHref(orderId)}
        className="link-underline font-semibold tabular-nums"
      >
        Nº {number}
      </Link>
      <span className="text-fg-muted block text-xs">
        {ORDER_STATUS_LABELS[status as OrderStatus] ?? status}
      </span>
    </td>
  );
}

function TrackingCell({ s }: { s: BoardShipment }) {
  return (
    <td data-label="Seguimiento" className="text-sm break-all">
      {s.trackingUrl ? (
        <a
          href={s.trackingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="link-underline"
        >
          {s.trackingNumber ?? 'Ver'}
          <span className="sr-only"> (se abre en otra pestaña)</span>
        </a>
      ) : (
        (s.trackingNumber ?? '—')
      )}
    </td>
  );
}

/** Tabla común de etiquetas: pedido, transportista, estado y qué hacer. */
function ShipmentTable({
  caption,
  rows,
  now,
  showCarrier = true,
}: {
  caption: string;
  rows: BoardShipment[];
  now: Date;
  showCarrier?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <Table caption={caption} className="md:min-w-[52rem]">
        <thead>
          <tr>
            <th>Pedido</th>
            {showCarrier && <th>Transportista</th>}
            <th>Seguimiento</th>
            <th>Estado</th>
            <th>Qué hacer</th>
            <th>Última novedad</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id}>
              <OrderCell
                orderId={s.orderId}
                number={s.orderNumber}
                status={s.orderStatus}
              />
              {showCarrier && (
                <td data-label="Transportista" className="text-sm">
                  {s.carrierName} · {s.serviceName}
                  <span className="text-fg-muted block text-xs">
                    {weightText(s.weightG)}
                  </span>
                </td>
              )}
              <TrackingCell s={s} />
              <td data-label="Estado">
                <Badge tone={shipmentBoardStatus(s).tone}>
                  {shipmentBoardStatus(s).label}
                </Badge>
              </td>
              <td data-label="Qué hacer" className="max-w-72 text-sm">
                <Step step={shipmentNextStep(s, now)} />
              </td>
              <td data-label="Última novedad" className="text-fg-muted text-xs">
                {s.statusAt ? DATE_TIME.format(new Date(s.statusAt)) : '—'}
                {s.statusMessage && (
                  <span className="block">{s.statusMessage}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

function WithoutLabelTable({
  rows,
  now,
  canFulfill,
}: {
  rows: PendingOrder[];
  now: Date;
  canFulfill: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <Table
        caption="Pedidos pagados con envío sin etiqueta"
        className="md:min-w-[44rem]"
      >
        <thead>
          <tr>
            <th>Pedido</th>
            <th>Elegido por el cliente</th>
            <th>Peso</th>
            <th>Pagado</th>
            <th>
              <span className="sr-only">Acción</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.id}>
              <OrderCell orderId={o.id} number={o.number} status={o.status} />
              <td data-label="Elegido" className="text-sm">
                {o.serviceLabel ?? '—'}
              </td>
              <td data-label="Peso" className="text-sm">
                {o.weightG ? weightText(o.weightG) : '—'}
              </td>
              <td data-label="Pagado" className="text-sm">
                <Step step={paidWaitStep(o.paidAt, now)} />
                {o.paidAt && (
                  <span className="text-fg-muted block text-xs">
                    {DATE_TIME.format(new Date(o.paidAt))}
                  </span>
                )}
              </td>
              <td data-label="Acción" className="text-right">
                <Link
                  href={orderHref(o.id)}
                  className={buttonClass(canFulfill ? 'primary' : 'outline')}
                >
                  {canFulfill ? 'Crear etiqueta' : 'Ver pedido'}
                  <span className="sr-only"> del pedido nº {o.number}</span>
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

/** Lo que hay que entregar, por transportista, con su recogida al lado. */
function HandOverGroups({
  rows,
  now,
  canFulfill,
  canSettings,
  settings,
  services,
  sendcloudReady,
}: {
  rows: BoardShipment[];
  now: Date;
  canFulfill: boolean;
  canSettings: boolean;
  settings: ShippingSettings | null;
  services: ServiceSummary[];
  sendcloudReady: boolean;
}) {
  const workingDays = nextWorkingDays(now, 6);
  return (
    <div className="space-y-6">
      {groupByCarrier(rows).map((group) => {
        const weight = group.rows.reduce((sum, s) => sum + s.weightG, 0);
        const phone =
          services.find((s) => s.carrierCode === group.code && s.pickupPhone)
            ?.pickupPhone ?? null;
        const packages = plural(group.rows.length, 'paquete', 'paquetes');
        return (
          <section
            key={group.code}
            aria-labelledby={`entregar-${group.code}`}
            className={cardClass({ padding: 'none' })}
          >
            <div className="border-border flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b px-5 py-4 sm:px-6">
              <h3 id={`entregar-${group.code}`} className="text-xl">
                {group.name}
              </h3>
              <p className="text-fg-muted text-sm">
                {packages} · {weightText(weight)}
              </p>
            </div>
            <div className="px-5 py-4 sm:px-6">
              <ShipmentTable
                caption={`Etiquetas de ${group.name} por entregar`}
                rows={group.rows}
                now={now}
                showCarrier={false}
              />
            </div>
            {canFulfill && (
              <div className="border-border bg-surface border-t px-5 py-4 sm:px-6">
                {settings ? (
                  <details className="group">
                    <summary
                      className={buttonClass(
                        'outline',
                        'md',
                        'cursor-pointer list-none [&::-webkit-details-marker]:hidden',
                      )}
                    >
                      Pedir la recogida de {packages}
                      <Icon
                        name="chevron"
                        size="sm"
                        className="transition-transform duration-(--duration-fast) group-open:rotate-90"
                      />
                    </summary>
                    <div className="pt-5">
                      <PickupForm
                        carrierCode={group.code}
                        carrierName={group.name}
                        shipmentIds={group.rows.map((s) => s.id)}
                        apiAvailable={
                          sendcloudReady &&
                          group.rows.every((s) => s.provider === 'sendcloud')
                        }
                        apiLikely={PICKUP_API_CARRIERS.has(group.code)}
                        phone={phone}
                        workingDays={workingDays}
                        start={settings.pickupStart}
                        end={settings.pickupEnd}
                      />
                    </div>
                  </details>
                ) : (
                  <p className="text-warning text-sm">
                    Para pedir recogidas faltan el remitente y la franja en{' '}
                    {canSettings ? (
                      <Link
                        href="/admin/envios/ajustes"
                        className="link-underline"
                      >
                        Remitente y zonas
                      </Link>
                    ) : (
                      'Remitente y zonas (administrador del sistema)'
                    )}
                    .
                  </p>
                )}
                <p className="text-fg-muted mt-3 text-xs">
                  ¿Lo llevas tú a un punto de entrega? Márcalo en la ficha de
                  cada pedido.
                </p>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

/** Contador de una etapa: cifra grande, nota y enlace a su vista. */
function StageTile({
  view,
  label,
  count,
  note,
  href,
  active,
  tone,
}: {
  view: BoardView;
  label: string;
  count: number;
  note: string;
  href: string;
  active: boolean;
  tone?: 'danger' | 'warning';
}) {
  // «Por hacer» encabeza: toda la fila en el móvil y la tableta, y dos filas
  // de alto a la izquierda de las seis etapas en escritorio.
  const lead = view === 'por-hacer';
  return (
    <li
      className={
        lead ? 'col-span-2 sm:col-span-3 xl:col-span-1 xl:row-span-2' : ''
      }
    >
      <Link
        href={href}
        aria-current={active ? 'page' : undefined}
        data-view={view}
        className={cardClass({
          padding: 'sm',
          interactive: true,
          className: `flex h-full flex-col ${
            active
              ? 'border-fg ring-fg ring-1'
              : tone === 'danger' && count > 0
                ? 'border-danger'
                : ''
          }`,
        })}
      >
        <Eyebrow as="span">{label}</Eyebrow>
        <span
          className={`font-display mt-1 font-light lining-nums tabular-nums ${
            lead ? 'text-4xl xl:mt-auto xl:text-6xl' : 'text-3xl sm:text-4xl'
          } ${tone === 'danger' && count > 0 ? 'text-danger' : ''}`}
        >
          {count}
        </span>
        <span
          className={`mt-1 text-xs ${
            tone === 'warning' ? 'text-warning font-semibold' : 'text-fg-muted'
          }`}
        >
          {note}
        </span>
      </Link>
    </li>
  );
}

/**
 * Envíos → Seguimiento (DECISIONS §174–175, §177): contadores por etapa que
 * filtran, «Por hacer» por defecto (incidencias, recogidas o puntos sin
 * escaneo, pedidos sin etiqueta y etiquetas por entregar), búsqueda por
 * pedido o seguimiento y filtro por transportista. Lo que hay que entregar va
 * agrupado por transportista, con su recogida. Etiqueta, punto de entrega y
 * cancelación siguen en la ficha de cada pedido.
 */
export default async function ShippingBoardPage({
  searchParams,
}: {
  searchParams: Promise<BoardSearch>;
}) {
  const staff = await requirePermission('orders.view');
  const canFulfill = isAllowed(
    { role: staff.role, aal: 'aal2' },
    'orders.fulfill',
  );
  const filter = parseBoardFilter(await searchParams);
  const [board, settings, services] = await Promise.all([
    getShippingBoard(staff.supabase),
    getShippingSettings(staff.supabase),
    listServiceSummaries(staff.supabase),
  ]);
  const now = new Date();
  const sendcloudReady = sendcloudConfig() !== null;

  const serviceById = new Map(services.map((s) => [s.id, s]));
  const pendingAll: PendingOrder[] = board.withoutLabel.map((o) => {
    const service = o.serviceId ? serviceById.get(o.serviceId) : undefined;
    return {
      ...o,
      carrierCode: service?.carrierCode ?? null,
      carrierName: service?.carrierName ?? null,
    };
  });

  // Transportistas del filtro: los de las etiquetas y los elegidos al pagar.
  const carrierOptions = [
    ...new Map(
      [
        ...board.shipments.map((s) => [s.carrierCode, s.carrierName] as const),
        ...pendingAll
          .filter((o) => o.carrierCode && o.carrierName)
          .map((o) => [o.carrierCode!, o.carrierName!] as const),
      ].sort((a, b) => a[1].localeCompare(b[1], 'es')),
    ).entries(),
  ];

  const pending = pendingAll.filter(
    (o) =>
      matchesBoardQuery({ orderNumber: o.number }, filter.query) &&
      (!filter.carrier || o.carrierCode === filter.carrier),
  );
  const shipments = board.shipments.filter(
    (s) =>
      matchesBoardQuery(
        { orderNumber: s.orderNumber, trackingNumber: s.trackingNumber },
        filter.query,
      ) &&
      (!filter.carrier || s.carrierCode === filter.carrier),
  );
  const inStage = (stage: BoardStage) =>
    shipments.filter((s) => shipmentStage(s) === stage);
  const toHandOver = inStage('por-entregar');
  const waiting = inStage('esperando');
  const moving = inStage('de-camino');
  const problems = inStage('incidencias');
  const delivered = inStage('entregados');
  const late = waiting.filter((s) => shipmentAttention(s, now) !== null);

  const counts: Record<BoardView, number> = {
    'por-hacer':
      problems.length + late.length + pending.length + toHandOver.length,
    'sin-etiqueta': pending.length,
    'por-entregar': toHandOver.length,
    esperando: waiting.length,
    'de-camino': moving.length,
    incidencias: problems.length,
    entregados: delivered.length,
    todos: pending.length + shipments.length,
  };
  const oldestPaid = pending
    .map((o) => (o.paidAt ? madridDaysSince(o.paidAt, now) : 0))
    .reduce((max, days) => Math.max(max, days), 0);
  const handOverCarriers = groupByCarrier(toHandOver).length;

  const tiles: {
    view: BoardView;
    note: string;
    tone?: 'danger' | 'warning';
  }[] = [
    {
      view: 'por-hacer',
      note:
        counts['por-hacer'] === 0
          ? 'Nada pendiente'
          : [
              problems.length > 0 &&
                plural(problems.length, 'incidencia', 'incidencias'),
              late.length > 0 && `${late.length} con retraso`,
              pending.length > 0 && `${pending.length} sin etiqueta`,
              toHandOver.length > 0 && `${toHandOver.length} por entregar`,
            ]
              .filter(Boolean)
              .join(' · '),
    },
    {
      view: 'sin-etiqueta',
      note:
        pending.length === 0
          ? 'Todo etiquetado'
          : `El más antiguo, pagado ${daysAgoText(oldestPaid)}`,
      tone: oldestPaid >= LATE_AFTER_DAYS ? 'warning' : undefined,
    },
    {
      view: 'por-entregar',
      note:
        handOverCarriers === 0
          ? 'Nada que entregar'
          : plural(handOverCarriers, 'transportista', 'transportistas'),
    },
    {
      view: 'esperando',
      note: late.length > 0 ? `${late.length} con retraso` : 'Recogida o punto',
      tone: late.length > 0 ? 'warning' : undefined,
    },
    { view: 'de-camino', note: 'Con el transportista' },
    {
      view: 'incidencias',
      note: problems.length > 0 ? 'Revísalas hoy' : 'Sin incidencias',
      tone: 'danger',
    },
    { view: 'entregados', note: 'Últimos 30 días' },
  ];

  const filtered = Boolean(filter.query || filter.carrier);
  const view = filter.view;
  const blocks: ReactNode[] = [];
  const show = (stage: BoardStage) =>
    view === 'todos' ||
    view === stage ||
    (view === 'por-hacer' &&
      (stage === 'incidencias' ||
        stage === 'sin-etiqueta' ||
        stage === 'por-entregar'));
  // En las vistas de una etapa se enseña su bloque aunque esté vacío; en «Por
  // hacer» y «Todo», solo los que tienen algo.
  const single = view !== 'por-hacer' && view !== 'todos';
  const emptyText = (stage: BoardStage) =>
    filtered
      ? 'Nada con esta búsqueda en esta etapa.'
      : {
          'sin-etiqueta': 'Ningún pedido pagado espera etiqueta.',
          'por-entregar': 'No hay etiquetas esperando.',
          esperando: 'No hay recogidas ni paquetes en un punto.',
          'de-camino': 'Ningún paquete en camino.',
          incidencias: 'Sin incidencias.',
          entregados: 'Aún no hay entregas en estos 30 días.',
        }[stage];

  const stageBlock = (stage: BoardStage, count: number, body: ReactNode) => {
    if (!show(stage) || (!single && count === 0)) return;
    const info = BOARD_STAGE_INFO[stage];
    blocks.push(
      <Block
        key={stage}
        id={stage}
        title={info.title}
        count={count}
        hint={count > 0 ? info.hint : undefined}
        tone={stage === 'incidencias' && count > 0 ? 'danger' : undefined}
      >
        {count === 0 ? (
          <p className="text-fg-muted text-sm">{emptyText(stage)}</p>
        ) : (
          body
        )}
      </Block>,
    );
  };

  if (view === 'por-hacer') {
    stageBlock(
      'incidencias',
      problems.length,
      <ShipmentTable
        caption="Envíos con incidencia"
        rows={problems}
        now={now}
      />,
    );
    if (late.length > 0)
      blocks.push(
        <Block
          key="sin-escaneo"
          id="sin-escaneo"
          title="Sin escanear a tiempo"
          count={late.length}
          tone="warning"
          hint="La recogida era otro día o el paquete lleva días en el punto y el transportista aún no lo ha escaneado."
        >
          <ShipmentTable
            caption="Recogidas o puntos sin escaneo"
            rows={late}
            now={now}
          />
        </Block>,
      );
  }
  stageBlock(
    'sin-etiqueta',
    pending.length,
    <WithoutLabelTable rows={pending} now={now} canFulfill={canFulfill} />,
  );
  stageBlock(
    'por-entregar',
    toHandOver.length,
    <HandOverGroups
      rows={toHandOver}
      now={now}
      canFulfill={canFulfill}
      canSettings={isAllowed(
        { role: staff.role, aal: 'aal2' },
        'settings.manage',
      )}
      settings={settings}
      services={services}
      sendcloudReady={sendcloudReady}
    />,
  );
  stageBlock(
    'esperando',
    waiting.length,
    <ShipmentTable
      caption="Esperando al transportista"
      rows={waiting}
      now={now}
    />,
  );
  stageBlock(
    'de-camino',
    moving.length,
    <ShipmentTable caption="Paquetes en camino" rows={moving} now={now} />,
  );
  if (view !== 'por-hacer')
    stageBlock(
      'incidencias',
      problems.length,
      <ShipmentTable
        caption="Envíos con incidencia"
        rows={problems}
        now={now}
      />,
    );
  stageBlock(
    'entregados',
    delivered.length,
    <ShipmentTable
      caption="Entregados en los últimos 30 días"
      rows={delivered}
      now={now}
    />,
  );

  return (
    <div>
      {problems.length > 0 && view !== 'incidencias' && (
        <p
          role="note"
          className="border-danger mb-6 max-w-3xl border-l-2 py-1 pl-4 text-sm"
        >
          <span className="text-danger font-semibold">
            {plural(
              problems.length,
              'envío con incidencia',
              'envíos con incidencia',
            )}
            .
          </span>{' '}
          <Link
            href={boardViewHref('incidencias', filter.search)}
            className="link-underline"
          >
            Ver las incidencias
          </Link>
        </p>
      )}

      <nav aria-label="Etapas de los envíos" className="mb-8">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {tiles.map((tile) => (
            <StageTile
              key={tile.view}
              view={tile.view}
              label={BOARD_VIEW_LABELS[tile.view]}
              count={counts[tile.view]}
              note={tile.note}
              tone={tile.tone}
              href={boardViewHref(tile.view, filter.search)}
              active={view === tile.view}
            />
          ))}
        </ul>
      </nav>

      <form
        role="search"
        aria-label="Buscar envíos"
        className="border-border mb-10 flex flex-wrap items-end gap-x-6 gap-y-4 border-y py-5"
      >
        {view !== 'por-hacer' && (
          <input type="hidden" name="vista" value={view} />
        )}
        <div className="flex min-w-60 flex-1 flex-col gap-2 sm:max-w-sm">
          <Eyebrow as="span">Pedido o seguimiento</Eyebrow>
          <SearchField
            defaultValue={filter.query}
            placeholder="Nº de pedido o de seguimiento"
            label="Buscar por número de pedido o de seguimiento"
          />
        </div>
        {carrierOptions.length > 0 && (
          <label className="flex flex-col gap-2">
            <Eyebrow as="span">Transportista</Eyebrow>
            <Select
              name="transportista"
              defaultValue={filter.carrier ?? ''}
              className="min-w-52"
            >
              <option value="">Todos</option>
              {carrierOptions.map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </Select>
          </label>
        )}
        <button type="submit" className={buttonClass('outline')}>
          Filtrar
        </button>
        {filtered && (
          <Link
            href={boardViewHref(view, new URLSearchParams())}
            className="link-underline inline-flex min-h-11 items-center text-sm"
          >
            Quitar filtros
          </Link>
        )}
        <Link
          href={boardViewHref('todos', filter.search)}
          aria-current={view === 'todos' ? 'page' : undefined}
          className={`link-underline ml-auto inline-flex min-h-11 items-center text-sm ${
            view === 'todos' ? 'text-fg font-semibold' : 'text-fg-muted'
          }`}
        >
          Ver todas las etapas
        </Link>
      </form>

      {blocks.length > 0 ? (
        <div>{blocks}</div>
      ) : !filtered ? (
        <EmptyState
          title={
            view === 'por-hacer' && counts.todos > 0
              ? 'Nada por hacer'
              : 'Aún no hay envíos'
          }
          description={
            counts.todos === 0
              ? 'Cuando se pague un pedido con envío, aparecerá aquí para crear su etiqueta.'
              : 'Todo lo pagado tiene etiqueta y está en manos del transportista.'
          }
          action={
            counts['de-camino'] > 0 ? (
              <Link
                href={boardViewHref('de-camino', filter.search)}
                className={buttonClass('outline')}
              >
                Ver lo que va de camino
              </Link>
            ) : undefined
          }
        />
      ) : (
        <EmptyState
          title="Sin resultados"
          description={
            counts.todos > 0
              ? `Hay ${plural(counts.todos, 'resultado', 'resultados')} en otras etapas.`
              : 'Ningún envío coincide con la búsqueda.'
          }
          action={
            counts.todos > 0 ? (
              <Link
                href={boardViewHref('todos', filter.search)}
                className={buttonClass('outline')}
              >
                Ver todas las etapas
              </Link>
            ) : (
              <Link
                href={boardViewHref(view, new URLSearchParams())}
                className={buttonClass('outline')}
              >
                Quitar filtros
              </Link>
            )
          }
        />
      )}
    </div>
  );
}
