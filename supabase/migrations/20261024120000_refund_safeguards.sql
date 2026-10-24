-- Tres arreglos de las devoluciones de la revisión de seguridad del 17/10
-- (docs/SECURITY_REVIEW_2026-10.md, «Devoluciones»; DECISIONS §168). Solo
-- personal con orders.refund y MFA; ninguno mueve dinero por sí mismo.
--
-- 1. Una petición repetida con la misma clave ya no se manda dos veces al
--    banco: admin_request_refund dice si la acaba de crear (created) y el
--    servidor solo la envía entonces.
-- 2. Una devolución sin respuesta clara, o que quedó a medias (enviada sin
--    respuesta guardada hace más de 10 minutos), se puede volver a enviar o
--    resolver desde el panel tras mirarla en el portal del banco
--    (admin_resolve_refund). Hasta ahora bloqueaba el pedido para siempre.
-- 3. Con una devolución abierta, el pedido no cambia de estado desde el panel
--    (por ejemplo, «Marcar enviado» mientras el banco devuelve el dinero).

-- Cuándo se mandó al banco por última vez (al pedirla o al reenviarla): lo que
-- lleva más de 10 minutos sin respuesta guardada ya no está en camino.
alter table public.order_refunds
  add column sent_at timestamptz not null default now();

