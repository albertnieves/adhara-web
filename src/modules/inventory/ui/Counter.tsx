'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { formatEuros } from '@/lib/money';
import { newRequestId } from '@/lib/request-id';
import type { CounterItem, CounterKind, TicketLine } from '../domain/counter';
import {
  COUNTER_KINDS,
  COUNTER_KIND_LABELS,
  MAX_LINE_QUANTITY,
  MAX_TICKET_REF,
  addToTicket,
  linesWithoutStock,
  setLineQuantity,
  ticketUnits,
} from '../domain/counter';
import type { CounterResult } from '../server/counter';
import { recordCounterTicket } from '../server/counter';
import { VariantSearch } from './VariantSearch';

type Pending = { requestId: string; signature: string };

/**
 * Mostrador para la tablet: buscar o escanear, ajustar unidades y descontar.
 * La misma clave de petición se reutiliza si se reintenta el mismo ticket
 * (doble toque, red lenta) y cambia en cuanto cambia el ticket.
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
  const [result, setResult] = useState<CounterResult | null>(null);
  const [pendingRequest, setPendingRequest] = useState<Pending | null>(null);
  const [pending, startTransition] = useTransition();

  const blocked = linesWithoutStock(lines, byId, kind);
  const units = ticketUnits(lines);
  const signature = JSON.stringify([kind, lines, ticketRef.trim()]);

  function edit(next: TicketLine[]) {
    setLines(next);
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
              className={`min-h-12 flex-1 border px-4 text-xs font-semibold tracking-[0.18em] uppercase transition-colors ${
                kind === k
                  ? 'border-ink bg-ink text-ivory'
                  : 'border-line hover:border-ink'
              }`}
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
                <span className="text-smoke block">
                  {formatEuros(item.priceCents, 'es')}
                </span>
              )}
            </>
          )}
        />
        <p className="text-smoke text-xs leading-relaxed">
          Con un lector de códigos, escanea directamente en el buscador. El
          panel no emite tickets: registra lo que se vende en la caja o el TPV
          para que el stock de la web sea real.
        </p>
      </section>

      <section className="panel-card space-y-5" aria-label="Ticket">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-2xl font-light">{COUNTER_KIND_LABELS[kind]}</h2>
          <p className="text-smoke text-xs tracking-[0.14em] uppercase">
            {units} {units === 1 ? 'unidad' : 'unidades'}
          </p>
        </div>

        {lines.length === 0 ? (
          <p className="text-smoke py-8 text-center text-sm">
            Busca o escanea un perfume para añadirlo.
          </p>
        ) : (
          <ul className="divide-line border-line divide-y border-y">
            {lines.map((line) => {
              const item = byId.get(line.variantId);
              const short = blocked.includes(line.variantId);
              const failed =
                result?.status === 'error' &&
                result.variantId === line.variantId;
              return (
                <li
                  key={line.variantId}
                  className={`space-y-2 py-3 ${short || failed ? 'text-danger' : ''}`}
                >
                  <div className="min-w-0 text-sm">
                    <p>
                      <span className="text-smoke">
                        {item?.brandName ?? '—'} ·{' '}
                      </span>
                      {item?.productName ?? line.variantId}
                    </p>
                    <p className="text-smoke text-xs">
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
                      className="border-line hover:border-ink h-11 w-11 border text-lg"
                    >
                      −
                    </button>
                    <input
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
                      className="input h-11 w-16 text-center tabular-nums"
                    />
                    <button
                      type="button"
                      aria-label="Una unidad más"
                      onClick={() => edit(addToTicket(lines, line.variantId))}
                      className="border-line hover:border-ink h-11 w-11 border text-lg"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        edit(setLineQuantity(lines, line.variantId, 0))
                      }
                      className="text-smoke hover:text-danger ml-auto min-h-11 px-2 text-xs tracking-[0.14em] uppercase"
                    >
                      Quitar
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-smoke text-[0.6875rem] font-semibold tracking-[0.16em] uppercase">
            Nº de ticket del TPV o la caja
          </span>
          <input
            value={ticketRef}
            onChange={(event) => {
              setTicketRef(event.target.value);
              setResult(null);
            }}
            maxLength={MAX_TICKET_REF}
            autoComplete="off"
            className="input"
          />
          <span className="text-fg-muted text-xs">
            Opcional, pero permite cuadrar el stock con la caja.
          </span>
        </label>

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
          disabled={pending || lines.length === 0 || blocked.length > 0}
          className="bg-ink text-ivory hover:bg-ink-soft inline-flex min-h-14 w-full items-center justify-center px-5 text-xs font-semibold tracking-[0.18em] uppercase transition-colors duration-300 disabled:opacity-50"
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
      </section>
    </div>
  );
}
