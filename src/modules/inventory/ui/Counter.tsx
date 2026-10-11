'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { formatEuros, parseEuros } from '@/lib/money';
import { newRequestId } from '@/lib/request-id';
import type { CounterItem, CounterKind, TicketLine } from '../domain/counter';
import {
  COUNTER_KINDS,
  COUNTER_KIND_LABELS,
  MAX_LINE_QUANTITY,
  MAX_TICKET_REF,
  addToTicket,
  linePrice,
  linesAboveRetail,
  linesWithoutStock,
  setLinePrice,
  setLineQuantity,
  ticketTotal,
  ticketUnits,
} from '../domain/counter';
import type { CounterResult } from '../server/counter';
import { recordCounterTicket } from '../server/counter';
import { VariantSearch } from './VariantSearch';
import { buttonClass, Card, Input } from '@/components/ui';

type Pending = { requestId: string; signature: string };

/** Céntimos → «29,95» para el campo de precio. */
function priceText(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

/**
 * Mostrador para la tablet: buscar o escanear, ajustar unidades y precio, y
 * descontar. Cada línea cobra el PVP salvo que se indique otro precio (un
 * descuento). La misma clave de petición se reutiliza si se reintenta el mismo
 * ticket (doble toque, red lenta) y cambia en cuanto cambia el ticket.
 */
export function Counter({
  items,
  locationId,
}: {
  items: CounterItem[];
  locationId: string;
}) {
  const byId = useMemo(
    () => new Map(items.map((item) => [item.variantId, item])),
    [items],
  );
  const [kind, setKind] = useState<CounterKind>('sale');
  const [lines, setLines] = useState<TicketLine[]>([]);
  const [ticketRef, setTicketRef] = useState('');
  // Lo tecleado en cada precio, para no perder un «29,» a medio escribir.
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [result, setResult] = useState<CounterResult | null>(null);
  const [pendingRequest, setPendingRequest] = useState<Pending | null>(null);
  const [pending, startTransition] = useTransition();

  const blocked = linesWithoutStock(lines, byId, kind);
  const aboveRetail = linesAboveRetail(lines, byId);
  const invalidPrice = lines
    .filter((line) => {
      const draft = priceDrafts[line.variantId]?.trim();
      return Boolean(draft) && parseEuros(draft!) === null;
    })
    .map((line) => line.variantId);
  const units = ticketUnits(lines);
  const total = ticketTotal(lines, byId);
  const signature = JSON.stringify([kind, lines, ticketRef.trim()]);

  function editPrice(variantId: string, text: string) {
    setPriceDrafts({ ...priceDrafts, [variantId]: text });
    const cents = text.trim() ? parseEuros(text) : null;
    if (text.trim() && cents === null) {
      setResult(null);
      return;
    }
    edit(setLinePrice(lines, variantId, cents));
  }

  function edit(next: TicketLine[]) {
    setLines(next);
    // Una línea quitada pierde su precio escrito: si vuelve, cobra el PVP.
    setPriceDrafts((drafts) =>
      Object.fromEntries(
        Object.entries(drafts).filter(([id]) =>
          next.some((line) => line.variantId === id),
        ),
      ),
    );
    setResult(null);
  }

  function submit() {
    const requestId =
      pendingRequest?.signature === signature
        ? pendingRequest.requestId
        : newRequestId();
    setPendingRequest({ requestId, signature });
    startTransition(async () => {
      try {
        const response = await recordCounterTicket({
          locationId,
          kind,
          requestId,
          ticketRef,
          lines,
        });
        setResult(response);
        if (response.status === 'ok') {
          setLines([]);
          setPriceDrafts({});
          setTicketRef('');
          setPendingRequest(null);
        }
      } catch {
        // Sin respuesta (red): se puede reintentar con la misma clave.
        setResult({
          status: 'error',
          message:
            'No hay respuesta del servidor. Vuelve a pulsar: si ya se registró, no se descontará dos veces.',
        });
      }
    });
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <section className="space-y-6">
        <div
          className="flex gap-2"
          role="radiogroup"
          aria-label="Tipo de operación"
        >
          {COUNTER_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => {
                setKind(k);
                setResult(null);
              }}
              className={buttonClass(
                kind === k ? 'primary' : 'outline',
                'md',
                'min-h-12 flex-1',
              )}
            >
              {COUNTER_KIND_LABELS[k]}
            </button>
          ))}
        </div>
        <VariantSearch
          items={items}
          autoFocus
          label="Añadir perfume"
          onPick={(item) => edit(addToTicket(lines, item.variantId))}
          renderMeta={(item) => (
            <>
              <span className={item.available <= 0 ? 'text-danger' : ''}>
                {item.available} disp.
              </span>
              {item.priceCents !== null && (
                <span className="text-fg-muted block">
                  {formatEuros(item.priceCents, 'es')}
                </span>
              )}
            </>
          )}
        />
        <p className="text-fg-muted text-xs leading-relaxed">
          Con un lector de códigos, escanea directamente en el buscador. El
          panel no emite tickets: registra lo que se vende en la caja o el TPV,
          con el precio cobrado, para que el stock de la web y las ventas sean
          reales. Si hay descuento, escribe el precio por unidad cobrado.
        </p>
      </section>

      <Card as="section" className="space-y-5" aria-label="Ticket">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-2xl font-light">{COUNTER_KIND_LABELS[kind]}</h2>
          <p className="text-fg-muted tracking-caps-sm text-xs uppercase">
            {units} {units === 1 ? 'unidad' : 'unidades'}
          </p>
        </div>

        {lines.length === 0 ? (
          <p className="text-fg-muted py-8 text-center text-sm">
            Busca o escanea un perfume para añadirlo.
          </p>
        ) : (
          <ul className="divide-border border-border divide-y border-y">
            {lines.map((line) => {
              const item = byId.get(line.variantId);
              const short = blocked.includes(line.variantId);
              const badPrice =
                aboveRetail.includes(line.variantId) ||
                invalidPrice.includes(line.variantId);
              const price = linePrice(line, item);
              const failed =
                result?.status === 'error' &&
                result.variantId === line.variantId;
              return (
                <li
                  key={line.variantId}
                  className={`space-y-2 py-3 ${short || failed || badPrice ? 'text-danger' : ''}`}
                >
                  <div className="min-w-0 text-sm">
                    <p>
                      <span className="text-fg-muted">
                        {item?.brandName ?? '—'} ·{' '}
                      </span>
                      {item?.productName ?? line.variantId}
                    </p>
                    <p className="text-fg-muted text-xs">
                      {item?.variantLabel}
                      {item?.priceCents != null &&
                        ` · PVP ${formatEuros(item.priceCents, 'es')}`}
                      {` · ${item?.available ?? 0} disp.`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label="Una unidad menos"
                      onClick={() =>
                        edit(
                          setLineQuantity(
                            lines,
                            line.variantId,
                            line.quantity - 1,
                          ),
                        )
                      }
                      className="border-border hover:border-fg h-11 w-11 border text-lg"
                    >
                      −
                    </button>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={MAX_LINE_QUANTITY}
                      value={line.quantity}
                      aria-label="Unidades"
                      onChange={(event) =>
                        edit(
                          setLineQuantity(
                            lines,
                            line.variantId,
                            Number(event.target.value),
                          ),
                        )
                      }
                      className="h-11 w-16! text-center tabular-nums"
                    />
                    <button
                      type="button"
                      aria-label="Una unidad más"
                      onClick={() => edit(addToTicket(lines, line.variantId))}
                      className="border-border hover:border-fg h-11 w-11 border text-lg"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        edit(setLineQuantity(lines, line.variantId, 0))
                      }
                      className="text-fg-muted hover:text-danger tracking-caps-sm ml-auto min-h-11 px-2 text-xs uppercase"
                    >
                      Quitar
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <label className="flex items-center gap-2 text-xs">
                      <span className="text-fg-muted">Precio/ud.</span>
                      <Input
                        inputMode="decimal"
                        autoComplete="off"
                        value={priceDrafts[line.variantId] ?? ''}
                        placeholder={
                          item?.priceCents != null
                            ? priceText(item.priceCents)
                            : 'Sin PVP'
                        }
                        aria-invalid={badPrice || undefined}
                        onChange={(event) =>
                          editPrice(line.variantId, event.target.value)
                        }
                        className={`h-11 w-28! text-right tabular-nums ${badPrice ? 'border-danger' : ''}`}
                      />
                      <span className="text-fg-muted">€</span>
                    </label>
                    <span
                      className={`ml-auto text-sm tabular-nums ${badPrice ? 'text-danger' : ''}`}
                    >
                      {price === null
                        ? 'Sin precio'
                        : formatEuros(price * line.quantity, 'es')}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {lines.length > 0 && (
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-fg-muted text-2xs tracking-caps font-semibold uppercase">
              {kind === 'sale' ? 'Total cobrado' : 'Total devuelto'} (IVA incl.)
            </p>
            <p className="font-display text-3xl font-light tabular-nums">
              {formatEuros(total.totalCents, 'es')}
            </p>
          </div>
        )}
        {total.unpriced.length > 0 && (
          <p className="text-fg-muted text-xs">
            Hay líneas sin PVP: indica el precio cobrado para que cuenten en las
            ventas.
          </p>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-fg-muted text-2xs tracking-caps font-semibold uppercase">
            Nº de ticket del TPV o la caja
          </span>
          <Input
            value={ticketRef}
            onChange={(event) => {
              setTicketRef(event.target.value);
              setResult(null);
            }}
            maxLength={MAX_TICKET_REF}
            autoComplete="off"
          />
          <span className="text-fg-muted text-xs">
            Opcional, pero permite cuadrar el stock con la caja.
          </span>
        </label>

        {(aboveRetail.length > 0 || invalidPrice.length > 0) && (
          <p className="text-danger text-sm" role="alert">
            {invalidPrice.length > 0
              ? 'Revisa el precio de las líneas en rojo (por ejemplo, 29,95).'
              : 'El precio cobrado no puede superar el PVP: solo se aplican descuentos.'}
          </p>
        )}

        {blocked.length > 0 && (
          <p className="text-danger text-sm" role="alert">
            No hay unidades suficientes en el sistema para las líneas en rojo.
            Si las tienes en la mano, el stock está mal: haz un recuento en{' '}
            <Link href="/admin/inventario" className="underline">
              Inventario
            </Link>
            .
          </p>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={
            pending ||
            lines.length === 0 ||
            blocked.length > 0 ||
            aboveRetail.length > 0 ||
            invalidPrice.length > 0
          }
          className={buttonClass('primary', 'md', 'min-h-14 w-full')}
        >
          {pending
            ? 'Registrando…'
            : kind === 'sale'
              ? `Descontar ${units} ${units === 1 ? 'unidad' : 'unidades'}`
              : `Devolver ${units} ${units === 1 ? 'unidad' : 'unidades'} al stock`}
        </button>

        {result && (
          <p
            role={result.status === 'error' ? 'alert' : 'status'}
            className={`bg-surface-raised/50 border-l-2 px-4 py-3 text-sm ${
              result.status === 'ok'
                ? 'border-success/30 text-success'
                : 'border-danger/30 text-danger'
            }`}
          >
            {result.message}
          </p>
        )}
      </Card>
    </div>
  );
}
