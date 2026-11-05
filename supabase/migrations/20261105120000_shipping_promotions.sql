-- Envío gratis temporal (DECISIONS §189): una promoción que regala el envío
-- entre dos fechas, desde un importe o en cualquier pedido, en las zonas que
-- se elijan. Es la tercera de las promociones propuestas el 02/11 (§186).
--
-- - Funciona como el envío gratis de la zona (§150, §173), pero con fechas:
--   mira lo que se paga por los artículos, ya con el descuento, y solo vale
--   en los servicios que «cuentan para el envío gratis». Con las dos, vale el
--   mínimo más bajo.
-- - Se suma a un código o a una promoción de descuento: aquellos rebajan los
--   artículos y esta, el envío. Nunca hace el envío más caro.
-- - La fecha de fin es obligatoria: el envío gratis permanente es el de la
--   zona (Envíos → Remitente y zonas), y la tienda puede decir «hasta el…».
--
-- Como el resto de importes, solo la base lo calcula: web_shipping_quote dice
-- a la tienda qué promoción vale en cada zona y web_order_create la vuelve a
-- aplicar. Si el envío sale más caro de lo que enseñó «Finalizar compra» (la
-- promoción terminó mientras se compraba), no se crea el pedido.

-- ---------------------------------------------------------------------------
-- Promociones de envío gratis
-- ---------------------------------------------------------------------------

create table public.shipping_promotions (
  id uuid primary key default gen_random_uuid(),
  -- Nombre interno (panel y pedidos del panel); la tienda la describe con
  -- sus reglas, traducidas.
  name text not null check (char_length(name) between 1 and 80),
  -- Desde cuánto se paga por los artículos (con IVA y ya con el descuento,
  -- como el envío gratis de la zona); 0: cualquier pedido.
  min_items_cents integer not null default 0
    check (min_items_cents between 0 and 10000000),
  zones text[] not null check (
    cardinality(zones) between 1 and 2
    and zones <@ array['peninsula', 'baleares']::text[]
  ),
  starts_at timestamptz,
  ends_at timestamptz not null,
  active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shipping_promotion_window check (
    starts_at is null or ends_at > starts_at
  )
);

create index shipping_promotions_created_by_idx on public.shipping_promotions (created_by);
create index shipping_promotions_updated_by_idx on public.shipping_promotions (updated_by);

create trigger shipping_promotions_updated_at
  before update on public.shipping_promotions
  for each row execute function private.set_updated_at();

alter table public.shipping_promotions enable row level security;
revoke all on public.shipping_promotions from anon;
revoke insert, update, delete, truncate on public.shipping_promotions from authenticated;

-- La tienda no lee la tabla: web_shipping_quote devuelve solo el mínimo y el
-- final de la que vale en cada zona, sin el nombre interno.
create policy "el personal de promociones lee el envío gratis" on public.shipping_promotions
  for select to authenticated
  using ((select private.has_permission('promotions.manage')));

-- ---------------------------------------------------------------------------
-- Pedidos con el envío regalado
-- ---------------------------------------------------------------------------

alter table public.orders
  add column shipping_promotion_id uuid
    references public.shipping_promotions (id) on delete restrict,
  -- Copia del nombre interno tal y como se aplicó (solo lo ve el personal).
  add column shipping_promotion_name text,
  -- Lo que habría costado el servicio elegido sin la promoción (con IVA).
  add column shipping_promotion_cents integer
    check (shipping_promotion_cents > 0);

-- Solo se anota cuando la promoción es la que regala el envío: si el de la
-- zona ya lo hacía gratis, el pedido no la lleva.
alter table public.orders
  add constraint shipping_promotion_complete check (
    (shipping_promotion_id is null) = (shipping_promotion_name is null)
    and (shipping_promotion_id is null) = (shipping_promotion_cents is null)
    and (shipping_promotion_id is null
         or (fulfillment = 'shipping' and shipping_cents = 0))
  );

create index orders_shipping_promotion_idx on public.orders (shipping_promotion_id)
  where shipping_promotion_id is not null;

-- ---------------------------------------------------------------------------
-- Cálculo
-- ---------------------------------------------------------------------------

