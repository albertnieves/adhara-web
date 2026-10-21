-- Códigos de descuento para las campañas del club (Sender): un código por
-- campaña, en porcentaje o en euros, con fechas, usos máximos, un uso por
-- email y compra mínima (DECISIONS §149–152). Los crea el personal con
-- promotions.manage (que exige MFA) y solo la base calcula el descuento al
-- crear el pedido: el navegador manda el texto del código y nada más.
--
-- - El descuento es sobre los artículos, nunca sobre el envío.
-- - El envío gratis «desde» se calcula con los artículos ya descontados.
-- - Cada código puede dejar fuera los formatos rebajados (con precio tachado).
-- - Un código por pedido. El importe queda congelado en el pedido: cambiar o
--   apagar el código después no reescribe pedidos.
--
-- web_order_create gana p_discount_code al final, opcional, como hace la PR
-- #37 con p_customer_id: la segunda que se fusione une los dos parámetros.

-- ---------------------------------------------------------------------------
-- Códigos
-- ---------------------------------------------------------------------------

create table public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  -- En mayúsculas: la tienda acepta «club10» y «CLUB10» por igual.
  code text not null unique check (
    char_length(code) between 4 and 30
    and code ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$'
  ),
  -- Nota interna (campaña, público…); no se enseña en la tienda.
  description text check (char_length(description) <= 200),
  kind text not null check (kind in ('percent', 'amount')),
  -- Porcentaje en puntos básicos (1000 = 10 %), del 1 % al 90 %.
  percent_bp integer check (percent_bp between 100 and 9000),
  -- Importe fijo en céntimos con IVA, de 1 € a 1.000 €.
  amount_cents integer check (amount_cents between 100 and 100000),
  -- Compra mínima de artículos, con IVA y antes del descuento.
  min_items_cents integer check (min_items_cents between 1 and 10000000),
  starts_at timestamptz,
  ends_at timestamptz,
  max_uses integer check (max_uses between 1 and 1000000),
  once_per_email boolean not null default true,
  exclude_sale_items boolean not null default false,
  active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint discount_value check (
    (kind = 'percent' and percent_bp is not null and amount_cents is null)
    or (kind = 'amount' and amount_cents is not null and percent_bp is null)
  ),
  constraint discount_window check (
    starts_at is null or ends_at is null or ends_at > starts_at
  )
);

create index discount_codes_created_by_idx on public.discount_codes (created_by);
create index discount_codes_updated_by_idx on public.discount_codes (updated_by);

create trigger discount_codes_updated_at
  before update on public.discount_codes
  for each row execute function private.set_updated_at();

alter table public.discount_codes enable row level security;
revoke insert, update, delete, truncate on public.discount_codes
  from anon, authenticated;

-- Ni el público ni el resto del personal ven los códigos: la tienda los
-- comprueba en el servidor (web_order_*), uno a uno.
create policy "el personal de promociones lee los códigos" on public.discount_codes
  for select to authenticated
  using ((select private.has_permission('promotions.manage')));

-- ---------------------------------------------------------------------------
-- Pedidos con descuento
-- ---------------------------------------------------------------------------

alter table public.orders
  add column discount_code_id uuid
    references public.discount_codes (id) on delete restrict,
  -- Copia del código tal y como se aplicó.
  add column discount_code text,
  add column discount_cents integer not null default 0
    check (discount_cents >= 0);

alter table public.orders drop constraint total_is_items_plus_shipping;
alter table public.orders
  add constraint total_is_items_plus_shipping_minus_discount
    check (total_cents = items_cents + shipping_cents - discount_cents),
  -- Un descuento nunca deja los artículos a cero: siempre hay algo que cobrar.
  add constraint discount_below_items check (discount_cents < items_cents),
  add constraint discount_has_code check (
    (discount_code_id is null) = (discount_code is null)
    and (discount_code is not null or discount_cents = 0)
  );

create index orders_discount_code_idx on public.orders (discount_code_id)
  where discount_code_id is not null;

-- Usos que cuentan: pedidos vivos o cobrados. No cuentan los cancelados, los
-- devueltos enteros ni los que caducaron sin pagar. Con p_email, solo los de
-- ese email (ya normalizado en order_contacts).
create function private.discount_code_uses(p_code_id uuid, p_email text default null)
returns integer
language sql
stable
set search_path = ''
as $$
  select count(*)::integer
  from public.orders o
  where o.discount_code_id = p_code_id
    and o.status not in ('cancelled', 'refunded')
    and not (o.status = 'pending_payment' and o.reservation = 'released')
    and (p_email is null or exists (
      select 1 from public.order_contacts c
      where c.order_id = o.id and c.email = p_email
    ));
