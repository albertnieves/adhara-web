-- Devoluciones de los pedidos web con el TPV (docs/PLAN_PEDIDOS_WEB.md,
-- entrega P06; DECISIONS §139). El personal con orders.refund y MFA solo
-- SOLICITA una devolución; lo que la da por hecha es la respuesta firmada del
-- banco, que el servidor registra con la clave privilegiada. Nunca se marca
-- un pedido como reembolsado solo porque alguien pulse un botón.

alter table public.order_events drop constraint order_events_kind_check;
alter table public.order_events add constraint order_events_kind_check check (kind in (
  'created', 'reservation_released', 'payment_confirmed', 'payment_review',
  'payment_not_paid', 'payment_attempt', 'status_changed',
  'refund_requested', 'refund_succeeded', 'refund_failed'
));

create table public.order_refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  -- Cobro que se devuelve (el del pedido o un cobro de más).
  payment_id bigint not null references public.order_payments (id) on delete restrict,
  -- Clave de idempotencia de la petición del panel: repetirla no crea otra.
  request_id uuid not null unique,
  -- Estado al que pasa el pedido cuando el banco la acepta; null en la
  -- devolución de un cobro de más, que no cambia el pedido.
  to_status text check (to_status in ('cancelled', 'refunded', 'partially_refunded')),
  amount_cents integer not null check (amount_cents > 0),
  provider text not null,
  -- Número de pedido del banco del cobro original.
  reference text not null,
  -- requested: enviada al banco; unknown: sin respuesta clara (comprobar en
  -- el portal del banco); succeeded y failed: lo que dijo el banco.
  status text not null default 'requested'
    check (status in ('requested', 'succeeded', 'failed', 'unknown')),
  response_code text check (char_length(response_code) <= 20),
  error text check (char_length(error) <= 200),
  requested_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index order_refunds_order_idx on public.order_refunds (order_id, created_at);
create index order_refunds_payment_idx on public.order_refunds (payment_id);
create index order_refunds_requested_by_idx on public.order_refunds (requested_by);
-- Una sola devolución abierta por pedido a la vez.
create unique index order_refunds_one_open on public.order_refunds (order_id)
  where status in ('requested', 'unknown');

alter table public.order_refunds enable row level security;
revoke all on public.order_refunds from anon;
revoke insert, update, delete, truncate on public.order_refunds from authenticated;

create policy "orders.view lee las devoluciones" on public.order_refunds
  for select to authenticated
  using ((select private.has_permission('orders.view')));

-- ---------------------------------------------------------------------------
-- Solicitud desde el panel
-- ---------------------------------------------------------------------------

