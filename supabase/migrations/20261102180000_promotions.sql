-- Promociones automáticas (DECISIONS §186): un descuento sin código que la
-- tienda aplica sola cuando los artículos llegan a un importe, con fechas y,
-- si se quiere, solo para una casa. Decisiones del usuario (02/11):
--
-- - Tipo: descuento desde un importe (porcentaje o euros), con fechas y
--   opcionalmente de una sola casa.
-- - Con un código: no se suman. Se aplica el que más descuenta; si empatan,
--   la promoción, y el código queda sin gastar.
-- - Los códigos personales de los lotes (§185) siguen sin atarse a su email.
--
-- Como los códigos (§149), solo la base calcula el descuento: la tienda
-- enseña lo que devuelve web_promotions_quote y web_order_create lo vuelve a
-- calcular. Con varias promociones vivas a la vez vale una por pedido, la que
-- más descuenta. El importe queda congelado en el pedido.
--
-- La condición de importe es obligatoria: una promoción sin ella sería una
-- rebaja de precio, que va con el precio tachado y su regla Ómnibus (§16).

-- ---------------------------------------------------------------------------
-- Promociones
-- ---------------------------------------------------------------------------

create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  -- Nombre interno (panel y pedidos del panel); la tienda describe la
  -- promoción con sus reglas, traducidas.
  name text not null check (char_length(name) between 1 and 80),
  kind text not null check (kind in ('percent', 'amount')),
  -- Porcentaje en puntos básicos (1000 = 10 %), del 1 % al 90 %.
  percent_bp integer check (percent_bp between 100 and 9000),
  -- Importe fijo en céntimos con IVA, de 1 € a 1.000 €.
  amount_cents integer check (amount_cents between 100 and 100000),
  -- Desde cuánto en artículos que cuentan (con IVA, antes del descuento).
  min_items_cents integer not null check (min_items_cents between 100 and 10000000),
  -- Solo los perfumes de esta casa cuentan y se descuentan; null: todos.
  brand_id uuid references public.brands (id) on delete restrict,
  -- Los formatos con precio tachado no cuentan ni se descuentan.
  exclude_sale_items boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promotion_value check (
    (kind = 'percent' and percent_bp is not null and amount_cents is null)
    or (kind = 'amount' and amount_cents is not null and percent_bp is null)
  ),
  constraint promotion_window check (
    starts_at is null or ends_at is null or ends_at > starts_at
  ),
  -- Un importe fijo nunca deja a cero lo que cuenta: el mínimo lo supera.
  constraint promotion_amount_below_minimum check (
    kind <> 'amount' or min_items_cents > amount_cents
  )
);

create index promotions_brand_idx on public.promotions (brand_id)
  where brand_id is not null;
create index promotions_created_by_idx on public.promotions (created_by);
create index promotions_updated_by_idx on public.promotions (updated_by);

create trigger promotions_updated_at
  before update on public.promotions
  for each row execute function private.set_updated_at();

alter table public.promotions enable row level security;
revoke all on public.promotions from anon;
revoke insert, update, delete, truncate on public.promotions from authenticated;

-- La tienda no lee la tabla: web_promotions_quote devuelve solo las reglas
-- de las promociones vivas, sin el nombre interno ni quién las creó.
create policy "el personal de promociones lee las promociones" on public.promotions
  for select to authenticated
  using ((select private.has_permission('promotions.manage')));

-- ---------------------------------------------------------------------------
-- Pedidos con promoción
-- ---------------------------------------------------------------------------

alter table public.orders
  add column promotion_id uuid
    references public.promotions (id) on delete restrict,
  -- Copia del nombre interno tal y como se aplicó (solo lo ve el personal).
  add column promotion_name text;

-- Un descuento sale de un código o de una promoción, nunca de los dos.
alter table public.orders drop constraint discount_has_code;
alter table public.orders
  add constraint discount_has_source check (
    (discount_code_id is null) = (discount_code is null)
    and (promotion_id is null) = (promotion_name is null)
    and (discount_code_id is null or promotion_id is null)
    and (discount_cents = 0 or discount_code is not null or promotion_id is not null)
  );

create index orders_promotion_idx on public.orders (promotion_id)
  where promotion_id is not null;

-- ---------------------------------------------------------------------------
-- Cálculo
-- ---------------------------------------------------------------------------