-- La promoción de envío gratis viva ahora en una zona: la de mínimo más bajo
-- (empate: la que dura más; después, la más antigua), o ninguna fila. Si una
-- cesta no llega a su mínimo, no llega a ninguna otra.
create function private.live_shipping_promotion(p_zone text)
returns table (
  promotion_id uuid,
  name text,
  min_items_cents integer,
  ends_at timestamptz
)
language sql
stable
set search_path = ''
as $$
  select sp.id, sp.name, sp.min_items_cents, sp.ends_at
  from public.shipping_promotions sp
  where sp.active
    and p_zone = any (sp.zones)
    and (sp.starts_at is null or sp.starts_at <= now())
    and sp.ends_at > now()
  order by sp.min_items_cents, sp.ends_at desc, sp.created_at, sp.id
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Tienda: opciones de envío con la promoción
-- ---------------------------------------------------------------------------

-- Igual que en 20261025120000 y, por zona, `promotion`: {min_items_cents,
-- ends_at} de la promoción de envío gratis viva, solo si baja el mínimo de la
-- zona (o la zona no tiene). Con ella, la tienda usa su mínimo en lugar de
-- free_from_cents. Sin nombre interno.
create or replace function public.web_shipping_quote(p_items jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_weight integer := private.shipping_order_weight(p_items);
begin
  return jsonb_build_object(
    'weight_g', v_weight,
    'zones', coalesce((
      select jsonb_agg(jsonb_build_object(
        'zone', z.zone,
        'free_from_cents', z.free_from_cents,
        'promotion', (
          select jsonb_build_object(
            'min_items_cents', sp.min_items_cents,
            'ends_at', sp.ends_at
          )
          from private.live_shipping_promotion(z.zone) sp
          where z.free_from_cents is null
             or sp.min_items_cents < z.free_from_cents
        ),
        'options', coalesce((
          select jsonb_agg(jsonb_build_object(
            'service_id', o.service_id,
            'label', o.label,
            'carrier_name', o.carrier_name,
            'transit_days', o.transit_days,
            'price_cents', o.price_cents,
            'free_eligible', o.free_eligible
          ) order by o.price_cents, o.sort_position, o.label)
          from private.shipping_options(z.zone, v_weight) o
        ), '[]'::jsonb)
      ) order by case z.zone when 'peninsula' then 0 else 1 end)
      from public.shipping_rates z
      where z.active
    ), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Pedido con el envío gratis temporal
-- ---------------------------------------------------------------------------

-- Igual que en 20261102180000 con la promoción de envío gratis y
-- p_expected_shipping_cents: el envío que enseñó «Finalizar compra». Si el
-- envío de la zona no sale gratis, se mira la promoción viva para la zona;
-- con ella, el envío es 0 y el pedido la anota con lo que habría costado. Si
-- el envío sale más caro que el enseñado (la promoción terminó, la tarifa
-- cambió…), no se crea el pedido: shipping_changed.
drop function public.web_order_create(uuid, text, text, uuid, jsonb, jsonb, text, integer, text, uuid, uuid, integer);

create function public.web_order_create(
  p_request_id uuid,
  p_locale text,
  p_fulfillment text,
  p_location_id uuid,
  p_items jsonb,
  p_contact jsonb,
  p_provider text,
  p_hold_minutes integer default 30,
  p_discount_code text default null,
  p_customer_id uuid default null,
  p_shipping_service_id uuid default null,
  p_expected_discount_cents integer default null,
  p_expected_shipping_cents integer default null
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
  v_code public.discount_codes;
  v_promotion_id uuid;
  v_promotion_name text;
  v_promotion_cents integer;
  v_ship_promotion_id uuid;
  v_ship_promotion_name text;
  v_ship_promotion_cents integer;
  v_service_id uuid;
  v_service_label text;
  v_service_price integer;
  v_free_eligible boolean;
  v_base record;
  v_items_cents bigint;
  v_discount_cents integer := 0;
  v_shipping_cents integer := 0;
  v_weight integer;
  v_lines integer;
  v_unavailable uuid;
  v_zone text;
  v_location uuid := p_location_id;
  v_code_text text := nullif(upper(btrim(coalesce(p_discount_code, ''))), '');
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
     or p_hold_minutes is null or p_hold_minutes not between 5 and 120
     or p_expected_discount_cents < 0 or p_expected_shipping_cents < 0 then
    raise exception 'invalid_order' using errcode = '22023';
  end if;
  if p_fulfillment is null or p_fulfillment not in ('shipping', 'click_collect') then
    raise exception 'invalid_order' using errcode = '22023';
  end if;
  if p_customer_id is not null
     and not exists (select 1 from auth.users u where u.id = p_customer_id) then
    raise exception 'unknown_customer' using errcode = '22023';
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
    if p_shipping_service_id is null then
      raise exception 'shipping_service_required' using errcode = '22023';
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

  -- Formatos bloqueados en modo compartido: un cambio de PVP o de peso
  -- simultáneo espera y el total y las líneas salen de los mismos datos.
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

  -- Envío: peso del pedido y precio del servicio elegido para esa zona.
  if p_fulfillment = 'shipping' then
    v_weight := private.shipping_order_weight(p_items);
    if v_weight is null then
      raise exception 'shipping_weight_unknown' using errcode = '22023';
    end if;
    select o.service_id, o.label, o.price_cents, o.free_eligible
    into v_service_id, v_service_label, v_service_price, v_free_eligible
    from private.shipping_options(v_zone, v_weight) o
    where o.service_id = p_shipping_service_id;
    if v_service_id is null then
      raise exception 'shipping_service_unavailable' using errcode = '22023';
    end if;
  end if;

  -- Código: su fila bloqueada hasta el final, para contar usos sin carreras.
  if v_code_text is not null then
    select * into v_code from public.discount_codes d
    where d.code = v_code_text
    for update;
    select * into v_base from private.discount_base(p_items, coalesce(v_code.exclude_sale_items, false));
    v_discount_cents := private.discount_amount(v_code, v_items_cents, v_base.eligible_cents, v_email);
  end if;

  -- Promoción: la que más descuenta; si iguala o supera al código, va ella y
  -- el código no se usa (no se suman, §186).
  select b.promotion_id, b.name, b.discount_cents
  into v_promotion_id, v_promotion_name, v_promotion_cents
  from private.best_promotion(p_items) b;
  if v_promotion_id is not null and v_promotion_cents >= v_discount_cents then
    v_code := null;
    v_discount_cents := v_promotion_cents;
  else
    v_promotion_id := null;
    v_promotion_name := null;
  end if;

  if p_expected_discount_cents is not null
     and v_discount_cents < p_expected_discount_cents then
    raise exception 'discount_changed' using errcode = '22023',
      detail = v_discount_cents::text;
  end if;

  if p_fulfillment = 'shipping' then
    -- Envío gratis según lo que se paga por los artículos (con el descuento),
    -- solo en los servicios que cuentan para él: el de la zona o, si no
    -- llega, el de la promoción de envío gratis viva en la zona (§189), que
    -- se suma al descuento.
    v_shipping_cents := v_service_price;
    if v_free_eligible and v_service_price > 0 then
      if v_rate.free_from_cents is not null
         and v_items_cents - v_discount_cents >= v_rate.free_from_cents then
        v_shipping_cents := 0;
      else
        select sp.promotion_id, sp.name
        into v_ship_promotion_id, v_ship_promotion_name
        from private.live_shipping_promotion(v_zone) sp
        where v_items_cents - v_discount_cents >= sp.min_items_cents;
        if v_ship_promotion_id is not null then
          v_ship_promotion_cents := v_service_price;
          v_shipping_cents := 0;
        end if;
      end if;
    end if;
    if p_expected_shipping_cents is not null
       and v_shipping_cents > p_expected_shipping_cents then
      raise exception 'shipping_changed' using errcode = '22023',
        detail = v_shipping_cents::text;
    end if;
  end if;
  if v_items_cents + v_shipping_cents > 2147483647 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;

  -- La cabecera va primero: un reintento simultáneo con la misma clave espera
  -- aquí y, cuando la primera termina, recibe el pedido ya creado.
  insert into public.orders (
    request_id, locale, fulfillment, location_id, items_cents, shipping_cents,
    discount_code_id, discount_code, promotion_id, promotion_name, discount_cents,
    total_cents, reserved_until, customer_id, shipping_service_id,
    shipping_service_label, shipping_weight_g, shipping_zone,
    shipping_promotion_id, shipping_promotion_name, shipping_promotion_cents
  ) values (
    p_request_id, p_locale, p_fulfillment, v_location, v_items_cents::integer,
    v_shipping_cents, v_code.id, v_code.code, v_promotion_id,
    v_promotion_name, v_discount_cents,
    (v_items_cents + v_shipping_cents - v_discount_cents)::integer,
    now() + make_interval(mins => p_hold_minutes), p_customer_id,
    v_service_id, v_service_label, v_weight, v_zone,
    v_ship_promotion_id, v_ship_promotion_name, v_ship_promotion_cents
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
                             'shipping_service', v_order.shipping_service_label,
                             'weight_g', v_order.shipping_weight_g,
                             'discount_code', v_order.discount_code,
                             'promotion', v_order.promotion_name,
                             'discount_cents', v_order.discount_cents,
                             'shipping_promotion', v_order.shipping_promotion_name,
                             'zone', v_zone,
                             'with_account', p_customer_id is not null,
                             'reserved_until', v_order.reserved_until));
  v_attempt := private.new_payment_attempt(v_order, p_provider);
  return private.web_order_summary(v_order, v_attempt);
end;
$$;

-- ---------------------------------------------------------------------------
-- Panel (promotions.manage, que exige MFA)
-- ---------------------------------------------------------------------------

-- Alta (p_id null) o cambio de una promoción de envío gratis. Los pedidos
-- guardan una copia del nombre y lo que se regaló: cambiarla después no los
-- reescribe. Las zonas se guardan sin repetir, la península primero.
create function public.admin_save_shipping_promotion(
  p_id uuid,
  p_name text,
  p_min_items_cents integer,
  p_zones text[],
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_active boolean
)
returns public.shipping_promotions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before public.shipping_promotions;
  v_promotion public.shipping_promotions;
  v_name text := btrim(coalesce(p_name, ''));
  v_zones text[];
begin
  if not private.has_permission('promotions.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_active is null or p_zones is null or array_position(p_zones, null) is not null then
    raise exception 'invalid_shipping_promotion' using errcode = '22023';
  end if;
  select array_agg(z order by case z when 'peninsula' then 0 else 1 end, z)
  into v_zones
  from (select distinct unnest(p_zones) as z) d;
  if p_id is null then
    begin
      insert into public.shipping_promotions (
        name, min_items_cents, zones, starts_at, ends_at, active,
        created_by, updated_by
      ) values (
        v_name, p_min_items_cents, v_zones, p_starts_at, p_ends_at, p_active,
        (select auth.uid()), (select auth.uid())
      )
      returning * into v_promotion;
    exception
      when check_violation or not_null_violation then
        raise exception 'invalid_shipping_promotion' using errcode = '22023';
    end;
  else
    select * into v_before from public.shipping_promotions sp
    where sp.id = p_id for update;
    if not found then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
    begin
      update public.shipping_promotions sp
      set name = v_name,
          min_items_cents = p_min_items_cents,
          zones = v_zones,
          starts_at = p_starts_at,
          ends_at = p_ends_at,
          active = p_active,
          updated_by = (select auth.uid())
      where sp.id = p_id
      returning * into v_promotion;
    exception
      when check_violation or not_null_violation then
        raise exception 'invalid_shipping_promotion' using errcode = '22023';
    end;
  end if;
  insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
  values ((select auth.uid()),
          case when p_id is null then 'promotions.shipping_promotion_create'
               else 'promotions.shipping_promotion_update' end,
          'shipping_promotion', v_promotion.id::text,
          case when p_id is null then null
               else to_jsonb(v_before) - 'created_by' - 'updated_by' - 'created_at' - 'updated_at' end,
          to_jsonb(v_promotion) - 'created_by' - 'updated_by' - 'created_at' - 'updated_at');
  return v_promotion;
end;
$$;

-- Lista del panel con sus usos, como las promociones de descuento: pedidos
-- vivos o cobrados con el envío regalado por ella (no cuentan los cancelados,
-- los devueltos enteros ni los caducados sin pagar), los cobrados y lo que se
-- dejó de cobrar de envío en ellos. Sin datos de clientes.
create function public.admin_list_shipping_promotions()
returns table (
  id uuid,
  name text,
  min_items_cents integer,
  zones text[],
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean,
  created_at timestamptz,
  uses integer,
  paid_uses integer,
  paid_waived_cents bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('promotions.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  select sp.id, sp.name, sp.min_items_cents, sp.zones, sp.starts_at,
         sp.ends_at, sp.active, sp.created_at,
         (select count(*)::integer from public.orders o
          where o.shipping_promotion_id = sp.id
            and o.status not in ('cancelled', 'refunded')
            and not (o.status = 'pending_payment' and o.reservation = 'released')),
         (select count(*)::integer from public.orders o
          where o.shipping_promotion_id = sp.id and o.paid_at is not null),
         (select coalesce(sum(o.shipping_promotion_cents), 0)::bigint from public.orders o
          where o.shipping_promotion_id = sp.id and o.paid_at is not null)
  from public.shipping_promotions sp
  order by sp.created_at desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- Copia diaria: el envío gratis después de las promociones y antes que los
-- pedidos
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
    'public.shipping_settings',
    'public.shipping_services',
    'public.discount_batches',
    'public.discount_codes',
    'public.discount_code_recipients',
    'public.brands',
    'public.promotions',
    'public.shipping_promotions',
    'public.products',
    'public.product_sources',
    'public.product_translations',
    'public.product_variants',
    'public.product_media',
    'public.product_scent_profiles',
    'public.inventory_levels',
    'public.inventory_movements',
    'public.store_sales',
    'public.store_sale_lines',
    'public.customer_accounts',
    'public.orders',
    'public.order_lines',
    'public.order_contacts',
    'public.order_payment_attempts',
    'public.order_payments',
    'public.order_events',
    'public.order_emails',
    'public.order_refunds',
    'public.shipment_pickups',
    'public.shipments',
    'public.shipment_events',
    'public.conversations',
    'public.conversation_contacts',
    'public.conversation_messages',
    'public.message_emails',
    'public.message_templates',
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
    'internal.shipping_service_rates',
    'internal.shipment_costs',
    'internal.control_tasks',
    'internal.control_costs',
    'internal.control_deliveries',
    'internal.control_owners',
    'internal.control_backups',
    'internal.product_attention_daily',
    'private.store_documents',
    'private.store_revisions',
    'private.conversation_reply_tokens'
  ]) with ordinality as w(qualified, n)
  where to_regclass(w.qualified) is not null;
$f$;

-- ---------------------------------------------------------------------------
-- Permisos de ejecución
-- ---------------------------------------------------------------------------

revoke execute on function private.live_shipping_promotion(text)
  from public, anon, authenticated, service_role;

-- La tienda sigue preguntando las opciones de envío con o sin sesión
-- (create or replace conserva los permisos de 20261025120000).

-- Solo el servidor con la clave privilegiada.
revoke execute on function
  public.web_order_create(uuid, text, text, uuid, jsonb, jsonb, text, integer, text, uuid, uuid, integer, integer)
  from public, anon, authenticated;
grant execute on function
  public.web_order_create(uuid, text, text, uuid, jsonb, jsonb, text, integer, text, uuid, uuid, integer, integer)
  to service_role;

revoke execute on function
  public.admin_save_shipping_promotion(uuid, text, integer, text[], timestamptz,
    timestamptz, boolean),
  public.admin_list_shipping_promotions()
  from public, anon;
grant execute on function
  public.admin_save_shipping_promotion(uuid, text, integer, text[], timestamptz,
    timestamptz, boolean),
  public.admin_list_shipping_promotions()
  to authenticated;