$$;

-- Descuento de un código sobre unos artículos ya validados. Comprueba
-- vigencia, usos, compra mínima y (con p_email) el uso por email; si algo no
-- vale, lanza el motivo para la tienda. Devuelve los céntimos a descontar.
create function private.discount_amount(
  p_code public.discount_codes,
  p_items_cents bigint,
  p_eligible_cents bigint,
  p_email text
)
returns integer
language plpgsql
stable
set search_path = ''
as $$
declare
  v_minimum bigint;
  v_discount bigint;
begin
  if p_code.id is null or not p_code.active then
    raise exception 'discount_invalid' using errcode = '22023';
  end if;
  if p_code.starts_at is not null and p_code.starts_at > now() then
    raise exception 'discount_not_started' using errcode = '22023';
  end if;
  if p_code.ends_at is not null and p_code.ends_at <= now() then
    raise exception 'discount_expired' using errcode = '22023';
  end if;
  if p_code.max_uses is not null
     and private.discount_code_uses(p_code.id) >= p_code.max_uses then
    raise exception 'discount_exhausted' using errcode = '22023';
  end if;
  -- Un importe fijo exige artículos por encima de él: nunca sale gratis.
  v_minimum := greatest(
    coalesce(p_code.min_items_cents, 0),
    case when p_code.kind = 'amount' then p_code.amount_cents + 1 else 0 end
  );
  if p_items_cents < v_minimum then
    raise exception 'discount_minimum' using errcode = '22023',
      detail = v_minimum::text;
  end if;
  if p_eligible_cents <= 0 then
    raise exception 'discount_not_applicable' using errcode = '22023';
  end if;
  if p_email is not null and p_code.once_per_email
     and private.discount_code_uses(p_code.id, p_email) > 0 then
    raise exception 'discount_used' using errcode = '22023';
  end if;
  v_discount := case p_code.kind
    -- Al céntimo más cercano: 10 % de 29,99 € son 3,00 €.
    when 'percent' then round(p_eligible_cents * p_code.percent_bp / 10000.0)
    else least(p_code.amount_cents, p_eligible_cents)
  end;
  return v_discount::integer;
end;
$$;

-- Artículos de la cesta (formatos activos con PVP de perfumes publicados) y
-- la parte a la que se puede aplicar el código: sin los rebajados si el
-- código los excluye.
create function private.discount_base(p_items jsonb, p_exclude_sale boolean)
returns table (items_cents bigint, eligible_cents bigint)
language sql
stable
set search_path = ''
as $$
  select
    coalesce(sum(i.quantity::bigint * v.retail_price_cents), 0),
    coalesce(sum(i.quantity::bigint * v.retail_price_cents) filter (
      where not p_exclude_sale or v.compare_at_price_cents is null
    ), 0)
  from private.parse_quantity_items(p_items, 50) i
  join public.product_variants v on v.id = i.variant_id
  join public.products p on p.id = v.product_id
  where v.active and p.status = 'published' and v.retail_price_cents > 0;
$$;

-- ---------------------------------------------------------------------------
-- La tienda (solo el servidor con la clave privilegiada, DECISIONS §131)
-- ---------------------------------------------------------------------------

-- Lo que enseña «Finalizar compra» al aplicar un código, antes del email: el
-- uso por email se comprueba al crear el pedido. Mismos motivos de error que
-- web_order_create.
create function public.web_order_discount_quote(p_code text, p_items jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_code public.discount_codes;
  v_base record;
  v_discount integer;
begin
  if not private.is_service_role() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_code from public.discount_codes d
  where d.code = upper(btrim(coalesce(p_code, '')));
  select * into v_base from private.discount_base(p_items, coalesce(v_code.exclude_sale_items, false));
  v_discount := private.discount_amount(v_code, v_base.items_cents, v_base.eligible_cents, null);
  return jsonb_build_object(
    'code', v_code.code,
    'kind', v_code.kind,
    'percent_bp', v_code.percent_bp,
    'amount_cents', v_code.amount_cents,
    'exclude_sale_items', v_code.exclude_sale_items,
    'items_cents', v_base.items_cents,
    'eligible_cents', v_base.eligible_cents,
    'discount_cents', v_discount
  );
end;
$$;

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
    'discount_cents', p_order.discount_cents,
    'discount_code', p_order.discount_code,
    'shipping_cents', p_order.shipping_cents,
    'total_cents', p_order.total_cents,
    'currency', p_order.currency,
    'reserved_until', p_order.reserved_until,
    'provider', p_attempt.provider,
    'payment_reference', p_attempt.reference
  );