-- Para una cesta, cada promoción viva ahora: lo que cuenta (artículos de su
-- casa, sin los rebajados si los excluye) y lo que descuenta (0 si no llega
-- al mínimo). Mismos artículos que discount_base: formatos activos con PVP
-- de perfumes publicados.
create function private.promotion_quotes(p_items jsonb)
returns table (promotion_id uuid, eligible_cents bigint, discount_cents integer)
language sql
stable
set search_path = ''
as $$
  with items as (
    select i.quantity::bigint * v.retail_price_cents as cents,
           p.brand_id,
           v.compare_at_price_cents is not null as on_sale
    from private.parse_quantity_items(p_items, 50) i
    join public.product_variants v on v.id = i.variant_id
    join public.products p on p.id = v.product_id
    where v.active and p.status = 'published' and v.retail_price_cents > 0
  ), live as (
    select pr.*,
           coalesce((
             select sum(it.cents) from items it
             where (pr.brand_id is null or it.brand_id = pr.brand_id)
               and not (pr.exclude_sale_items and it.on_sale)
           ), 0)::bigint as eligible
    from public.promotions pr
    where pr.active
      and (pr.starts_at is null or pr.starts_at <= now())
      and (pr.ends_at is null or pr.ends_at > now())
  )
  select l.id, l.eligible,
         case
           when l.eligible < l.min_items_cents then 0
           -- Al céntimo más cercano, como los códigos.
           when l.kind = 'percent' then round(l.eligible * l.percent_bp / 10000.0)::integer
           else least(l.amount_cents::bigint, l.eligible)::integer
         end
  from live l;
$$;

-- La promoción que más descuenta en esta cesta (empate: la más antigua), o
-- ninguna fila si no llega a ninguna.
create function private.best_promotion(p_items jsonb)
returns table (promotion_id uuid, name text, discount_cents integer)
language sql
stable
set search_path = ''
as $$
  select q.promotion_id, pr.name, q.discount_cents
  from private.promotion_quotes(p_items) q
  join public.promotions pr on pr.id = q.promotion_id
  where q.discount_cents > 0
  order by q.discount_cents desc, pr.created_at, pr.id
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- La tienda
-- ---------------------------------------------------------------------------

-- Lo que enseñan la cesta y «Finalizar compra»: las promociones vivas (como
-- mucho 10) con sus reglas, cuánto cuenta de esta cesta y cuánto descuenta
-- (0 si aún no llega). Sin nombre interno ni datos del personal; se puede
-- preguntar con o sin sesión, como las opciones de envío.
create function public.web_promotions_quote(p_items jsonb)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(x.promotion order by x.discount desc, x.missing, x.created_at), '[]'::jsonb)
  from (
    select jsonb_build_object(
             'id', pr.id,
             'kind', pr.kind,
             'percent_bp', pr.percent_bp,
             'amount_cents', pr.amount_cents,
             'min_items_cents', pr.min_items_cents,
             'brand_name', b.name,
             'exclude_sale_items', pr.exclude_sale_items,
             'ends_at', pr.ends_at,
             'eligible_cents', q.eligible_cents,
             'discount_cents', q.discount_cents
           ) as promotion,
           q.discount_cents as discount,
           greatest(pr.min_items_cents - q.eligible_cents, 0) as missing,
           pr.created_at
    from private.promotion_quotes(p_items) q
    join public.promotions pr on pr.id = q.promotion_id
    left join public.brands b on b.id = pr.brand_id
    order by q.discount_cents desc, greatest(pr.min_items_cents - q.eligible_cents, 0),
             pr.created_at
    limit 10
  ) x;
$$;

