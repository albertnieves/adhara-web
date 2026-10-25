'use client';

import type { FormEvent } from 'react';
import {
  startTransition,
  useActionState,
  useState,
  useTransition,
} from 'react';
import { formatEuros } from '@/lib/money';
import type { ActionState } from '@/modules/admin';
import { FormMessage, IDLE } from '@/modules/admin';
import {
  Badge,
  Button,
  Field,
  Fieldset,
  Input,
  Radio,
  Select,
  SubmitButton,
  Table,
  toast,
  useConfirm,
} from '@/components/ui';
import { FIRST_MILE_LABELS, transitText } from '../domain/labels';
import type { LiveQuote, DropoffPoints } from '../server/actions';
import {
  cancelShipmentAction,
  createSendcloudLabel,
  findDropoffPoints,
  quoteOrderShipping,
  recordDropoff,
  recordManualShipment,
} from '../server/actions';
import { PickupForm } from './PickupForm';
import { useShippingAction } from './useShippingAction';

const euros = (cents: number) => formatEuros(cents, 'es');

/**
 * «Crear la etiqueta» de un pedido pagado con envío: el peso del paquete (el
 * calculado al comprar, editable), las tarifas reales de la plataforma para
 * esta dirección con lo que cobró la tienda al cliente, y la etiqueta con el
 * servicio elegido. Sin plataforma (o con un contrato propio), se apunta la
 * etiqueta hecha en la web del transportista.
 */