$$;

-- Igual que en P03 (20261012120000) con p_discount_code: el código que
-- escribió el cliente, o null. Se bloquea su fila antes de contar los usos,
-- así dos pedidos a la vez no pasan de max_uses ni del uso por email.
drop function public.web_order_create(uuid, text, text, uuid, jsonb, jsonb, text, integer);

create function public.web_order_create(
  p_request_id uuid,
  p_locale text,
  p_fulfillment text,
  p_location_id uuid,
  p_items jsonb,
  p_contact jsonb,
  p_provider text,
  p_hold_minutes integer default 30,
  p_discount_code text default null
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
  v_base record;
  v_items_cents bigint;
  v_discount_cents integer := 0;
  v_shipping_cents integer := 0;
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

  -- Código: su fila bloqueada hasta el final, para contar usos sin carreras.
  if v_code_text is not null then
    select * into v_code from public.discount_codes d
    where d.code = v_code_text
    for update;
    select * into v_base from private.discount_base(p_items, coalesce(v_code.exclude_sale_items, false));
    v_discount_cents := private.discount_amount(v_code, v_items_cents, v_base.eligible_cents, v_email);
  end if;

  if p_fulfillment = 'shipping' then
    -- Envío gratis según lo que se paga por los artículos (con el descuento).
    v_shipping_cents := case
      when v_rate.free_from_cents is not null
        and v_items_cents - v_discount_cents >= v_rate.free_from_cents
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
    discount_code_id, discount_code, discount_cents, total_cents, reserved_until
  ) values (
    p_request_id, p_locale, p_fulfillment, v_location, v_items_cents::integer,
    v_shipping_cents, v_code.id, v_code.code, v_discount_cents,
    (v_items_cents + v_shipping_cents - v_discount_cents)::integer,
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
                             'discount_code', v_order.discount_code,
                             'discount_cents', v_order.discount_cents,
                             'zone', v_zone,
                             'reserved_until', v_order.reserved_until));
  v_attempt := private.new_payment_attempt(v_order, p_provider);
  return private.web_order_summary(v_order, v_attempt);
end;
$$;

-- Estado para la página de vuelta del banco (P04), con el descuento.
create or replace function public.web_order_status(p_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  if not private.is_service_role() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_order from public.orders o where o.id = p_order_id;
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'order_id', v_order.id,
    'number', v_order.number,
    'status', v_order.status,
    'fulfillment', v_order.fulfillment,
    'locale', v_order.locale,
    'items_cents', v_order.items_cents,
    'discount_cents', v_order.discount_cents,
    'discount_code', v_order.discount_code,
    'shipping_cents', v_order.shipping_cents,
    'total_cents', v_order.total_cents,
    'currency', v_order.currency,
    'reservation', v_order.reservation,
    'reserved_until', v_order.reserved_until,
    'paid_at', v_order.paid_at,
    'payable', v_order.status = 'pending_payment'
      and v_order.reservation = 'active'
      and v_order.reserved_until > now()
  );
end;
$$;

-- Correos (P06) con el descuento en el resumen.
create or replace function public.web_order_emails_claim(p_limit integer default 10)
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
      'discount_cents', o.discount_cents,
      'discount_code', o.discount_code,
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

-- ---------------------------------------------------------------------------
-- Panel (promotions.manage, que exige MFA)
-- ---------------------------------------------------------------------------