-- p_payment_id: el cobro que se devuelve. Con p_to (cancelled, refunded o
-- partially_refunded) es el cobro del pedido y el paso debe ser uno de
-- status.ts con devolución; sin p_to, un cobro de más que se devuelve entero
-- sin cambiar el pedido. El importe nunca supera lo cobrado menos lo ya
-- devuelto. Devuelve {refund_id, number, provider, reference, amount_cents,
-- status}; con el mismo p_request_id devuelve la misma solicitud.
create function public.admin_request_refund(
  p_order_id uuid,
  p_payment_id bigint,
  p_to text,
  p_amount_cents integer,
  p_request_id uuid,
  p_revision integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_order public.orders;
  v_payment public.order_payments;
  v_attempt public.order_payment_attempts;
  v_refund public.order_refunds;
  v_rule record;
  v_remaining integer;
begin
  if not private.has_permission('orders.refund') or private.current_aal() <> 'aal2' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_request_id is null then
    raise exception 'invalid_request' using errcode = '22023';
  end if;
  select * into v_refund from public.order_refunds r where r.request_id = p_request_id;
  if found then
    if v_refund.order_id <> p_order_id then
      raise exception 'invalid_request' using errcode = '22023';
    end if;
    select * into v_order from public.orders o where o.id = v_refund.order_id;
    return jsonb_build_object('refund_id', v_refund.id, 'number', v_order.number,
      'provider', v_refund.provider, 'reference', v_refund.reference,
      'amount_cents', v_refund.amount_cents, 'status', v_refund.status);
  end if;

  select * into v_order from public.orders o where o.id = p_order_id for update;
  if not found then
    raise exception 'unknown_order' using errcode = '22023';
  end if;
  if p_revision is null or v_order.revision <> p_revision then
    raise exception 'stale_revision' using errcode = '55000';
  end if;
  select * into v_payment from public.order_payments p
  where p.id = p_payment_id and p.order_id = v_order.id
    and p.outcome = 'succeeded' and p.decision in ('confirm', 'review');
  if not found then
    raise exception 'invalid_payment' using errcode = '22023';
  end if;
  if exists (select 1 from public.order_refunds r
             where r.order_id = v_order.id and r.status in ('requested', 'unknown')) then
    raise exception 'refund_in_progress' using errcode = '55000';
  end if;
  v_remaining := v_payment.amount_cents - coalesce((
    select sum(r.amount_cents) from public.order_refunds r
    where r.payment_id = v_payment.id and r.status = 'succeeded'), 0);
  if v_remaining <= 0 then
    raise exception 'nothing_to_refund' using errcode = '55000';
  end if;

  if p_to is null then
    -- Cobro de más: no es el del pedido y se devuelve entero.
    if v_payment.transaction_id = v_order.received_transaction_id then
      raise exception 'invalid_transition' using errcode = '22023';
    end if;
    if p_amount_cents is distinct from v_remaining then
      raise exception 'invalid_amount' using errcode = '22023';
    end if;
  else
    select * into v_rule from private.order_transition(v_order.status, p_to);
    if not found or not v_rule.refund then
      raise exception 'invalid_transition' using errcode = '22023';
    end if;
    if v_payment.transaction_id is distinct from v_order.received_transaction_id then
      raise exception 'invalid_payment' using errcode = '22023';
    end if;
    if (p_to = 'partially_refunded' and (p_amount_cents is null
          or p_amount_cents <= 0 or p_amount_cents >= v_remaining))
       or (p_to <> 'partially_refunded' and p_amount_cents is distinct from v_remaining) then
      raise exception 'invalid_amount' using errcode = '22023';
    end if;
  end if;

  select * into v_attempt from public.order_payment_attempts a where a.id = v_payment.attempt_id;
  insert into public.order_refunds (
    order_id, payment_id, request_id, to_status, amount_cents, provider, reference,
    requested_by
  ) values (
    v_order.id, v_payment.id, p_request_id, p_to, p_amount_cents, v_attempt.provider,
    v_attempt.reference, v_actor
  ) returning * into v_refund;
  -- Otra pantalla con la ficha abierta verá que el pedido cambió.
  update public.orders set revision = revision + 1 where id = v_order.id;
  insert into public.order_events (order_id, kind, actor_id, detail)
  values (v_order.id, 'refund_requested', v_actor,
          jsonb_build_object('amount_cents', p_amount_cents, 'to_status', p_to,
                             'payment_id', v_payment.id));
  insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
  values (v_actor, 'orders.refund_request', 'order', v_order.id::text,
          jsonb_build_object('status', v_order.status),
          jsonb_build_object('number', v_order.number, 'amount_cents', p_amount_cents,
                             'to_status', p_to));
  return jsonb_build_object('refund_id', v_refund.id, 'number', v_order.number,
    'provider', v_refund.provider, 'reference', v_refund.reference,
    'amount_cents', v_refund.amount_cents, 'status', v_refund.status);
end;
$$;

-- ---------------------------------------------------------------------------
-- Respuesta del banco (solo el servidor, tras verificar su firma)
-- ---------------------------------------------------------------------------

-- p_status: succeeded (el banco la aceptó), failed (la rechazó) o unknown
-- (sin respuesta clara). Aceptada, el pedido pasa al estado pedido y, si el
-- paso lo dice, devuelve al stock lo reservado. Repetir el resultado de una
-- devolución ya cerrada no tiene efecto. Devuelve {status, number, changed}.
create function public.web_order_refund_result(
  p_refund_id uuid,
  p_status text,
  p_response_code text default null,
  p_error text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_refund public.order_refunds;
  v_order public.orders;
  v_rule record;
  v_from text;
  v_reservation text;
begin
  if not private.is_service_role() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('succeeded', 'failed', 'unknown') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  select * into v_refund from public.order_refunds r where r.id = p_refund_id;
  if not found then
    raise exception 'unknown_refund' using errcode = '22023';
  end if;
  select * into v_order from public.orders o where o.id = v_refund.order_id for update;
  select * into v_refund from public.order_refunds r where r.id = p_refund_id for update;
  if v_refund.status not in ('requested', 'unknown') then
    return jsonb_build_object('status', v_refund.status, 'number', v_order.number,
                              'changed', false);
  end if;

  update public.order_refunds
  set status = p_status,
      response_code = left(p_response_code, 20),
      error = left(p_error, 200),
      resolved_at = case when p_status = 'unknown' then null else now() end
  where id = v_refund.id;

  if p_status = 'succeeded' then
    insert into public.order_events (order_id, kind, actor_id, detail)
    values (v_order.id, 'refund_succeeded', v_refund.requested_by,
            jsonb_build_object('amount_cents', v_refund.amount_cents,
                               'response_code', p_response_code));
    if v_refund.to_status is not null then
      select * into v_rule from private.order_transition(v_order.status, v_refund.to_status);
      if found and v_rule.refund then
        v_from := v_order.status;
        v_reservation := v_order.reservation;
        if v_rule.inventory = 'release_reservation'
           and v_order.reservation in ('active', 'committed') then
          perform private.apply_order_inventory(v_order, 'RESERVATION_RELEASE',
                                                v_refund.requested_by);
          v_reservation := 'released';
        end if;
        update public.orders
        set status = v_refund.to_status, reservation = v_reservation
        where id = v_order.id;
        insert into public.order_events (order_id, kind, from_status, to_status, actor_id, detail)
        values (v_order.id, 'status_changed', v_from, v_refund.to_status,
                v_refund.requested_by,
                jsonb_build_object('refund_id', v_refund.id, 'inventory',
                  case when v_reservation <> v_order.reservation then v_rule.inventory end));
      end if;
    end if;
  elsif p_status = 'failed' then
    insert into public.order_events (order_id, kind, actor_id, detail)
    values (v_order.id, 'refund_failed', v_refund.requested_by,
            jsonb_build_object('amount_cents', v_refund.amount_cents,
                               'response_code', p_response_code, 'error', p_error));
  end if;
  update public.orders set revision = revision + 1 where id = v_order.id;
  return jsonb_build_object('status', p_status, 'number', v_order.number, 'changed', true);
end;
$$;

-- Vuelve a enviar una devolución sin respuesta clara (unknown) tras
-- comprobarla en el portal del banco: la deja otra vez «enviada». El banco
-- rechaza devolver más de lo cobrado.
create function public.admin_retry_refund(p_refund_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_refund public.order_refunds;
  v_order public.orders;
begin
  if not private.has_permission('orders.refund') or private.current_aal() <> 'aal2' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_refund from public.order_refunds r where r.id = p_refund_id;
  if not found then
    raise exception 'unknown_refund' using errcode = '22023';
  end if;
  select * into v_order from public.orders o where o.id = v_refund.order_id for update;
  select * into v_refund from public.order_refunds r where r.id = p_refund_id for update;
  if v_refund.status <> 'unknown' then
    raise exception 'refund_not_retryable' using errcode = '55000';
  end if;
  update public.order_refunds set status = 'requested', error = null
  where id = v_refund.id;
  insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
  values (v_actor, 'orders.refund_retry', 'order', v_order.id::text, null,
          jsonb_build_object('number', v_order.number, 'amount_cents', v_refund.amount_cents));
  return jsonb_build_object('refund_id', v_refund.id, 'number', v_order.number,
    'provider', v_refund.provider, 'reference', v_refund.reference,
    'amount_cents', v_refund.amount_cents, 'status', 'requested');
end;
$$;

-- ---------------------------------------------------------------------------
-- Copia diaria y permisos
-- ---------------------------------------------------------------------------

create or replace function private.control_export_tables()
returns table (schema_name text, table_name text, sort_order integer)
language sql
stable
set search_path = ''
as $f$
  select split_part(w.qualified, '.', 1), split_part(w.qualified, '.', 2), w.n::integer
  from unnest(array[
    'public.permissions',
    'public.role_permissions',
    'public.staff_members',
    'public.stock_locations',
    'public.stock_watch_settings',
    'public.shipping_rates',
    'public.brands',
    'public.products',
    'public.product_translations',
    'public.product_variants',
    'public.product_media',
    'public.product_scent_profiles',
    'public.inventory_levels',
    'public.inventory_movements',
    'public.store_sales',
    'public.store_sale_lines',
    'public.orders',
    'public.order_lines',
    'public.order_contacts',
    'public.order_payment_attempts',
    'public.order_payments',
    'public.order_events',
    'public.order_emails',
    'public.order_refunds',
    'public.store_content',
    'public.newsletter_subscribers',
    'public.daily_reports',
    'public.audit_log',
    'public.assistant_usage',
    'internal.price_change_log',
    'internal.variant_cost_records',
    'internal.suppliers',
    'internal.supplier_variants',
    'internal.purchase_orders',
    'internal.purchase_order_lines',
    'internal.purchase_receipts',
    'internal.purchase_receipt_lines',
    'internal.control_tasks',
    'internal.control_costs',
    'internal.control_deliveries',
    'internal.control_owners',
    'internal.control_backups',
    'internal.product_attention_daily',
    'private.store_documents',
    'private.store_revisions'
  ]) with ordinality as w(qualified, n)
  where to_regclass(w.qualified) is not null;
$f$;

revoke execute on function
  public.admin_request_refund(uuid, bigint, text, integer, uuid, integer),
  public.admin_retry_refund(uuid)
  from public, anon;
grant execute on function
  public.admin_request_refund(uuid, bigint, text, integer, uuid, integer),
  public.admin_retry_refund(uuid)
  to authenticated;
revoke execute on function public.web_order_refund_result(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.web_order_refund_result(uuid, text, text, text)
  to service_role;