export function CreateLabel({
  orderId,
  defaultWeightG,
  paidShippingCents,
  chosenLabel,
  chosenCode,
  sendcloudReady,
  canSeeCosts,
  services,
}: {
  orderId: string;
  defaultWeightG: number | null;
  paidShippingCents: number;
  chosenLabel: string | null;
  chosenCode: string | null;
  sendcloudReady: boolean;
  canSeeCosts: boolean;
  services: { id: string; label: string; provider: 'sendcloud' | 'manual' }[];
}) {
  const [weight, setWeight] = useState(
    defaultWeightG ? String(defaultWeightG) : '',
  );
  const [quote, setQuote] = useState<LiveQuote | null>(null);
  const [quoting, startQuoting] = useTransition();
  const label = useShippingAction(createSendcloudLabel);
  const manual = useShippingAction(recordManualShipment);
  const grams = Number(weight);
  const weightOk = Number.isInteger(grams) && grams >= 1 && grams <= 100000;

  function loadQuotes() {
    if (!weightOk) return;
    startQuoting(async () =>
      setQuote(await quoteOrderShipping(orderId, grams)),
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end gap-4">
        <Field
          label="Peso del paquete (g)"
          hint="El calculado al comprar (perfumes y embalaje). Cámbialo si pesa distinto."
          className="w-56"
        >
          <Input
            inputMode="numeric"
            value={weight}
            onChange={(event) => {
              setWeight(event.target.value);
              setQuote(null);
            }}
          />
        </Field>
        {sendcloudReady && (
          <Button
            type="button"
            variant="outline"
            onClick={loadQuotes}
            loading={quoting}
            loadingLabel="Cotizando…"
            disabled={!weightOk}
          >
            Ver tarifas reales
          </Button>
        )}
      </div>

      {quote?.status === 'error' && (
        <p role="alert" className="text-danger text-sm">
          {quote.message}
        </p>
      )}
      {quote?.status === 'ok' &&
        (quote.options.length === 0 ? (
          <p className="text-fg-muted text-sm">
            Ningún servicio de la cuenta lleva este paquete a esta dirección.
          </p>
        ) : (
          <div className="space-y-3">
            <Table
              caption="Tarifas reales de la plataforma para este paquete"
              className="md:min-w-[48rem]"
            >
              <thead>
                <tr>
                  <th>Servicio</th>
                  <th>Entrega al transportista</th>
                  <th>Plazo</th>
                  {canSeeCosts && <th className="text-right">Coste sin IVA</th>}
                  {canSeeCosts && <th className="text-right">Con IVA</th>}
                  {canSeeCosts && (
                    <th className="text-right">Cobrado − coste</th>
                  )}
                  <th>
                    <span className="sr-only">Etiqueta</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {quote.options.map((option) => {
                  const chosen = option.code === chosenCode;
                  const margin =
                    option.costWithVatCents === null
                      ? null
                      : paidShippingCents - option.costWithVatCents;
                  return (
                    <tr key={option.code}>
                      <td data-primary className="text-sm">
                        {option.carrierName} · {option.name}{' '}
                        {chosen && (
                          <Badge tone="accent">Elegido por el cliente</Badge>
                        )}
                        {option.dangerousGoods && (
                          <span className="text-fg-muted block text-xs">
                            Admite mercancía peligrosa (ADR)
                          </span>
                        )}
                      </td>
                      <td data-label="Entrega" className="text-sm">
                        {(option.firstMile &&
                          FIRST_MILE_LABELS[option.firstMile]) ??
                          '—'}
                      </td>
                      <td data-label="Plazo" className="text-sm">
                        {option.leadTimeHours !== null
                          ? (transitText(
                              Math.max(1, Math.ceil(option.leadTimeHours / 24)),
                            ) ?? '—')
                          : '—'}
                      </td>
                      {canSeeCosts && (
                        <td
                          data-label="Coste sin IVA"
                          className="text-right tabular-nums"
                        >
                          {option.costCents === null
                            ? '—'
                            : euros(option.costCents)}
                        </td>
                      )}
                      {canSeeCosts && (
                        <td
                          data-label="Con IVA"
                          className="text-right tabular-nums"
                        >
                          {option.costWithVatCents === null
                            ? '—'
                            : euros(option.costWithVatCents)}
                        </td>
                      )}
                      {canSeeCosts && (
                        <td
                          data-label="Cobrado − coste"
                          className={`text-right tabular-nums ${margin !== null && margin < 0 ? 'text-danger' : ''}`}
                        >
                          {margin === null
                            ? '—'
                            : `${margin < 0 ? '−' : ''}${euros(Math.abs(margin))}`}
                        </td>
                      )}
                      <td data-label="Etiqueta">
                        <form onSubmit={label.onSubmit}>
                          <input type="hidden" name="orderId" value={orderId} />
                          <input
                            type="hidden"
                            name="code"
                            value={option.code}
                          />
                          <input
                            type="hidden"
                            name="weightG"
                            value={String(grams)}
                          />
                          <SubmitButton
                            pending={label.pending}
                            pendingLabel="Comprando la etiqueta…"
                            variant={chosen ? 'primary' : 'outline'}
                            size="sm"
                          >
                            Crear etiqueta
                          </SubmitButton>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            <p className="text-fg-muted text-xs">
              El cliente pagó{' '}
              {paidShippingCents === 0
                ? 'nada (envío gratis)'
                : euros(paidShippingCents)}
              {chosenLabel ? ` por «${chosenLabel}»` : ''}. Crear la etiqueta la
              compra en la plataforma al momento; si te equivocas, cancélala
              antes de que la recojan.
            </p>
          </div>
        ))}
      <FormMessage state={label.state} />

      {services.length > 0 && (
        <form
          onSubmit={manual.onSubmit}
          className="border-border space-y-4 border-t pt-6"
        >
          <input type="hidden" name="orderId" value={orderId} />
          <input
            type="hidden"
            name="weightG"
            value={weightOk ? String(grams) : ''}
          />
          <Fieldset legend="Etiqueta hecha en la web del transportista">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,16rem)_minmax(0,14rem)_10rem_auto] sm:items-end">
              <Field label="Servicio">
                <Select name="serviceId" defaultValue={services[0]?.id}>
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Nº de seguimiento">
                <Input name="tracking" maxLength={120} autoComplete="off" />
              </Field>
              {canSeeCosts ? (
                <Field label="Coste sin IVA (€)" hint="Opcional.">
                  <Input name="cost" inputMode="decimal" />
                </Field>
              ) : (
                <span />
              )}
              <SubmitButton
                pending={manual.pending}
                variant="outline"
                disabled={!weightOk}
              >
                Apuntar envío
              </SubmitButton>
            </div>
          </Fieldset>
          <FormMessage state={manual.state} />
        </form>
      )}
    </div>
  );
}

/**
 * Lo que queda con la etiqueta hecha: descargarla, entregarla al
 * transportista (recogida en la tienda o punto de entrega) o cancelarla.
 */
export function ShipmentHandover({
  orderId,
  shipment,
  pickupApi,
  pickupPhone,
  workingDays,
  pickupStart,
  pickupEnd,
  sendcloudReady,
}: {
  orderId: string;
  shipment: {
    id: string;
    provider: 'sendcloud' | 'manual';
    carrierCode: string;
    carrierName: string;
    status: string;
    handover: 'pickup' | 'dropoff' | null;
    weightG: number;
  };
  pickupApi: boolean;
  pickupPhone: string | null;
  workingDays: string[];
  pickupStart: string;
  pickupEnd: string;
  sendcloudReady: boolean;
}) {
  const [points, setPoints] = useState<DropoffPoints | null>(null);
  const [searching, startSearching] = useTransition();
  const [pointId, setPointId] = useState<string>('');
  const dropoff = useShippingAction(recordDropoff);
  const [cancelState, cancelDispatch, cancelling] = useActionState(
    async (state: ActionState, form: FormData): Promise<ActionState> => {
      const result = await cancelShipmentAction(state, form);
      if (result.status !== 'ok') return result;
      toast(result.message ?? 'Etiqueta cancelada.');
      return IDLE;
    },
    IDLE,
  );
  const [confirm, confirmDialog] = useConfirm();
  const pending = shipment.status === 'label_created';
  const platform = shipment.provider === 'sendcloud';
  const chosen =
    points?.status === 'ok'
      ? (points.points.find((p) => p.id === pointId) ?? null)
      : null;

  async function cancel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const ok = await confirm({
      title: 'Cancelar la etiqueta',
      description: platform
        ? 'Se cancela también en la plataforma (si el transportista lo admite) y no se cobra. Después puedes hacer otra.'
        : 'Recuerda anularla también en la web del transportista.',
      confirmLabel: 'Cancelar la etiqueta',
      cancelLabel: 'Volver',
      tone: 'danger',
    });
    if (ok) startTransition(() => cancelDispatch(form));
  }

  return (
    <div className="space-y-8">
      {platform && (
        <div className="flex flex-wrap items-center gap-3">
          <a
            href={`/admin/pedidos/${orderId}/etiqueta?envio=${shipment.id}&papel=A6`}
            target="_blank"
            rel="noopener"
            className="border-fg bg-fg text-fg-inverse tracking-caps inline-flex min-h-11 items-center px-5 text-xs font-semibold uppercase"
          >
            Descargar etiqueta (A6)
          </a>
          <a
            href={`/admin/pedidos/${orderId}/etiqueta?envio=${shipment.id}&papel=A4`}
            target="_blank"
            rel="noopener"
            className="border-border hover:border-fg tracking-caps inline-flex min-h-11 items-center border px-5 text-xs font-semibold uppercase"
          >
            En A4
          </a>
        </div>
      )}

      {pending && shipment.handover !== 'dropoff' && (
        <div className="grid gap-8 xl:grid-cols-2">
          <section className="space-y-4">
            <h3 className="text-lg">Recogida en la tienda</h3>
            {shipment.handover === 'pickup' ? (
              <p className="text-fg-muted text-sm">
                Ya hay una recogida pedida para esta etiqueta. Cuando el
                transportista la escanee, el pedido pasa solo a «Enviado».
              </p>
            ) : (
              <PickupForm
                carrierCode={shipment.carrierCode}
                carrierName={shipment.carrierName}
                shipmentIds={[shipment.id]}
                apiAvailable={platform && sendcloudReady}
                apiLikely={pickupApi}
                phone={pickupPhone}
                workingDays={workingDays}
                start={pickupStart}
                end={pickupEnd}
              />
            )}
          </section>
          <section className="space-y-4">
            <h3 className="text-lg">Punto de entrega</h3>
            <p className="text-fg-muted text-sm">
              Si lo llevas tú a un punto de {shipment.carrierName}, márcalo al
              dejarlo: el pedido pasa a «Enviado» y el cliente recibe el
              seguimiento por correo.
            </p>
            {platform && sendcloudReady && (
              <Button
                type="button"
                variant="outline"
                loading={searching}
                loadingLabel="Buscando…"
                onClick={() =>
                  startSearching(async () =>
                    setPoints(await findDropoffPoints(shipment.id)),
                  )
                }
              >
                Buscar puntos cerca de la tienda
              </Button>
            )}
            {points?.status === 'error' && (
              <p role="alert" className="text-danger text-sm">
                {points.message}
              </p>
            )}
            {points?.status === 'ok' &&
              (points.points.length === 0 ? (
                <p className="text-fg-muted text-sm">
                  No hay puntos de este transportista a menos de 5 km.
                </p>
              ) : (
                <Fieldset legend="Puntos cercanos (comprueba que admiten entregas de paquetes)">
                  {points.points.map((point) => (
                    <Radio
                      key={point.id}
                      name="dropoffPoint"
                      value={point.id}
                      checked={pointId === point.id}
                      onChange={() => setPointId(point.id)}
                      label={`${point.name}${point.distanceM !== null ? ` · ${(point.distanceM / 1000).toLocaleString('es-ES', { maximumFractionDigits: 1 })} km` : ''}`}
                      hint={[
                        point.address,
                        point.today ? `Hoy: ${point.today}` : 'Hoy cerrado',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    />
                  ))}
                </Fieldset>
              ))}
            <form
              onSubmit={dropoff.onSubmit}
              className="flex flex-wrap items-center gap-4"
            >
              <input type="hidden" name="shipmentId" value={shipment.id} />
              <input
                type="hidden"
                name="pointName"
                value={chosen?.name ?? ''}
              />
              <input
                type="hidden"
                name="pointAddress"
                value={chosen?.address ?? ''}
              />
              <input
                type="hidden"
                name="pointId"
                value={chosen?.carrierPointId ?? chosen?.id ?? ''}
              />
              <SubmitButton pending={dropoff.pending} pendingLabel="…">
                Lo he dejado en el punto
              </SubmitButton>
              <FormMessage state={dropoff.state} />
            </form>
          </section>
        </div>
      )}

      {pending && (
        <form onSubmit={cancel} className="flex flex-wrap items-center gap-4">
          <input type="hidden" name="shipmentId" value={shipment.id} />
          <SubmitButton
            pending={cancelling}
            pendingLabel="Cancelando…"
            variant="outline"
          >
            Cancelar la etiqueta
          </SubmitButton>
          <FormMessage state={cancelState} />
          {confirmDialog}
        </form>
      )}
    </div>
  );
}
