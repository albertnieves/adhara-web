-- Checkout de la tienda (docs/PLAN_PEDIDOS_WEB.md, entrega P03): envío a la
-- península y a Baleares con las tarifas que fija el titular en el panel
-- (DECISIONS §136). Canarias, Ceuta y Melilla quedan fuera (IGIC y aduana).
-- Sin tarifa activa para una zona, no se vende con envío a ella: no hay
-- precios de envío en el código ni sembrados aquí.

-- ---------------------------------------------------------------------------
-- Tarifas de envío
-- ---------------------------------------------------------------------------

create table public.shipping_rates (
  zone text primary key check (zone in ('peninsula', 'baleares')),
  -- Céntimos con IVA.
  price_cents integer not null check (price_cents between 0 and 100000),
  -- Envío gratis desde este importe de artículos (con IVA); null: nunca.
  free_from_cents integer check (free_from_cents between 1 and 10000000),
  active boolean not null default false,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create index shipping_rates_updated_by_idx on public.shipping_rates (updated_by);

alter table public.shipping_rates enable row level security;
revoke insert, update, delete, truncate on public.shipping_rates
  from anon, authenticated;

-- Las activas son públicas (la tienda las enseña antes de pagar); el
-- personal ve también las apagadas. Nadie escribe directamente.
create policy "la tienda lee las tarifas activas" on public.shipping_rates
  for select to anon using (active);
create policy "el personal lee todas las tarifas" on public.shipping_rates
  for select to authenticated
  using (active or (select private.is_staff()));

-- Zona de un código postal español (mismas reglas que shippingZone en
-- src/modules/checkout/domain/shipping.ts): 07 Baleares; 35 y 38 (Canarias),
-- 51 (Ceuta) y 52 (Melilla) sin envío; el resto de 01–50, península.
create function private.shipping_zone(p_postal_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_postal_code is null
      or p_postal_code !~ '^(0[1-9]|[1-4][0-9]|5[0-2])[0-9]{3}$' then null
    when left(p_postal_code, 2) = '07' then 'baleares'
    when left(p_postal_code, 2) in ('35', '38', '51', '52') then null
    else 'peninsula'
  end;
$$;

-- Panel → Configuración → Envíos (settings.manage, que ya exige MFA).
create function public.admin_save_shipping_rate(
  p_zone text,
  p_price_cents integer,
  p_free_from_cents integer,
  p_active boolean
)
returns public.shipping_rates
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before public.shipping_rates;
  v_rate public.shipping_rates;
begin
  if not private.has_permission('settings.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_zone is null or p_zone not in ('peninsula', 'baleares') then
    raise exception 'invalid_zone' using errcode = '22023';
  end if;
  if p_price_cents is null or p_price_cents not between 0 and 100000
     or (p_free_from_cents is not null and p_free_from_cents not between 1 and 10000000)
     or p_active is null then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  select * into v_before from public.shipping_rates r where r.zone = p_zone for update;
  insert into public.shipping_rates (zone, price_cents, free_from_cents, active, updated_by)
  values (p_zone, p_price_cents, p_free_from_cents, p_active, (select auth.uid()))
  on conflict (zone) do update
    set price_cents = excluded.price_cents,
        free_from_cents = excluded.free_from_cents,
        active = excluded.active,
        updated_by = excluded.updated_by,
        updated_at = now()
  returning * into v_rate;
  insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
  values ((select auth.uid()), 'settings.shipping_rate', 'shipping_rate', p_zone,
          case when v_before.zone is null then null
               else jsonb_build_object('price_cents', v_before.price_cents,
                                       'free_from_cents', v_before.free_from_cents,
                                       'active', v_before.active) end,
          jsonb_build_object('price_cents', v_rate.price_cents,
                             'free_from_cents', v_rate.free_from_cents,
                             'active', v_rate.active));
  return v_rate;
end;
$$;

-- ---------------------------------------------------------------------------
-- Pedido con envío
-- ---------------------------------------------------------------------------

create or replace function private.web_order_summary(
  p_order public.orders,
  p_attempt public.order_payment_attempts
)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'order_id', p_order.id,
    'number', p_order.number,
    'status', p_order.status,
    'items_cents', p_order.items_cents,
    'shipping_cents', p_order.shipping_cents,
    'total_cents', p_order.total_cents,
    'currency', p_order.currency,
    'reserved_until', p_order.reserved_until,
    'provider', p_attempt.provider,
    'payment_reference', p_attempt.reference
  );
$$;

-- Igual que en P02 y, con envío, la dirección en p_contact: address_line1,
-- address_line2?, postal_code, city y province?; el teléfono es obligatorio.
-- Sin p_location_id, la tienda (primera ubicación activa de tipo tienda): el
-- checkout no lee tablas con la clave privilegiada.
-- La zona sale del código postal y el precio, de su tarifa activa (gratis
-- desde free_from_cents de artículos). El navegador no fija ningún importe.
create or replace function public.web_order_create(
  p_request_id uuid,
  p_locale text,
  p_fulfillment text,
  p_location_id uuid,
  p_items jsonb,
  p_contact jsonb,
  p_provider text,
  p_hold_minutes integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_attempt public.order_payment_attempts;
  v_rate public.shipping_rates;
  v_items_cents bigint;
  v_shipping_cents integer := 0;
  v_lines integer;
  v_unavailable uuid;
  v_zone text;
  v_location uuid := p_location_id;
  v_name text := btrim(coalesce(p_contact ->> 'full_name', ''));
  v_email text := lower(btrim(coalesce(p_contact ->> 'email', '')));
  v_phone text := nullif(btrim(coalesce(p_contact ->> 'phone', '')), '');
  v_line1 text := nullif(btrim(coalesce(p_contact ->> 'address_line1', '')), '');
  v_line2 text := nullif(btrim(coalesce(p_contact ->> 'address_line2', '')), '');
  v_postal text := nullif(btrim(coalesce(p_contact ->> 'postal_code', '')), '');
  v_city text := nullif(btrim(coalesce(p_contact ->> 'city', '')), '');
  v_province text := nullif(btrim(coalesce(p_contact ->> 'province', '')), '');
begin
  if not private.is_service_role() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_request_id is null or p_locale is null or p_locale not in ('es', 'ca', 'en')
     or p_hold_minutes is null or p_hold_minutes not between 5 and 120 then
    raise exception 'invalid_order' using errcode = '22023';
  end if;
  if p_fulfillment is null or p_fulfillment not in ('shipping', 'click_collect') then
    raise exception 'invalid_order' using errcode = '22023';
  end if;
  if v_location is null then
    select l.id into v_location from public.stock_locations l
    where l.active and l.kind = 'store' order by l.created_at limit 1;
  end if;
  if v_location is null or not exists (
    select 1 from public.stock_locations l where l.id = v_location and l.active
  ) then
    raise exception 'unknown_location' using errcode = '22023';
  end if;
  if jsonb_typeof(p_contact) is distinct from 'object'
     or char_length(v_name) not between 1 and 120
     or char_length(v_email) > 254
     or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
     or (v_phone is not null and v_phone !~ '^[0-9 +().-]{6,30}$') then
    raise exception 'invalid_contact' using errcode = '22023';
  end if;
  if p_fulfillment = 'shipping' then
    if v_phone is null or v_line1 is null or char_length(v_line1) > 200
       or char_length(coalesce(v_line2, '')) > 200
       or v_postal is null or v_postal !~ '^[0-9]{5}$'
       or v_city is null or char_length(v_city) > 120
       or char_length(coalesce(v_province, '')) > 120 then
      raise exception 'invalid_address' using errcode = '22023';
    end if;
    v_zone := private.shipping_zone(v_postal);
    if v_zone is null then
      raise exception 'shipping_zone_unavailable' using errcode = '22023';
    end if;
    select * into v_rate from public.shipping_rates r where r.zone = v_zone and r.active;
    if not found then
      raise exception 'shipping_unavailable' using errcode = '22023';
    end if;
  else
    -- Recogida: la dirección no se guarda.
    v_line1 := null; v_line2 := null; v_postal := null; v_city := null; v_province := null;
  end if;

  -- Reintento con la misma clave: devuelve el pedido ya creado.
  select * into v_order from public.orders o where o.request_id = p_request_id;
  if found then
    select * into v_attempt from public.order_payment_attempts a
    where a.order_id = v_order.id order by a.created_at desc limit 1;
    return private.web_order_summary(v_order, v_attempt);
  end if;

  -- Formatos bloqueados en modo compartido: un cambio de PVP simultáneo espera
  -- y el total y las líneas salen del mismo precio.
  perform 1 from public.product_variants v
  where v.id in (select i.variant_id from private.parse_quantity_items(p_items, 50) i)
  order by v.id
  for share;

  -- Solo formatos activos, con PVP, de perfumes publicados.
  select i.variant_id into v_unavailable
  from private.parse_quantity_items(p_items, 50) i
  where not exists (
    select 1 from public.product_variants v
    join public.products p on p.id = v.product_id
    where v.id = i.variant_id and v.active and p.status = 'published'
      and v.retail_price_cents > 0
  )
  limit 1;
  if v_unavailable is not null then
    raise exception 'unavailable_variant' using errcode = '22023',
      detail = v_unavailable::text;
  end if;
  select coalesce(sum(i.quantity::bigint * v.retail_price_cents), 0), count(*)
  into v_items_cents, v_lines
  from private.parse_quantity_items(p_items, 50) i
  join public.product_variants v on v.id = i.variant_id;
  if v_lines = 0 then
    raise exception 'invalid_items' using errcode = '22023';
  end if;
  if p_fulfillment = 'shipping' then
    v_shipping_cents := case
      when v_rate.free_from_cents is not null and v_items_cents >= v_rate.free_from_cents
        then 0
      else v_rate.price_cents
    end;
  end if;
  if v_items_cents + v_shipping_cents > 2147483647 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;

  -- La cabecera va primero: un reintento simultáneo con la misma clave espera
  -- aquí y, cuando la primera termina, recibe el pedido ya creado.
  insert into public.orders (
    request_id, locale, fulfillment, location_id, items_cents, shipping_cents,
    total_cents, reserved_until
  ) values (
    p_request_id, p_locale, p_fulfillment, v_location, v_items_cents::integer,
    v_shipping_cents, (v_items_cents + v_shipping_cents)::integer,
    now() + make_interval(mins => p_hold_minutes)
  )
  on conflict (request_id) do nothing
  returning * into v_order;
  if v_order.id is null then
    select * into v_order from public.orders o where o.request_id = p_request_id;
    select * into v_attempt from public.order_payment_attempts a
    where a.order_id = v_order.id order by a.created_at desc limit 1;
    return private.web_order_summary(v_order, v_attempt);
  end if;

  insert into public.order_lines (
    order_id, variant_id, sku, brand_name, product_name, size_ml, variant_label,
    quantity, unit_price_cents, line_total_cents
  )
  select v_order.id, v.id, v.sku, b.name, p.name, v.size_ml, v.label,
         i.quantity, v.retail_price_cents, i.quantity * v.retail_price_cents
  from private.parse_quantity_items(p_items, 50) i
  join public.product_variants v on v.id = i.variant_id
  join public.products p on p.id = v.product_id
  join public.brands b on b.id = p.brand_id;

  insert into public.order_contacts (
    order_id, full_name, email, phone, address_line1, address_line2,
    postal_code, city, province, country
  ) values (
    v_order.id, v_name, v_email, v_phone, v_line1, v_line2, v_postal, v_city,
    v_province, case when p_fulfillment = 'shipping' then 'ES' end
  );

  perform private.apply_order_inventory(v_order, 'RESERVATION', null);

  insert into public.order_events (order_id, kind, to_status, detail)
  values (v_order.id, 'created', v_order.status,
          jsonb_build_object('total_cents', v_order.total_cents, 'lines', v_lines,
                             'fulfillment', v_order.fulfillment,
                             'shipping_cents', v_order.shipping_cents,
                             'zone', v_zone,
                             'reserved_until', v_order.reserved_until));
  v_attempt := private.new_payment_attempt(v_order, p_provider);
  return private.web_order_summary(v_order, v_attempt);
end;
$$;

-- ---------------------------------------------------------------------------
-- Copia diaria: las tarifas entran en la lista blanca
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

-- ---------------------------------------------------------------------------
-- Permisos de ejecución
-- ---------------------------------------------------------------------------

revoke execute on function private.shipping_zone(text)
  from public, anon, authenticated, service_role;
revoke execute on function public.admin_save_shipping_rate(text, integer, integer, boolean)
  from public, anon;
grant execute on function public.admin_save_shipping_rate(text, integer, integer, boolean)
  to authenticated;