-- Igual que en 20261025120000 con la promoción y p_expected_discount_cents:
-- el descuento que enseñó «Finalizar compra». Se calcula el del código (si
-- lo hay; sus errores siguen igual) y el de la mejor promoción y se aplica el
-- mayor; si empatan, la promoción, y el código no cuenta como usado. Si el
-- descuento sale menor que el que se enseñó (la promoción terminó, el código
-- cambió…), no se crea el pedido: discount_changed, para no cobrar más de lo
-- que vio el cliente.
drop function public.web_order_create(uuid, text, text, uuid, jsonb, jsonb, text, integer, text, uuid, uuid);

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
  p_expected_discount_cents integer default null
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
     or p_expected_discount_cents < 0 then
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
    -- solo en los servicios que cuentan para él.
    v_shipping_cents := case
      when v_free_eligible
        and v_rate.free_from_cents is not null
        and v_items_cents - v_discount_cents >= v_rate.free_from_cents
        then 0
      else v_service_price
    end;
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
    shipping_service_label, shipping_weight_g, shipping_zone
  ) values (
    p_request_id, p_locale, p_fulfillment, v_location, v_items_cents::integer,
    v_shipping_cents, v_code.id, v_code.code, v_promotion_id,
    v_promotion_name, v_discount_cents,
    (v_items_cents + v_shipping_cents - v_discount_cents)::integer,
    now() + make_interval(mins => p_hold_minutes), p_customer_id,
    v_service_id, v_service_label, v_weight, v_zone
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

-- Alta (p_id null) o cambio de una promoción. Los pedidos guardan el importe
-- y una copia del nombre: cambiarla después no los reescribe.
create function public.admin_save_promotion(
  p_id uuid,
  p_name text,
  p_kind text,
  p_percent_bp integer,
  p_amount_cents integer,
  p_min_items_cents integer,
  p_brand_id uuid,
  p_exclude_sale_items boolean,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_active boolean
)
returns public.promotions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before public.promotions;
  v_promotion public.promotions;
  v_name text := btrim(coalesce(p_name, ''));
begin
  if not private.has_permission('promotions.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_kind is null or p_kind not in ('percent', 'amount')
     or p_exclude_sale_items is null or p_active is null then
    raise exception 'invalid_promotion' using errcode = '22023';
  end if;
  if p_brand_id is not null
     and not exists (select 1 from public.brands b where b.id = p_brand_id) then
    raise exception 'unknown_brand' using errcode = '22023';
  end if;
  if p_id is null then
    begin
      insert into public.promotions (
        name, kind, percent_bp, amount_cents, min_items_cents, brand_id,
        exclude_sale_items, starts_at, ends_at, active, created_by, updated_by
      ) values (
        v_name, p_kind,
        case when p_kind = 'percent' then p_percent_bp end,
        case when p_kind = 'amount' then p_amount_cents end,
        p_min_items_cents, p_brand_id, p_exclude_sale_items, p_starts_at,
        p_ends_at, p_active, (select auth.uid()), (select auth.uid())
      )
      returning * into v_promotion;
    exception
      when check_violation or not_null_violation then
        raise exception 'invalid_promotion' using errcode = '22023';
    end;
  else
    select * into v_before from public.promotions pr where pr.id = p_id for update;
    if not found then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
    begin
      update public.promotions pr
      set name = v_name,
          kind = p_kind,
          percent_bp = case when p_kind = 'percent' then p_percent_bp end,
          amount_cents = case when p_kind = 'amount' then p_amount_cents end,
          min_items_cents = p_min_items_cents,
          brand_id = p_brand_id,
          exclude_sale_items = p_exclude_sale_items,
          starts_at = p_starts_at,
          ends_at = p_ends_at,
          active = p_active,
          updated_by = (select auth.uid())
      where pr.id = p_id
      returning * into v_promotion;
    exception
      when check_violation or not_null_violation then
        raise exception 'invalid_promotion' using errcode = '22023';
    end;
  end if;
  insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
  values ((select auth.uid()),
          case when p_id is null then 'promotions.promotion_create'
               else 'promotions.promotion_update' end,
          'promotion', v_promotion.id::text,
          case when p_id is null then null
               else to_jsonb(v_before) - 'created_by' - 'updated_by' - 'created_at' - 'updated_at' end,
          to_jsonb(v_promotion) - 'created_by' - 'updated_by' - 'created_at' - 'updated_at');
  return v_promotion;
end;
$$;

-- Lista del panel con sus usos, como los códigos: pedidos vivos o cobrados
-- (no cuentan los cancelados, los devueltos enteros ni los caducados sin
-- pagar), los cobrados y lo descontado en ellos. Sin datos de clientes.
create function public.admin_list_promotions()
returns table (
  id uuid,
  name text,
  kind text,
  percent_bp integer,
  amount_cents integer,
  min_items_cents integer,
  brand_id uuid,
  brand_name text,
  exclude_sale_items boolean,
  starts_at timestamptz,
  ends_at timestamptz,
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
  select pr.id, pr.name, pr.kind, pr.percent_bp, pr.amount_cents,
         pr.min_items_cents, pr.brand_id, b.name, pr.exclude_sale_items,
         pr.starts_at, pr.ends_at, pr.active, pr.created_at,
         (select count(*)::integer from public.orders o
          where o.promotion_id = pr.id
            and o.status not in ('cancelled', 'refunded')
            and not (o.status = 'pending_payment' and o.reservation = 'released')),
         (select count(*)::integer from public.orders o
          where o.promotion_id = pr.id and o.paid_at is not null),
         (select coalesce(sum(o.discount_cents), 0)::bigint from public.orders o
          where o.promotion_id = pr.id and o.paid_at is not null)
  from public.promotions pr
  left join public.brands b on b.id = pr.brand_id
  order by pr.created_at desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- Copia diaria: las promociones después de las casas y antes que los pedidos
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

revoke execute on function
  private.promotion_quotes(jsonb),
  private.best_promotion(jsonb)
  from public, anon, authenticated, service_role;

-- La tienda pregunta las promociones de su cesta (con o sin sesión).
revoke execute on function public.web_promotions_quote(jsonb) from public;
grant execute on function public.web_promotions_quote(jsonb)
  to anon, authenticated, service_role;

-- Solo el servidor con la clave privilegiada.
revoke execute on function
  public.web_order_create(uuid, text, text, uuid, jsonb, jsonb, text, integer, text, uuid, uuid, integer)
  from public, anon, authenticated;
grant execute on function
  public.web_order_create(uuid, text, text, uuid, jsonb, jsonb, text, integer, text, uuid, uuid, integer)
  to service_role;

revoke execute on function
  public.admin_save_promotion(uuid, text, text, integer, integer, integer, uuid,
    boolean, timestamptz, timestamptz, boolean),
  public.admin_list_promotions()
  from public, anon;
grant execute on function
  public.admin_save_promotion(uuid, text, text, integer, integer, integer, uuid,
    boolean, timestamptz, timestamptz, boolean),
  public.admin_list_promotions()
  to authenticated;