-- Respuesta del banco o comprobación en el portal: el efecto en el pedido es
-- el mismo. p_actor es quien la pidió (respuesta del banco) o quien la
-- resolvió (portal); p_source 'portal' queda en la cronología.
create function private.apply_refund_outcome(
  p_refund_id uuid,
  p_status text,
  p_response_code text,
  p_error text,
  p_actor uuid,
  p_source text
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
  v_detail jsonb;
begin
  -- Bloqueos en el orden de siempre: pedido y después la devolución.
  select * into v_refund from public.order_refunds r where r.id = p_refund_id;
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

  v_detail := jsonb_build_object('amount_cents', v_refund.amount_cents,
                                 'response_code', p_response_code)
              || case when p_source is null then '{}'::jsonb
                      else jsonb_build_object('source', p_source) end;
  if p_status = 'succeeded' then
    insert into public.order_events (order_id, kind, actor_id, detail)
    values (v_order.id, 'refund_succeeded', p_actor, v_detail);
    if v_refund.to_status is not null then
      select * into v_rule from private.order_transition(v_order.status, v_refund.to_status);
      if found and v_rule.refund then
        v_from := v_order.status;
        v_reservation := v_order.reservation;
        if v_rule.inventory = 'release_reservation'
           and v_order.reservation in ('active', 'committed') then
          perform private.apply_order_inventory(v_order, 'RESERVATION_RELEASE', p_actor);
          v_reservation := 'released';
        end if;
        update public.orders
        set status = v_refund.to_status, reservation = v_reservation
        where id = v_order.id;
        insert into public.order_events (order_id, kind, from_status, to_status, actor_id, detail)
        values (v_order.id, 'status_changed', v_from, v_refund.to_status, p_actor,
                jsonb_build_object('refund_id', v_refund.id, 'inventory',
                  case when v_reservation <> v_order.reservation then v_rule.inventory end));
      end if;
    end if;
  elsif p_status = 'failed' then
    insert into public.order_events (order_id, kind, actor_id, detail)
    values (v_order.id, 'refund_failed', p_actor, v_detail || jsonb_build_object('error', p_error));
  end if;
  update public.orders set revision = revision + 1 where id = v_order.id;
  return jsonb_build_object('status', p_status, 'number', v_order.number, 'changed', true);
end;
$$;

-- Lo que lleva más de 10 minutos enviado sin respuesta guardada: el servidor
-- espera al banco 20 segundos como mucho, así que ya no llegará nada.
create function private.refund_stalled(p_refund public.order_refunds)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_refund.status = 'unknown'
      or (p_refund.status = 'requested' and p_refund.sent_at < now() - interval '10 minutes');
$$;

-- ---------------------------------------------------------------------------
-- 1. La solicitud dice si es nueva
-- ---------------------------------------------------------------------------

-- Igual que en 20261012200000_order_refunds, con created: true si esta
-- llamada la ha creado y false si devuelve una que ya existía (la misma
-- clave). El servidor solo manda al banco las nuevas.
create or replace function public.admin_request_refund(
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
      'amount_cents', v_refund.amount_cents, 'status', v_refund.status,
      'created', false);
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
    'amount_cents', v_refund.amount_cents, 'status', v_refund.status,
    'created', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Respuesta del banco: el mismo efecto, ahora en private.apply_refund_outcome
-- ---------------------------------------------------------------------------

create or replace function public.web_order_refund_result(
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
  return private.apply_refund_outcome(v_refund.id, p_status, p_response_code, p_error,
                                      v_refund.requested_by, null);
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Volver a enviar o resolver una devolución atascada
-- ---------------------------------------------------------------------------

-- Vuelve a enviar una devolución sin respuesta clara o que quedó a medias,
-- tras comprobar en el portal del banco que no se hizo.
create or replace function public.admin_retry_refund(p_refund_id uuid)
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
  if not private.refund_stalled(v_refund) then
    raise exception 'refund_not_retryable' using errcode = '55000';
  end if;
  update public.order_refunds set status = 'requested', error = null, sent_at = now()
  where id = v_refund.id;
  insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
  values (v_actor, 'orders.refund_retry', 'order', v_order.id::text,
          jsonb_build_object('status', v_refund.status),
          jsonb_build_object('number', v_order.number, 'amount_cents', v_refund.amount_cents));
  return jsonb_build_object('refund_id', v_refund.id, 'number', v_order.number,
    'provider', v_refund.provider, 'reference', v_refund.reference,
    'amount_cents', v_refund.amount_cents, 'status', 'requested', 'created', true);
end;
$$;

-- Resuelve una devolución atascada con lo que dice el portal del banco:
-- 'succeeded' si allí consta hecha (el pedido cambia como con la respuesta
-- del banco) o 'failed' si no consta (el pedido sigue igual y se puede pedir
-- otra). Queda como comprobada en el portal, con quién lo hizo.
create function public.admin_resolve_refund(p_refund_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_refund public.order_refunds;
  v_order public.orders;
  v_result jsonb;
begin
  if not private.has_permission('orders.refund') or private.current_aal() <> 'aal2' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('succeeded', 'failed') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  select * into v_refund from public.order_refunds r where r.id = p_refund_id;
  if not found then
    raise exception 'unknown_refund' using errcode = '22023';
  end if;
  select * into v_order from public.orders o where o.id = v_refund.order_id for update;
  select * into v_refund from public.order_refunds r where r.id = p_refund_id for update;
  if not private.refund_stalled(v_refund) then
    raise exception 'refund_not_resolvable' using errcode = '55000';
  end if;
  v_result := private.apply_refund_outcome(v_refund.id, p_status, 'portal', null,
                                           v_actor, 'portal');
  insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
  values (v_actor, 'orders.refund_resolve', 'order', v_order.id::text,
          jsonb_build_object('status', v_order.status, 'refund_status', v_refund.status),
          jsonb_build_object('number', v_order.number, 'amount_cents', v_refund.amount_cents,
                             'refund_status', p_status));
  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Sin cambios de estado con una devolución abierta
-- ---------------------------------------------------------------------------

-- Igual que en 20261011230000_web_orders, con una comprobación más: mientras
-- una devolución del pedido espera al banco (o está sin resolver), el panel
-- no lo mueve. Así «Marcar enviado» no se cruza con «Cancelar y devolver».
create or replace function public.admin_transition_order(
  p_order_id uuid,
  p_to text,
  p_revision integer,
  p_tracking_reference text default null
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_rule record;
  v_actor uuid := (select auth.uid());
  v_from text;
  v_reservation text;
begin
  if not private.has_permission('orders.view') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_order from public.orders o where o.id = p_order_id for update;
  if not found then
    raise exception 'unknown_order' using errcode = '22023';
  end if;
  if p_revision is null or v_order.revision <> p_revision then
    raise exception 'stale_revision' using errcode = '55000';
  end if;
  select * into v_rule from private.order_transition(v_order.status, p_to);
  if not found then
    raise exception 'invalid_transition' using errcode = '22023';
  end if;
  if v_rule.only_fulfillment is not null and v_rule.only_fulfillment <> v_order.fulfillment then
    raise exception 'wrong_fulfillment' using errcode = '22023';
  end if;
  if v_rule.actor = 'system' or not private.has_permission(v_rule.actor)
     or private.current_aal() <> 'aal2' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_rule.refund then
    raise exception 'refund_unavailable' using errcode = '0A000';
  end if;
  if exists (select 1 from public.order_refunds r
             where r.order_id = v_order.id and r.status in ('requested', 'unknown')) then
    raise exception 'refund_in_progress' using errcode = '55000';
  end if;
  if p_tracking_reference is not null
     and (p_to <> 'shipped' or char_length(btrim(p_tracking_reference)) > 120) then
    raise exception 'invalid_tracking' using errcode = '22023';
  end if;

  v_from := v_order.status;
  v_reservation := v_order.reservation;
  case v_rule.inventory
    when 'none' then
      null;
    when 'reserve_and_commit' then
      if v_order.reservation = 'released' then
        perform private.apply_order_inventory(v_order, 'RESERVATION', v_actor);
      elsif v_order.reservation = 'consumed' then
        raise exception 'reservation_unavailable' using errcode = '55000';
      end if;
      v_reservation := 'committed';
    when 'sale_online', 'sale_click_collect' then
      if v_order.reservation <> 'committed' then
        raise exception 'reservation_unavailable' using errcode = '55000';
      end if;
      perform private.apply_order_inventory(v_order, upper(v_rule.inventory), v_actor);
      v_reservation := 'consumed';
    else
      raise exception 'invalid_transition' using errcode = '22023';
  end case;

  update public.orders
  set status = p_to,
      reservation = v_reservation,
      paid_at = case when p_to = 'paid' then coalesce(paid_at, now()) else paid_at end,
      tracking_reference = coalesce(nullif(btrim(p_tracking_reference), ''), tracking_reference),
      revision = revision + 1
  where id = v_order.id
  returning * into v_order;

  insert into public.order_events (order_id, kind, from_status, to_status, actor_id, detail)
  values (v_order.id, 'status_changed', v_from, p_to, v_actor,
          case when v_rule.inventory <> 'none'
               then jsonb_build_object('inventory', v_rule.inventory) end);
  insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
  values (v_actor, 'orders.transition', 'order', v_order.id::text,
          jsonb_build_object('status', v_from),
          jsonb_build_object('status', p_to, 'number', v_order.number));
  return v_order;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------------

revoke execute on function
  private.apply_refund_outcome(uuid, text, text, text, uuid, text),
  private.refund_stalled(public.order_refunds)
  from public, anon, authenticated;
revoke execute on function public.admin_resolve_refund(uuid, text) from public, anon;
grant execute on function public.admin_resolve_refund(uuid, text) to authenticated;
