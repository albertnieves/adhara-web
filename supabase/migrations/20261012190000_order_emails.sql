-- Correos de los pedidos web (docs/PLAN_PEDIDOS_WEB.md, entrega P06;
-- DECISIONS §138). Cola persistente: el mismo cambio de estado que confirma
-- un pago o deja un pedido listo encola su correo en la misma transacción, y
-- el servidor los envía después. Un fallo del correo nunca revierte el
-- pedido ni lo cobra otra vez, y cada correo sale una sola vez por pedido.

create table public.order_emails (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete restrict,
  -- order_paid: confirmación con las condiciones; ready_for_pickup y shipped:
  -- avisos de entrega.
  kind text not null check (kind in ('order_paid', 'ready_for_pickup', 'shipped')),
  status text not null default 'pending'
    check (status in ('pending', 'sending', 'sent', 'failed')),
  attempts integer not null default 0 check (attempts between 0 and 10),
  -- Mientras un envío está en curso, nadie más lo toma.
  locked_until timestamptz,
  -- Código del proveedor o del error, sin datos personales ni la respuesta.
  last_error text check (char_length(last_error) <= 200),
  provider_id text check (char_length(provider_id) <= 200),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (order_id, kind)
);

create index order_emails_pending_idx on public.order_emails (created_at)
  where status in ('pending', 'sending');

alter table public.order_emails enable row level security;
revoke all on public.order_emails from anon;
revoke insert, update, delete, truncate on public.order_emails from authenticated;

-- El panel enseña en la ficha si salió cada correo (sin su contenido).
create policy "orders.view lee los correos de los pedidos" on public.order_emails
  for select to authenticated
  using ((select private.has_permission('orders.view')));

-- ---------------------------------------------------------------------------
-- Encolado: con cada paso de la cronología que lo merece
-- ---------------------------------------------------------------------------

create function private.enqueue_order_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text;
begin
  v_kind := case new.to_status
    when 'paid' then 'order_paid'
    when 'ready_for_pickup' then 'ready_for_pickup'
    when 'shipped' then 'shipped'
  end;
  if v_kind is not null and new.from_status is distinct from new.to_status then
    insert into public.order_emails (order_id, kind)
    values (new.order_id, v_kind)
    on conflict (order_id, kind) do nothing;
  end if;
  return null;
end;
$$;

create trigger order_events_enqueue_email
  after insert on public.order_events
  for each row execute function private.enqueue_order_email();

-- ---------------------------------------------------------------------------
-- Envío (solo el servidor con la clave privilegiada, DECISIONS §131)
-- ---------------------------------------------------------------------------

-- Toma hasta p_limit correos pendientes (o con un envío anterior que se
-- quedó a medias) y los marca en curso durante 5 minutos. Devuelve lo que
-- necesita cada plantilla: destinatario, idioma, pedido, líneas y entrega.
create function public.web_order_emails_claim(p_limit integer default 10)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids bigint[];
begin
  if not private.is_service_role() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_limit is null or p_limit not between 1 and 50 then
    raise exception 'invalid_limit' using errcode = '22023';
  end if;
  with picked as (
    select e.id from public.order_emails e
    where (e.status = 'pending' or (e.status = 'sending' and e.locked_until < now()))
      and e.attempts < 5
    order by e.created_at
    limit p_limit
    for update skip locked
  ), claimed as (
    update public.order_emails e
    set status = 'sending', attempts = e.attempts + 1,
        locked_until = now() + interval '5 minutes'
    from picked where e.id = picked.id
    returning e.id
  )
  select array_agg(claimed.id) into v_ids from claimed;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', e.id,
      'kind', e.kind,
      'number', o.number,
      'locale', o.locale,
      'fulfillment', o.fulfillment,
      'items_cents', o.items_cents,
      'shipping_cents', o.shipping_cents,
      'total_cents', o.total_cents,
      'tracking_reference', o.tracking_reference,
      'full_name', c.full_name,
      'email', c.email,
      'address', case when o.fulfillment = 'shipping' then jsonb_build_object(
        'line1', c.address_line1, 'line2', c.address_line2,
        'postal_code', c.postal_code, 'city', c.city, 'province', c.province)
      end,
      'lines', (
        select jsonb_agg(jsonb_build_object(
          'brand', l.brand_name, 'name', l.product_name, 'size_ml', l.size_ml,
          'label', l.variant_label, 'quantity', l.quantity,
          'line_total_cents', l.line_total_cents) order by l.brand_name, l.product_name)
        from public.order_lines l where l.order_id = o.id)
    ) order by e.created_at)
    from public.order_emails e
    join public.orders o on o.id = e.order_id
    join public.order_contacts c on c.order_id = o.id
    where e.id = any(v_ids)
  ), '[]'::jsonb);
end;
$$;

-- Resultado de un envío. Sin éxito vuelve a la cola hasta 5 intentos.
create function public.web_order_email_result(
  p_id bigint,
  p_ok boolean,
  p_provider_id text default null,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_service_role() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.order_emails e
  set status = case when p_ok then 'sent'
                    when e.attempts >= 5 then 'failed'
                    else 'pending' end,
      sent_at = case when p_ok then now() end,
      provider_id = case when p_ok then left(p_provider_id, 200) end,
      last_error = case when p_ok then null else left(coalesce(p_error, 'error'), 200) end,
      locked_until = null
  where e.id = p_id and e.status = 'sending';
end;
$$;

-- ---------------------------------------------------------------------------
-- Copia diaria: la cola de correos entra en la lista blanca
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

revoke execute on function private.enqueue_order_email()
  from public, anon, authenticated, service_role;
revoke execute on function
  public.web_order_emails_claim(integer),
  public.web_order_email_result(bigint, boolean, text, text)
  from public, anon, authenticated;
grant execute on function
  public.web_order_emails_claim(integer),
  public.web_order_email_result(bigint, boolean, text, text)
  to service_role;
