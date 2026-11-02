'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Badge, Button, EmptyState, SearchField, Table } from '@/components/ui';
import { formatEuros } from '@/lib/money';
import type { CustomerSearchState } from '../domain/records';
import { CUSTOMERS_PAGE_SIZE, NEWSLETTER_LABELS } from '../domain/records';
import { searchCustomers } from '../server/actions';

const DATE = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'short',
  timeZone: 'Europe/Madrid',
});

/**
 * Lista de clientes con su búsqueda (por nombre o email). La búsqueda va por
 * POST para no dejar emails en la URL (§184); la página empieza con la lista
 * sin buscar.
 */
export function CustomerList({ initial }: { initial: CustomerSearchState }) {
  const [state, action, pending] = useActionState(searchCustomers, initial);
  const pages = Math.max(1, Math.ceil(state.total / CUSTOMERS_PAGE_SIZE));
  const first = (state.page - 1) * CUSTOMERS_PAGE_SIZE + 1;
  const last = first + state.customers.length - 1;

  return (
    <form action={action}>
      <div
        role="search"
        className="border-border mb-6 flex flex-wrap items-center gap-3 border-y py-5"
      >
        <SearchField
          name="q"
          label="Buscar por nombre o email"
          placeholder="Nombre o email"
          defaultValue={state.search}
          pending={pending}
          autoComplete="off"
          className="w-full max-w-md"
        />
        <Button type="submit" variant="outline" name="pagina" value="1">
          Buscar
        </Button>
      </div>

      <p role="status" className="text-fg-muted mb-4 text-sm tabular-nums">
        {state.total === 0
          ? ''
          : state.search
            ? `${state.total} ${state.total === 1 ? 'cliente encaja' : 'clientes encajan'} con «${state.search}».`
            : `${state.total} ${state.total === 1 ? 'cliente' : 'clientes'}.`}
        {pages > 1 && ` Del ${first} al ${last}.`}
      </p>

      {state.customers.length === 0 ? (
        state.search ? (
          <EmptyState
            title={`Nadie encaja con «${state.search}».`}
            description="Prueba con otra parte del nombre o del email."
          />
        ) : (
          <EmptyState
            title="Todavía no hay clientes."
            description="Aparecerán quienes compren en la web, escriban por el formulario o el correo, se unan al Club o creen una cuenta."
          />
        )
      ) : (
        <div className="overflow-x-auto">
          <Table caption="Clientes" className="md:min-w-[52rem]">
            <thead>
              <tr>
                <th>Cliente</th>
                <th className="text-right">Pedidos</th>
                <th className="text-right">Cobrado</th>
                <th className="text-right">Mensajes</th>
                <th>Club</th>
                <th>Cuenta</th>
                <th>Última actividad</th>
              </tr>
            </thead>
            <tbody>
              {state.customers.map((customer) => (
                <tr key={customer.key}>
                  <td data-primary className="max-w-80">
                    <Link
                      href={`/admin/clientes/${customer.key}`}
                      className="link-underline font-semibold break-words"
                    >
                      {customer.name ?? customer.email}
                    </Link>
                    {customer.name && (
                      <p className="text-fg-muted text-xs break-all">
                        {customer.email}
                      </p>
                    )}
                  </td>
                  <td data-label="Pedidos" className="text-right tabular-nums">
                    {customer.orders}
                    {customer.orders > 0 && (
                      <span className="text-fg-muted text-xs">
                        {' '}
                        · {customer.paidOrders}{' '}
                        {customer.paidOrders === 1 ? 'pagado' : 'pagados'}
                      </span>
                    )}
                  </td>
                  <td data-label="Cobrado" className="text-right tabular-nums">
                    {customer.paidOrders > 0
                      ? formatEuros(customer.netCents, 'es')
                      : '—'}
                  </td>
                  <td data-label="Mensajes" className="text-right tabular-nums">
                    {customer.conversations}
                    {customer.openConversations > 0 && (
                      <Badge tone="warning" className="ml-2">
                        {customer.openConversations}{' '}
                        {customer.openConversations === 1
                          ? 'abierta'
                          : 'abiertas'}
                      </Badge>
                    )}
                  </td>
                  <td data-label="Club">
                    {customer.newsletter ? (
                      <Badge
                        tone={
                          customer.newsletter === 'subscribed'
                            ? 'success'
                            : 'neutral'
                        }
                      >
                        {NEWSLETTER_LABELS[customer.newsletter]}
                      </Badge>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td data-label="Cuenta" className="text-sm">
                    {customer.hasAccount ? 'Sí' : '—'}
                  </td>
                  <td
                    data-label="Última actividad"
                    className="text-sm tabular-nums"
                  >
                    {customer.lastActivityAt
                      ? DATE.format(new Date(customer.lastActivityAt))
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      {pages > 1 && (
        <nav
          aria-label="Páginas de clientes"
          className="mt-6 flex flex-wrap items-center gap-3"
        >
          <Button
            type="submit"
            variant="outline"
            name="pagina"
            value={String(state.page - 1)}
            disabled={state.page <= 1 || pending}
          >
            Anteriores
          </Button>
          <span className="text-fg-muted text-sm tabular-nums">
            Página {state.page} de {pages}
          </span>
          <Button
            type="submit"
            variant="outline"
            name="pagina"
            value={String(state.page + 1)}
            disabled={state.page >= pages || pending}
          >
            Siguientes
          </Button>
        </nav>
      )}
    </form>
  );
}