-- Alta (p_id null) o cambio de un código. El texto del código no cambia
-- después de crearlo: los pedidos lo guardan tal cual.
create function public.admin_save_discount_code(
  p_id uuid,
  p_code text,
  p_description text,
  p_kind text,
  p_percent_bp integer,
  p_amount_cents integer,
  p_min_items_cents integer,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_max_uses integer,
  p_once_per_email boolean,
  p_exclude_sale_items boolean,
  p_active boolean
)
returns public.discount_codes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before public.discount_codes;
  v_code public.discount_codes;
  v_text text := upper(btrim(coalesce(p_code, '')));
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
begin
  if not private.has_permission('promotions.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_kind is null or p_kind not in ('percent', 'amount')
     or p_once_per_email is null or p_exclude_sale_items is null or p_active is null then
    raise exception 'invalid_discount' using errcode = '22023';
  end if;
  if p_id is null then
    begin
      insert into public.discount_codes (
        code, description, kind, percent_bp, amount_cents, min_items_cents,
        starts_at, ends_at, max_uses, once_per_email, exclude_sale_items, active,
        created_by, updated_by
      ) values (
        v_text, v_description, p_kind,
        case when p_kind = 'percent' then p_percent_bp end,
        case when p_kind = 'amount' then p_amount_cents end,
        p_min_items_cents, p_starts_at, p_ends_at, p_max_uses, p_once_per_email,
        p_exclude_sale_items, p_active, (select auth.uid()), (select auth.uid())
      )
      returning * into v_code;
    exception
      when unique_violation then
        raise exception 'code_taken' using errcode = '23505';
      when check_violation then
        raise exception 'invalid_discount' using errcode = '22023';
    end;
  else
    select * into v_before from public.discount_codes d where d.id = p_id for update;
    if not found then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
    if v_text <> v_before.code then
      raise exception 'code_immutable' using errcode = '22023';
    end if;
    begin
      update public.discount_codes d
      set description = v_description,
          kind = p_kind,
          percent_bp = case when p_kind = 'percent' then p_percent_bp end,
          amount_cents = case when p_kind = 'amount' then p_amount_cents end,
          min_items_cents = p_min_items_cents,
          starts_at = p_starts_at,
          ends_at = p_ends_at,
          max_uses = p_max_uses,
          once_per_email = p_once_per_email,
          exclude_sale_items = p_exclude_sale_items,
          active = p_active,
          updated_by = (select auth.uid())
      where d.id = p_id
      returning * into v_code;
    exception
      when check_violation then
        raise exception 'invalid_discount' using errcode = '22023';
    end;
  end if;
  insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
  values ((select auth.uid()),
          case when p_id is null then 'promotions.discount_create'
               else 'promotions.discount_update' end,
          'discount_code', v_code.id::text,
          case when p_id is null then null
               else to_jsonb(v_before) - 'created_by' - 'updated_by' - 'created_at' - 'updated_at' end,
          to_jsonb(v_code) - 'created_by' - 'updated_by' - 'created_at' - 'updated_at');
  return v_code;
end;
$$;

-- Lista del panel con sus usos: los que cuentan para los límites, los
-- cobrados y lo descontado en los cobrados. Sin datos de clientes.
create function public.admin_list_discount_codes()
returns table (
  id uuid,
  code text,
  description text,
  kind text,
  percent_bp integer,
  amount_cents integer,
  min_items_cents integer,
  starts_at timestamptz,
  ends_at timestamptz,
  max_uses integer,
  once_per_email boolean,
  exclude_sale_items boolean,
  active boolean,
  created_at timestamptz,
  uses integer,
  paid_uses integer,
  paid_discount_cents bigint
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
  select d.id, d.code, d.description, d.kind, d.percent_bp, d.amount_cents,
         d.min_items_cents, d.starts_at, d.ends_at, d.max_uses, d.once_per_email,
         d.exclude_sale_items, d.active, d.created_at,
         private.discount_code_uses(d.id),
         (select count(*)::integer from public.orders o
          where o.discount_code_id = d.id and o.paid_at is not null),
         (select coalesce(sum(o.discount_cents), 0)::bigint from public.orders o
          where o.discount_code_id = d.id and o.paid_at is not null)
  from public.discount_codes d
  order by d.created_at desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- Copia diaria: los códigos entran en la lista blanca, antes que los pedidos
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
    'public.discount_codes',
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

-- ---------------------------------------------------------------------------
-- Permisos de ejecución
-- ---------------------------------------------------------------------------

revoke execute on function
  private.discount_code_uses(uuid, text),
  private.discount_amount(public.discount_codes, bigint, bigint, text),
  private.discount_base(jsonb, boolean)
  from public, anon, authenticated, service_role;

revoke execute on function
  public.web_order_create(uuid, text, text, uuid, jsonb, jsonb, text, integer, text),
  public.web_order_discount_quote(text, jsonb)
  from public, anon, authenticated;
grant execute on function
  public.web_order_create(uuid, text, text, uuid, jsonb, jsonb, text, integer, text),
  public.web_order_discount_quote(text, jsonb)
  to service_role;

revoke execute on function
  public.admin_save_discount_code(uuid, text, text, text, integer, integer, integer,
    timestamptz, timestamptz, integer, boolean, boolean, boolean),
  public.admin_list_discount_codes()
  from public, anon;
grant execute on function
  public.admin_save_discount_code(uuid, text, text, text, integer, integer, integer,
    timestamptz, timestamptz, integer, boolean, boolean, boolean),
  public.admin_list_discount_codes()
  to authenticated;
