-- Envíos multitransportista (docs/PLAN_ENVIOS.md, DECISIONS §171–176).
--
-- El cliente paga el envío según el peso del pedido y el transportista que
-- elige: cada servicio (Sendcloud o un contrato propio sin API) tiene tramos de
-- peso con el coste real sin IVA, guardados en internal; el precio es ese coste
-- con IVA más el recargo del servicio. La base calcula el peso (formatos con su
-- peso de envío y el embalaje) y el precio, al enseñarlo y al crear el pedido.
-- Un formato sin peso no se envía: como sin tarifa activa (§136), no hay
-- valores por defecto ni importes en el código.
--
-- Después del pago: la etiqueta con su coste real, la entrega al transportista
-- (recogida en la tienda o punto de entrega) y el seguimiento, que llega
-- firmado del proveedor y avanza el pedido a «Enviado» y «Completado».

-- ---------------------------------------------------------------------------
-- Cronología del pedido: los pasos del envío
-- ---------------------------------------------------------------------------

alter table public.order_events drop constraint order_events_kind_check;
alter table public.order_events add constraint order_events_kind_check check (kind in (
  'created', 'reservation_released', 'payment_confirmed', 'payment_review',
  'payment_not_paid', 'payment_attempt', 'status_changed',
  'refund_requested', 'refund_succeeded', 'refund_failed',
  'shipment_label', 'shipment_cancelled', 'shipment_handover', 'shipment_status'
));

-- ---------------------------------------------------------------------------
-- Peso de envío de cada formato
-- ---------------------------------------------------------------------------

-- Gramos de una unidad lista para enviar (frasco con su caja). Lo pesa la
-- tienda; null: aún sin pesar, y ese formato no se puede enviar. No es un dato
-- reservado: la tienda lo usa para calcular el envío.
alter table public.product_variants
  add column shipping_weight_g integer
    check (shipping_weight_g between 1 and 30000);

-- ---------------------------------------------------------------------------
-- Zonas: la tarifa plana deja paso al precio por peso
-- ---------------------------------------------------------------------------

-- shipping_rates sigue siendo el interruptor de cada zona («Ofrecer el envío»)
-- y su envío gratis. El precio plano ya no se usa: queda null en las zonas
-- que se guarden desde ahora y se quitará en una migración posterior.
alter table public.shipping_rates alter column price_cents drop not null;
comment on column public.shipping_rates.price_cents is
  'Sin uso desde 20261025120000: el precio sale del peso y del servicio.';

-- ---------------------------------------------------------------------------
-- Ajustes de los envíos: remitente, embalaje y recogidas
-- ---------------------------------------------------------------------------

create table public.shipping_settings (
  id boolean primary key default true check (id),
  -- Remitente de las etiquetas y dirección de las recogidas (la tienda).
  sender_name text not null check (char_length(sender_name) between 1 and 80),
  sender_contact text check (char_length(sender_contact) <= 80),
  address_line1 text not null check (char_length(address_line1) between 1 and 200),
  house_number text check (char_length(house_number) <= 20),
  address_line2 text check (char_length(address_line2) <= 200),
  postal_code text not null check (postal_code ~ '^[0-9]{5}$'),
  city text not null check (char_length(city) between 1 and 120),
  country text not null default 'ES' check (country = 'ES'),
  phone text not null check (phone ~ '^[0-9 +().-]{6,30}$'),
  email text not null check (char_length(email) <= 254
    and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  -- Gramos de la caja y el relleno de cada paquete, que se suman a los formatos.
  packaging_weight_g integer not null check (packaging_weight_g between 0 and 5000),
  -- Más peso que esto no se ofrece con envío (solo recogida en la tienda).
  max_weight_g integer not null default 10000 check (max_weight_g between 500 and 30000),
  -- Medidas de la caja habitual, para cotizar y etiquetar (opcionales).
  parcel_length_cm smallint check (parcel_length_cm between 1 and 200),
  parcel_width_cm smallint check (parcel_width_cm between 1 and 200),
  parcel_height_cm smallint check (parcel_height_cm between 1 and 200),
  -- Franja habitual de las recogidas en la tienda (hora de Madrid).
  pickup_start time not null default '10:00',
  pickup_end time not null default '14:00',
  -- IVA que se suma al coste del transportista (sin IVA) para el precio del
  -- envío; puntos básicos, 2100 = 21 %.
  shipping_vat_bps integer not null default 2100 check (shipping_vat_bps between 0 and 3000),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint pickup_window check (pickup_end > pickup_start)
);

create index shipping_settings_updated_by_idx on public.shipping_settings (updated_by);

alter table public.shipping_settings enable row level security;
revoke all on public.shipping_settings from anon;
revoke insert, update, delete, truncate on public.shipping_settings from authenticated;

create policy "el personal de pedidos lee los ajustes de envío" on public.shipping_settings
  for select to authenticated
  using ((select private.has_permission('orders.view')));

-- ---------------------------------------------------------------------------
-- Servicios de los transportistas y sus tramos de peso
-- ---------------------------------------------------------------------------

create table public.shipping_services (
  id uuid primary key default gen_random_uuid(),
  -- sendcloud: se sincroniza con la plataforma y compra etiquetas por API.
  -- manual: contrato propio sin API; los tramos se escriben en el panel y la
  -- etiqueta se hace en la web del transportista.
  provider text not null check (provider in ('sendcloud', 'manual')),
  -- Código de la opción en Sendcloud (shipping_option_code); en los manuales,
  -- el propio id.
  code text not null check (char_length(code) between 1 and 200),
  carrier_code text not null check (char_length(carrier_code) between 1 and 60),
  carrier_name text not null check (char_length(carrier_name) between 1 and 80),
  -- Nombre que ve el cliente (editable).
  name text not null check (char_length(name) between 1 and 120),
  contract_id integer,
  -- Cómo llega el paquete al transportista según la plataforma.
  first_mile text check (first_mile in ('pickup', 'dropoff', 'pickup_dropoff', 'fulfilment')),
  -- La plataforma dice que admite mercancía peligrosa (ADR); null: no consta.
  dangerous_goods boolean,
  -- Días laborables de entrega que se enseñan al cliente.
  transit_days smallint check (transit_days between 1 and 30),
  -- Céntimos con IVA que se suman al precio (embalaje, gestión…).
  surcharge_cents integer not null default 0 check (surcharge_cents between 0 and 10000),
  -- Cuenta para el envío gratis de la zona.
  free_eligible boolean not null default true,
  zones text[] not null default '{}'
    check (zones <@ array['peninsula', 'baleares']::text[]),
  active boolean not null default false,
  position integer not null default 0,
  -- Manuales: enlace de seguimiento con {tracking} en lugar del número.
  tracking_url_template text check (
    char_length(tracking_url_template) <= 500
    and tracking_url_template ~ '^https://'
    and position('{tracking}' in tracking_url_template) > 0),
  -- Teléfono de recogidas, si el transportista no las admite por API.
  pickup_phone text check (pickup_phone ~ '^[0-9 +().-]{6,30}$'),
  synced_at timestamptz,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, code)
);

create index shipping_services_updated_by_idx on public.shipping_services (updated_by);

create trigger shipping_services_updated_at
  before update on public.shipping_services
  for each row execute function private.set_updated_at();

alter table public.shipping_services enable row level security;
revoke all on public.shipping_services from anon;
revoke insert, update, delete, truncate on public.shipping_services from authenticated;

-- La tienda no lee la tabla: web_shipping_quote da nombre, plazo y precio.
create policy "el personal de pedidos lee los servicios de envío" on public.shipping_services
  for select to authenticated
  using ((select private.has_permission('orders.view')));

-- Coste del transportista sin IVA por zona y tramo de peso (gramos, ambos
-- incluidos). Es un coste: fuera de la API de datos, como los de compra.
create table internal.shipping_service_rates (
  service_id uuid not null references public.shipping_services (id) on delete cascade,
  zone text not null check (zone in ('peninsula', 'baleares')),
  min_weight_g integer not null check (min_weight_g between 1 and 100000),
  max_weight_g integer not null check (max_weight_g between 1 and 100000),
  cost_cents integer not null check (cost_cents between 0 and 100000),
  lead_time_hours integer check (lead_time_hours between 0 and 2000),
  primary key (service_id, zone, min_weight_g),
  constraint weight_range check (max_weight_g >= min_weight_g)
);

-- ---------------------------------------------------------------------------
-- Pedido: el servicio elegido y el peso calculado
-- ---------------------------------------------------------------------------

alter table public.orders
  add column shipping_service_id uuid
    references public.shipping_services (id) on delete set null,
  -- Lo que vio el cliente al pagar («Correos · Paq Estándar»), aunque el
  -- servicio cambie de nombre después.
  add column shipping_service_label text
    check (char_length(shipping_service_label) <= 200),
  add column shipping_weight_g integer check (shipping_weight_g > 0),
  add column shipping_zone text check (shipping_zone in ('peninsula', 'baleares'));

create index orders_shipping_service_idx on public.orders (shipping_service_id);

-- ---------------------------------------------------------------------------
-- Envíos, recogidas y seguimiento
-- ---------------------------------------------------------------------------

create table public.shipment_pickups (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('sendcloud', 'manual')),
  carrier_code text not null check (char_length(carrier_code) between 1 and 60),
  carrier_name text not null check (char_length(carrier_name) between 1 and 80),
  provider_pickup_id text check (char_length(provider_pickup_id) <= 100),
  -- requested: pedida por API; by_phone: pedida por teléfono o en la web del
  -- transportista y apuntada aquí; cancelled.
  status text not null check (status in ('requested', 'by_phone', 'cancelled')),
  window_start timestamptz not null,
  window_end timestamptz not null,
  parcels integer not null check (parcels between 1 and 500),
  total_weight_g integer not null check (total_weight_g between 1 and 5000000),
  note text check (char_length(note) <= 300),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint pickup_window check (window_end > window_start)
);

create index shipment_pickups_created_by_idx on public.shipment_pickups (created_by);
create index shipment_pickups_window_idx on public.shipment_pickups (window_start desc);

create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  service_id uuid references public.shipping_services (id) on delete set null,
  provider text not null check (provider in ('sendcloud', 'manual')),
  carrier_code text not null check (char_length(carrier_code) between 1 and 60),
  carrier_name text not null check (char_length(carrier_name) between 1 and 80),
  service_name text not null check (char_length(service_name) between 1 and 120),
  status text not null default 'label_created' check (status in (
    'label_created', 'in_transit', 'out_for_delivery', 'at_pickup_point',
    'delivered', 'exception', 'returned', 'cancelled'
  )),
  provider_shipment_id text check (char_length(provider_shipment_id) <= 100),
  provider_parcel_id text check (char_length(provider_parcel_id) <= 100),
  external_reference text check (char_length(external_reference) <= 100),
  tracking_number text check (char_length(tracking_number) <= 120),
  tracking_url text check (char_length(tracking_url) <= 1000 and tracking_url ~ '^https://'),
  weight_g integer not null check (weight_g between 1 and 100000),
  parcels smallint not null default 1 check (parcels between 1 and 15),
  -- Cómo se entrega al transportista: recogida en la tienda o punto de entrega.
  handover text check (handover in ('pickup', 'dropoff')),
  handover_at timestamptz,
  dropoff_point jsonb check (dropoff_point is null or jsonb_typeof(dropoff_point) = 'object'),
  pickup_id uuid references public.shipment_pickups (id) on delete set null,
  status_message text check (char_length(status_message) <= 300),
  status_at timestamptz,
  delivered_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz
);

-- Una etiqueta viva por pedido; las cancelladas quedan como historial.
create unique index shipments_one_active_per_order
  on public.shipments (order_id) where status <> 'cancelled';
create unique index shipments_provider_parcel
  on public.shipments (provider, provider_parcel_id) where provider_parcel_id is not null;
create index shipments_order_idx on public.shipments (order_id, created_at);
create index shipments_status_idx on public.shipments (status, created_at desc);
create index shipments_service_idx on public.shipments (service_id);
create index shipments_pickup_idx on public.shipments (pickup_id);
create index shipments_created_by_idx on public.shipments (created_by);

create table public.shipment_events (
  id bigint generated always as identity primary key,
  shipment_id uuid not null references public.shipments (id) on delete restrict,
  source text not null check (source in ('sendcloud', 'staff', 'system')),
  status text not null check (status in (
    'label_created', 'in_transit', 'out_for_delivery', 'at_pickup_point',
    'delivered', 'exception', 'returned', 'cancelled'
  )),
  provider_status_id integer,
  message text check (char_length(message) <= 300),
  at timestamptz not null,
  received_at timestamptz not null default now(),
  actor_id uuid references auth.users (id) on delete set null
);

-- El proveedor reintenta los avisos: el mismo estado a la misma hora es uno.
create unique index shipment_events_dedupe
  on public.shipment_events (shipment_id, source, coalesce(provider_status_id, -1), at);
create index shipment_events_actor_idx on public.shipment_events (actor_id);

create trigger shipment_events_append_only
  before update or delete on public.shipment_events
  for each row execute function private.reject_mutation();

alter table public.shipment_pickups enable row level security;
alter table public.shipments enable row level security;
alter table public.shipment_events enable row level security;
revoke all on public.shipment_pickups, public.shipments, public.shipment_events from anon;
revoke insert, update, delete, truncate
  on public.shipment_pickups, public.shipments, public.shipment_events
  from authenticated;

create policy "el personal de pedidos lee las recogidas" on public.shipment_pickups
  for select to authenticated
  using ((select private.has_permission('orders.view')));
create policy "el personal de pedidos lee los envíos" on public.shipments
  for select to authenticated
  using ((select private.has_permission('orders.view')));
create policy "el personal de pedidos lee el seguimiento" on public.shipment_events
  for select to authenticated
  using ((select private.has_permission('orders.view')));

-- Lo que costó la etiqueta (sin IVA), solo con pricing.view_cost.
create table internal.shipment_costs (
  shipment_id uuid primary key references public.shipments (id) on delete cascade,
  cost_cents integer not null check (cost_cents between 0 and 1000000),
  currency text not null default 'EUR' check (currency = 'EUR'),
  -- quote: cotización de la plataforma al crear la etiqueta; manual: escrita.
  source text not null check (source in ('quote', 'manual')),
  recorded_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Precio del envío (mismas reglas que src/modules/shipping/domain/price.ts)
-- ---------------------------------------------------------------------------

-- Coste sin IVA → precio con IVA, redondeado al céntimo hacia arriba, más el
-- recargo del servicio.
create function private.shipping_price(
  p_cost_cents integer,
  p_vat_bps integer,
  p_surcharge_cents integer
)
returns integer
language sql
immutable
set search_path = ''
as $$
  select (ceil(p_cost_cents::numeric * (10000 + p_vat_bps) / 10000)
          + p_surcharge_cents)::integer;
$$;

-- Nombre que ve el cliente: «Correos · Paq Estándar» (sin repetir la marca).
create function private.shipping_service_label(p_carrier text, p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when lower(p_name) like lower(p_carrier) || '%' then p_name
    else p_carrier || ' · ' || p_name
  end;
$$;

-- Peso del pedido en gramos: formatos por su peso de envío más el embalaje.
-- null si falta el peso de algún formato o los ajustes de envío.
create function private.shipping_order_weight(p_items jsonb)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_packaging integer;
  v_missing boolean;
  v_sum bigint;
begin
  select s.packaging_weight_g into v_packaging from public.shipping_settings s;
  if not found then
    return null;
  end if;
  select bool_or(v.shipping_weight_g is null),
         sum(i.quantity::bigint * v.shipping_weight_g)
  into v_missing, v_sum
  from private.parse_quantity_items(p_items, 50) i
  left join public.product_variants v on v.id = i.variant_id;
  if v_missing is null or v_missing or v_sum is null then
    return null;
  end if;
  if v_sum + v_packaging > 1000000 then
    return null;
  end if;
  return (v_sum + v_packaging)::integer;
end;
$$;

-- Servicios que se pueden elegir para una zona y un peso, del más barato al
-- más caro, con su precio con IVA (sin descontar el envío gratis).
create function private.shipping_options(p_zone text, p_weight_g integer)
returns table (
  service_id uuid,
  label text,
  carrier_name text,
  transit_days smallint,
  price_cents integer,
  free_eligible boolean,
  sort_position integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id,
         private.shipping_service_label(s.carrier_name, s.name),
         s.carrier_name,
         s.transit_days,
         private.shipping_price(r.cost_cents, st.shipping_vat_bps, s.surcharge_cents),
         s.free_eligible,
         s.position
  from public.shipping_services s
  join internal.shipping_service_rates r
    on r.service_id = s.id and r.zone = p_zone
  cross join public.shipping_settings st
  where s.active
    and p_zone = any (s.zones)
    and p_weight_g is not null
    and p_weight_g <= st.max_weight_g
    and p_weight_g between r.min_weight_g and r.max_weight_g
  order by 5, s.position, 2;
$$;

-- Tramos de un servicio y una zona sin huecos raros: ordenados y sin solaparse.
create function private.shipping_rates_overlap(p_service_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from internal.shipping_service_rates a
    join internal.shipping_service_rates b
      on b.service_id = a.service_id and b.zone = a.zone
     and b.min_weight_g > a.min_weight_g
     and b.min_weight_g <= a.max_weight_g
    where a.service_id = p_service_id
  );
$$;

-- Guarda los tramos de un servicio en una zona (sustituye los anteriores).
-- p_rates: [{min_weight_g, max_weight_g, cost_cents, lead_time_hours?}].
create function private.replace_shipping_rates(
  p_service_id uuid,
  p_zone text,
  p_rates jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_zone is null or p_zone not in ('peninsula', 'baleares')
     or jsonb_typeof(p_rates) is distinct from 'array'
     or jsonb_array_length(p_rates) > 200 then
    raise exception 'invalid_rates' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_rates) e
    where jsonb_typeof(e -> 'min_weight_g') is distinct from 'number'
       or jsonb_typeof(e -> 'max_weight_g') is distinct from 'number'
       or jsonb_typeof(e -> 'cost_cents') is distinct from 'number'
       or (e ? 'lead_time_hours' and jsonb_typeof(e -> 'lead_time_hours') not in ('number', 'null'))
       or (e ->> 'min_weight_g')::numeric <> trunc((e ->> 'min_weight_g')::numeric)
       or (e ->> 'max_weight_g')::numeric <> trunc((e ->> 'max_weight_g')::numeric)
       or (e ->> 'cost_cents')::numeric <> trunc((e ->> 'cost_cents')::numeric)
       or (e ->> 'min_weight_g')::numeric not between 1 and 100000
       or (e ->> 'max_weight_g')::numeric not between 1 and 100000
       or (e ->> 'cost_cents')::numeric not between 0 and 100000
  ) then
    raise exception 'invalid_rates' using errcode = '22023';
  end if;
  delete from internal.shipping_service_rates r
  where r.service_id = p_service_id and r.zone = p_zone;
  insert into internal.shipping_service_rates (
    service_id, zone, min_weight_g, max_weight_g, cost_cents, lead_time_hours
  )
  select p_service_id, p_zone, (e ->> 'min_weight_g')::integer,
         (e ->> 'max_weight_g')::integer, (e ->> 'cost_cents')::integer,
         case when jsonb_typeof(e -> 'lead_time_hours') = 'number'
              then least(greatest((e ->> 'lead_time_hours')::numeric, 0), 2000)::integer end
  from jsonb_array_elements(p_rates) e;
  get diagnostics v_count = row_count;
  if private.shipping_rates_overlap(p_service_id) then
    raise exception 'invalid_rates' using errcode = '22023',
      detail = 'overlap';
  end if;
  return v_count;
exception
  when unique_violation or check_violation then
    raise exception 'invalid_rates' using errcode = '22023';
end;
$$;

-- ---------------------------------------------------------------------------
-- Tienda: opciones de envío de una cesta
-- ---------------------------------------------------------------------------

-- Lo que se enseña antes de pagar, para cada zona con «Ofrecer el envío»:
-- {weight_g, zones: [{zone, free_from_cents, options: [{service_id, label,
-- carrier_name, transit_days, price_cents, free_eligible}]}]}. weight_g null:
-- algún formato aún no tiene peso. El importe que cuenta lo vuelve a calcular
-- web_order_create con las mismas reglas.
create function public.web_shipping_quote(p_items jsonb)
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
-- Pedido con el servicio de envío elegido
-- ---------------------------------------------------------------------------

-- Igual que en la cuenta de cliente (20261016120000) con p_shipping_service_id:
-- el servicio que eligió el cliente. Con envío, la base calcula el peso, busca
-- el servicio entre las opciones de la zona y ese peso y cobra su precio (gratis
-- desde free_from_cents de artículos, ya con el descuento, si el servicio
-- cuenta para el envío gratis). El navegador no fija ningún importe.
drop function public.web_order_create(uuid, text, text, uuid, jsonb, jsonb, text, integer, text, uuid);

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
  p_shipping_service_id uuid default null
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
     or p_hold_minutes is null or p_hold_minutes not between 5 and 120 then
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
    discount_code_id, discount_code, discount_cents, total_cents, reserved_until,
    customer_id, shipping_service_id, shipping_service_label, shipping_weight_g,
    shipping_zone
  ) values (
    p_request_id, p_locale, p_fulfillment, v_location, v_items_cents::integer,
    v_shipping_cents, v_code.id, v_code.code, v_discount_cents,
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
                             'discount_cents', v_order.discount_cents,
                             'zone', v_zone,
                             'with_account', p_customer_id is not null,
                             'reserved_until', v_order.reserved_until));
  v_attempt := private.new_payment_attempt(v_order, p_provider);
  return private.web_order_summary(v_order, v_attempt);
end;
$$;

-- ---------------------------------------------------------------------------
-- Seguimiento que ve el cliente
-- ---------------------------------------------------------------------------

-- La etiqueta viva del pedido, sin costes ni datos del personal.
create function private.order_tracking(p_order_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'carrier_name', s.carrier_name,
    'service_name', s.service_name,
    'tracking_number', s.tracking_number,
    'tracking_url', s.tracking_url,
    'status', s.status,
    'delivered_at', s.delivered_at
  )
  from public.shipments s
  where s.order_id = p_order_id and s.status <> 'cancelled'
  order by s.created_at desc
  limit 1;
$$;

-- Estado del pedido sin datos personales (igual que en 20261015120000) con el
-- servicio elegido y el seguimiento.
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
      and v_order.reserved_until > now(),
    'shipping_service_label', v_order.shipping_service_label,
    'shipment', private.order_tracking(v_order.id)
  );
end;
$$;

-- Pedido de la cuenta de cliente (igual que en 20261016120000) con el servicio
-- elegido y el seguimiento.
create or replace function public.customer_order(p_number bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'number', o.number,
    'status', o.status,
    'fulfillment', o.fulfillment,
    'items_cents', o.items_cents,
    'shipping_cents', o.shipping_cents,
    'discount_code', o.discount_code,
    'discount_cents', o.discount_cents,
    'total_cents', o.total_cents,
    'created_at', o.created_at,
    'paid_at', o.paid_at,
    'tracking_reference', o.tracking_reference,
    'shipping_service_label', o.shipping_service_label,
    'shipment', private.order_tracking(o.id),
    'refunded_cents', (
      select coalesce(sum(r.amount_cents), 0)::integer
      from public.order_refunds r
      where r.order_id = o.id and r.status = 'succeeded'
    ),
    'contact', jsonb_build_object(
      'full_name', c.full_name, 'email', c.email, 'phone', c.phone
    ),
    'address', case when o.fulfillment = 'shipping' then jsonb_build_object(
      'address_line1', c.address_line1, 'address_line2', c.address_line2,
      'postal_code', c.postal_code, 'city', c.city, 'province', c.province
    ) end,
    'lines', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'brand_name', l.brand_name,
        'product_name', l.product_name,
        'variant_label', l.variant_label,
        'size_ml', l.size_ml,
        'quantity', l.quantity,
        'unit_price_cents', l.unit_price_cents,
        'line_total_cents', l.line_total_cents
      ) order by l.product_name, l.size_ml), '[]'::jsonb)
      from public.order_lines l where l.order_id = o.id
    )
  )
  from public.orders o
  join public.order_contacts c on c.order_id = o.id
  where o.number = p_number
    and o.id in (select private.customer_order_ids());
$$;

-- Correos (igual que en 20261015120000) con el transportista y el enlace de
-- seguimiento de la etiqueta; el número escrito a mano sigue mandando.
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
      'tracking_reference', coalesce(o.tracking_reference, private.order_tracking(o.id) ->> 'tracking_number'),
      'tracking_url', private.order_tracking(o.id) ->> 'tracking_url',
      'carrier_name', private.order_tracking(o.id) ->> 'carrier_name',
      'shipping_service_label', o.shipping_service_label,
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
-- El pedido avanza con el envío
-- ---------------------------------------------------------------------------

-- Lleva un pedido con envío hasta p_target ('processing', 'shipped' o
-- 'completed') con los mismos efectos que los pasos del panel: «Enviado»
-- descuenta las unidades del stock (sale_online) y encola el correo con el
-- seguimiento. Lo usan la entrega en un punto (personal) y el seguimiento del
-- proveedor (sistema, p_actor null). No hace nada si el pedido ya está más
-- adelante, fuera de ese camino o con una devolución abierta.
create function private.shipping_advance_order(
  p_order_id uuid,
  p_target text,
  p_actor uuid,
  p_source text
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_steps text[] := array['paid', 'processing', 'shipped', 'completed'];
  v_target integer := array_position(v_steps, p_target);
  v_from text;
  v_to text;
  v_inventory text;
  v_tracking text;
begin
  if v_target is null or v_target < 2 then
    raise exception 'invalid_transition' using errcode = '22023';
  end if;
  select * into v_order from public.orders o where o.id = p_order_id for update;
  if not found or v_order.fulfillment <> 'shipping' then
    return v_order;
  end if;
  if exists (select 1 from public.order_refunds r
             where r.order_id = v_order.id and r.status in ('requested', 'unknown')) then
    return v_order;
  end if;
  while coalesce(array_position(v_steps, v_order.status), 99) < v_target loop
    v_from := v_order.status;
    v_to := v_steps[array_position(v_steps, v_from) + 1];
    v_inventory := case when v_to = 'shipped' then 'sale_online' else 'none' end;
    if v_inventory = 'sale_online' then
      if v_order.reservation <> 'committed' then
        return v_order;
      end if;
      perform private.apply_order_inventory(v_order, 'SALE_ONLINE', p_actor);
      select s.tracking_number into v_tracking from public.shipments s
      where s.order_id = v_order.id and s.status <> 'cancelled'
      order by s.created_at desc limit 1;
    end if;
    update public.orders
    set status = v_to,
        reservation = case when v_inventory = 'sale_online' then 'consumed' else reservation end,
        tracking_reference = case when v_to = 'shipped'
                                  then coalesce(tracking_reference, v_tracking)
                                  else tracking_reference end,
        revision = revision + 1
    where id = v_order.id
    returning * into v_order;
    insert into public.order_events (order_id, kind, from_status, to_status, actor_id, detail)
    values (v_order.id, 'status_changed', v_from, v_to, p_actor,
            jsonb_strip_nulls(jsonb_build_object(
              'source', p_source,
              'inventory', case when v_inventory <> 'none' then v_inventory end)));
    if p_actor is not null then
      insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
      values (p_actor, 'orders.transition', 'order', v_order.id::text,
              jsonb_build_object('status', v_from),
              jsonb_build_object('status', v_to, 'number', v_order.number,
                                 'source', p_source));
    end if;
  end loop;
  return v_order;
end;
$$;

-- ---------------------------------------------------------------------------
-- Panel → Configuración → Envíos (settings.manage, con MFA)
-- ---------------------------------------------------------------------------

create function public.admin_save_shipping_settings(p_settings jsonb)
returns public.shipping_settings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.shipping_settings;
  v_text text;
begin
  if not private.has_permission('settings.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if jsonb_typeof(p_settings) is distinct from 'object' then
    raise exception 'invalid_settings' using errcode = '22023';
  end if;
  insert into public.shipping_settings (
    id, sender_name, sender_contact, address_line1, house_number, address_line2,
    postal_code, city, phone, email, packaging_weight_g, max_weight_g,
    parcel_length_cm, parcel_width_cm, parcel_height_cm, pickup_start,
    pickup_end, shipping_vat_bps, updated_by
  ) values (
    true,
    btrim(p_settings ->> 'sender_name'),
    nullif(btrim(coalesce(p_settings ->> 'sender_contact', '')), ''),
    btrim(p_settings ->> 'address_line1'),
    nullif(btrim(coalesce(p_settings ->> 'house_number', '')), ''),
    nullif(btrim(coalesce(p_settings ->> 'address_line2', '')), ''),
    btrim(p_settings ->> 'postal_code'),
    btrim(p_settings ->> 'city'),
    btrim(p_settings ->> 'phone'),
    lower(btrim(p_settings ->> 'email')),
    (p_settings ->> 'packaging_weight_g')::integer,
    coalesce((p_settings ->> 'max_weight_g')::integer, 10000),
    (p_settings ->> 'parcel_length_cm')::smallint,
    (p_settings ->> 'parcel_width_cm')::smallint,
    (p_settings ->> 'parcel_height_cm')::smallint,
    coalesce((p_settings ->> 'pickup_start')::time, '10:00'),
    coalesce((p_settings ->> 'pickup_end')::time, '14:00'),
    coalesce((p_settings ->> 'shipping_vat_bps')::integer, 2100),
    (select auth.uid())
  )
  on conflict (id) do update set
    sender_name = excluded.sender_name,
    sender_contact = excluded.sender_contact,
    address_line1 = excluded.address_line1,
    house_number = excluded.house_number,
    address_line2 = excluded.address_line2,
    postal_code = excluded.postal_code,
    city = excluded.city,
    phone = excluded.phone,
    email = excluded.email,
    packaging_weight_g = excluded.packaging_weight_g,
    max_weight_g = excluded.max_weight_g,
    parcel_length_cm = excluded.parcel_length_cm,
    parcel_width_cm = excluded.parcel_width_cm,
    parcel_height_cm = excluded.parcel_height_cm,
    pickup_start = excluded.pickup_start,
    pickup_end = excluded.pickup_end,
    shipping_vat_bps = excluded.shipping_vat_bps,
    updated_by = excluded.updated_by,
    updated_at = now()
  returning * into v_row;
  insert into public.audit_log (actor_id, action, entity, entity_id, after)
  values ((select auth.uid()), 'settings.shipping', 'shipping_settings', 'store',
          jsonb_build_object('packaging_weight_g', v_row.packaging_weight_g,
                             'max_weight_g', v_row.max_weight_g,
                             'shipping_vat_bps', v_row.shipping_vat_bps));
  return v_row;
exception
  when check_violation or not_null_violation or invalid_text_representation
       or invalid_datetime_format or datetime_field_overflow
       or numeric_value_out_of_range then
    raise exception 'invalid_settings' using errcode = '22023';
end;
$$;

-- Zona: «Ofrecer el envío» y desde cuánto es gratis (sustituye a
-- admin_save_shipping_rate, que también fijaba el precio plano).
drop function public.admin_save_shipping_rate(text, integer, integer, boolean);

create function public.admin_save_shipping_zone(
  p_zone text,
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
  if (p_free_from_cents is not null and p_free_from_cents not between 1 and 10000000)
     or p_active is null then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  select * into v_before from public.shipping_rates r where r.zone = p_zone for update;
  insert into public.shipping_rates (zone, price_cents, free_from_cents, active, updated_by)
  values (p_zone, null, p_free_from_cents, p_active, (select auth.uid()))
  on conflict (zone) do update
    set price_cents = null,
        free_from_cents = excluded.free_from_cents,
        active = excluded.active,
        updated_by = excluded.updated_by,
        updated_at = now()
  returning * into v_rate;
  insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
  values ((select auth.uid()), 'settings.shipping_zone', 'shipping_rate', p_zone,
          case when v_before.zone is null then null
               else jsonb_build_object('free_from_cents', v_before.free_from_cents,
                                       'active', v_before.active) end,
          jsonb_build_object('free_from_cents', v_rate.free_from_cents,
                             'active', v_rate.active));
  return v_rate;
end;
$$;

-- Servicios con sus tramos. Los costes (y el precio que sale de ellos) solo con
-- pricing.view_cost; sin él, los tramos llegan sin importes.
create function public.admin_shipping_services()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_costs boolean;
begin
  if not private.has_permission('settings.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  v_costs := private.has_permission('pricing.view_cost');
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id,
      'provider', s.provider,
      'code', s.code,
      'carrier_code', s.carrier_code,
      'carrier_name', s.carrier_name,
      'name', s.name,
      'label', private.shipping_service_label(s.carrier_name, s.name),
      'contract_id', s.contract_id,
      'first_mile', s.first_mile,
      'dangerous_goods', s.dangerous_goods,
      'transit_days', s.transit_days,
      'surcharge_cents', s.surcharge_cents,
      'free_eligible', s.free_eligible,
      'zones', to_jsonb(s.zones),
      'active', s.active,
      'position', s.position,
      'tracking_url_template', s.tracking_url_template,
      'pickup_phone', s.pickup_phone,
      'synced_at', s.synced_at,
      'updated_at', s.updated_at,
      'rates', coalesce((
        select jsonb_agg(jsonb_build_object(
          'zone', r.zone,
          'min_weight_g', r.min_weight_g,
          'max_weight_g', r.max_weight_g,
          'lead_time_hours', r.lead_time_hours,
          'cost_cents', case when v_costs then r.cost_cents end,
          'price_cents', case when v_costs then private.shipping_price(
            r.cost_cents, coalesce(st.shipping_vat_bps, 2100), s.surcharge_cents) end
        ) order by r.zone, r.min_weight_g)
        from internal.shipping_service_rates r
        left join public.shipping_settings st on true
        where r.service_id = s.id
      ), '[]'::jsonb)
    ) order by s.active desc, s.position, s.carrier_name, s.name)
    from public.shipping_services s
  ), '[]'::jsonb);
end;
$$;

-- Sincronización con la plataforma: crea o actualiza sus servicios y sustituye
-- sus tramos por zona. Los que la plataforma ya no ofrece se apagan y pierden
-- los tramos (no se vende lo que no se puede comprar). Lo nuevo entra apagado.
-- p_services: [{code, carrier_code, carrier_name, name, contract_id?,
-- first_mile?, dangerous_goods?, rates: [{zone, min_weight_g, max_weight_g,
-- cost_cents, lead_time_hours?}]}].
create function public.admin_shipping_sync(p_provider text, p_services jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_service public.shipping_services;
  v_zone text;
  v_codes text[] := '{}';
  v_created integer := 0;
  v_updated integer := 0;
  v_disabled integer := 0;
  v_rates integer := 0;
  v_lead integer;
begin
  if not private.has_permission('settings.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_provider is distinct from 'sendcloud'
     or jsonb_typeof(p_services) is distinct from 'array'
     or jsonb_array_length(p_services) > 300 then
    raise exception 'invalid_sync' using errcode = '22023';
  end if;
  for v_item in select e from jsonb_array_elements(p_services) e loop
    if jsonb_typeof(v_item) is distinct from 'object'
       or jsonb_typeof(v_item -> 'rates') is distinct from 'array'
       or coalesce(v_item ->> 'code', '') = '' then
      raise exception 'invalid_sync' using errcode = '22023';
    end if;
    v_codes := v_codes || (v_item ->> 'code');
    select min(nullif(r ->> 'lead_time_hours', '')::numeric)::integer into v_lead
    from jsonb_array_elements(v_item -> 'rates') r
    where jsonb_typeof(r -> 'lead_time_hours') = 'number';
    insert into public.shipping_services as s (
      provider, code, carrier_code, carrier_name, name, contract_id, first_mile,
      dangerous_goods, transit_days, zones, active, synced_at, updated_by
    ) values (
      p_provider,
      v_item ->> 'code',
      v_item ->> 'carrier_code',
      v_item ->> 'carrier_name',
      left(coalesce(nullif(btrim(v_item ->> 'name'), ''), v_item ->> 'code'), 120),
      case when jsonb_typeof(v_item -> 'contract_id') = 'number'
           then (v_item ->> 'contract_id')::integer end,
      nullif(v_item ->> 'first_mile', ''),
      case when jsonb_typeof(v_item -> 'dangerous_goods') = 'boolean'
           then (v_item ->> 'dangerous_goods')::boolean end,
      case when v_lead is not null then least(greatest(ceil(v_lead / 24.0), 1), 30)::smallint end,
      coalesce((select array_agg(distinct r ->> 'zone') from jsonb_array_elements(v_item -> 'rates') r), '{}'),
      false,
      now(),
      (select auth.uid())
    )
    on conflict (provider, code) do update set
      carrier_code = excluded.carrier_code,
      carrier_name = excluded.carrier_name,
      contract_id = excluded.contract_id,
      first_mile = excluded.first_mile,
      dangerous_goods = excluded.dangerous_goods,
      synced_at = now(),
      updated_by = excluded.updated_by
    returning * into v_service;
    if v_service.created_at = v_service.updated_at then
      v_created := v_created + 1;
    else
      v_updated := v_updated + 1;
    end if;
    foreach v_zone in array array['peninsula', 'baleares'] loop
      v_rates := v_rates + private.replace_shipping_rates(
        v_service.id, v_zone,
        coalesce((select jsonb_agg(r) from jsonb_array_elements(v_item -> 'rates') r
                  where r ->> 'zone' = v_zone), '[]'::jsonb));
    end loop;
    -- Una zona que se queda sin tramos sale de las zonas del servicio.
    update public.shipping_services s
    set zones = array(select z from unnest(s.zones) z
                      where exists (select 1 from internal.shipping_service_rates r
                                    where r.service_id = s.id and r.zone = z))
    where s.id = v_service.id;
  end loop;
  with gone as (
    update public.shipping_services s
    set active = false, synced_at = now(), updated_by = (select auth.uid())
    where s.provider = p_provider and not (s.code = any (v_codes))
    returning s.id
  ), cleared as (
    delete from internal.shipping_service_rates r
    using gone where r.service_id = gone.id
  )
  select count(*) into v_disabled from gone;
  insert into public.audit_log (actor_id, action, entity, entity_id, after)
  values ((select auth.uid()), 'settings.shipping_sync', 'shipping_services', p_provider,
          jsonb_build_object('created', v_created, 'updated', v_updated,
                             'disabled', v_disabled, 'rates', v_rates));
  return jsonb_build_object('created', v_created, 'updated', v_updated,
                            'disabled', v_disabled, 'rates', v_rates);
exception
  when check_violation or not_null_violation or invalid_text_representation
       or numeric_value_out_of_range then
    raise exception 'invalid_sync' using errcode = '22023';
end;
$$;

-- Alta de un servicio manual (p_id null) o cambio de cualquier servicio. En los
-- de la plataforma no cambian el transportista ni el código.
create function public.admin_save_shipping_service(p_id uuid, p_service jsonb)
returns public.shipping_services
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before public.shipping_services;
  v_row public.shipping_services;
  v_zones text[];
begin
  if not private.has_permission('settings.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if jsonb_typeof(p_service) is distinct from 'object'
     or jsonb_typeof(p_service -> 'zones') is distinct from 'array' then
    raise exception 'invalid_service' using errcode = '22023';
  end if;
  select coalesce(array_agg(distinct z), '{}') into v_zones
  from jsonb_array_elements_text(p_service -> 'zones') z;
  if p_id is null then
    insert into public.shipping_services (
      provider, code, carrier_code, carrier_name, name, transit_days,
      surcharge_cents, free_eligible, zones, active, position,
      tracking_url_template, pickup_phone, updated_by
    ) values (
      'manual',
      gen_random_uuid()::text,
      lower(regexp_replace(btrim(p_service ->> 'carrier_name'), '[^a-zA-Z0-9]+', '_', 'g')),
      btrim(p_service ->> 'carrier_name'),
      btrim(p_service ->> 'name'),
      (p_service ->> 'transit_days')::smallint,
      coalesce((p_service ->> 'surcharge_cents')::integer, 0),
      coalesce((p_service ->> 'free_eligible')::boolean, true),
      v_zones,
      false,
      coalesce((p_service ->> 'position')::integer, 0),
      nullif(btrim(coalesce(p_service ->> 'tracking_url_template', '')), ''),
      nullif(btrim(coalesce(p_service ->> 'pickup_phone', '')), ''),
      (select auth.uid())
    )
    returning * into v_row;
  else
    select * into v_before from public.shipping_services s where s.id = p_id for update;
    if not found then
      raise exception 'unknown_service' using errcode = '22023';
    end if;
    update public.shipping_services s set
      name = btrim(p_service ->> 'name'),
      carrier_name = case when s.provider = 'manual'
                          then coalesce(nullif(btrim(p_service ->> 'carrier_name'), ''), s.carrier_name)
                          else s.carrier_name end,
      transit_days = (p_service ->> 'transit_days')::smallint,
      surcharge_cents = coalesce((p_service ->> 'surcharge_cents')::integer, 0),
      free_eligible = coalesce((p_service ->> 'free_eligible')::boolean, true),
      zones = v_zones,
      active = coalesce((p_service ->> 'active')::boolean, false),
      position = coalesce((p_service ->> 'position')::integer, s.position),
      tracking_url_template = nullif(btrim(coalesce(p_service ->> 'tracking_url_template', '')), ''),
      pickup_phone = nullif(btrim(coalesce(p_service ->> 'pickup_phone', '')), ''),
      updated_by = (select auth.uid())
    where s.id = p_id
    returning * into v_row;
  end if;
  -- Activo: en alguna zona y con tramos en cada zona en la que se ofrece.
  if v_row.active and (
    cardinality(v_row.zones) = 0
    or exists (select 1 from unnest(v_row.zones) z
               where not exists (select 1 from internal.shipping_service_rates r
                                 where r.service_id = v_row.id and r.zone = z))
  ) then
    raise exception 'service_without_rates' using errcode = '22023';
  end if;
  insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
  values ((select auth.uid()), 'settings.shipping_service', 'shipping_service', v_row.id::text,
          case when v_before.id is null then null
               else jsonb_build_object('name', v_before.name, 'active', v_before.active,
                                       'zones', to_jsonb(v_before.zones),
                                       'surcharge_cents', v_before.surcharge_cents) end,
          jsonb_build_object('name', v_row.name, 'active', v_row.active,
                             'zones', to_jsonb(v_row.zones),
                             'surcharge_cents', v_row.surcharge_cents));
  return v_row;
exception
  when check_violation or not_null_violation or invalid_text_representation
       or numeric_value_out_of_range then
    raise exception 'invalid_service' using errcode = '22023';
end;
$$;

-- Tramos escritos a mano de un servicio manual en una zona. Un servicio activo
-- en esa zona no puede quedarse sin tramos.
create function public.admin_save_shipping_service_rates(
  p_service_id uuid,
  p_zone text,
  p_rates jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_service public.shipping_services;
  v_count integer;
begin
  if not private.has_permission('settings.manage')
     or not private.has_permission('pricing.view_cost') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_service from public.shipping_services s where s.id = p_service_id for update;
  if not found then
    raise exception 'unknown_service' using errcode = '22023';
  end if;
  if v_service.provider <> 'manual' then
    raise exception 'synced_service' using errcode = '22023';
  end if;
  v_count := private.replace_shipping_rates(p_service_id, p_zone, p_rates);
  if v_count = 0 and v_service.active and p_zone = any (v_service.zones) then
    raise exception 'service_without_rates' using errcode = '22023';
  end if;
  insert into public.audit_log (actor_id, action, entity, entity_id, after)
  values ((select auth.uid()), 'settings.shipping_service_rates', 'shipping_service',
          p_service_id::text, jsonb_build_object('zone', p_zone, 'rates', v_count));
  return v_count;
end;
$$;

-- Pesos de envío de varios formatos a la vez (catalog.edit). p_items:
-- [{variant_id, weight_g (null: sin peso)}], hasta 500.
create function public.admin_save_variant_weights(p_items jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not private.has_permission('catalog.edit') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) > 500
     or exists (
       select 1 from jsonb_array_elements(p_items) e
       where jsonb_typeof(e) is distinct from 'object'
          or jsonb_typeof(e -> 'variant_id') is distinct from 'string'
          or jsonb_typeof(e -> 'weight_g') not in ('number', 'null')
          or (jsonb_typeof(e -> 'weight_g') = 'number'
              and ((e ->> 'weight_g')::numeric <> trunc((e ->> 'weight_g')::numeric)
                   or (e ->> 'weight_g')::numeric not between 1 and 30000))
     ) then
    raise exception 'invalid_weights' using errcode = '22023';
  end if;
  update public.product_variants v
  set shipping_weight_g = (e ->> 'weight_g')::integer,
      updated_at = now()
  from jsonb_array_elements(p_items) e
  where v.id = (e ->> 'variant_id')::uuid
    and v.shipping_weight_g is distinct from (e ->> 'weight_g')::integer;
  get diagnostics v_count = row_count;
  insert into public.audit_log (actor_id, action, entity, entity_id, after)
  values ((select auth.uid()), 'catalog.shipping_weights', 'product_variant', null,
          jsonb_build_object('changed', v_count));
  return v_count;
exception
  when invalid_text_representation then
    raise exception 'invalid_weights' using errcode = '22023';
end;
$$;

-- ---------------------------------------------------------------------------
-- Ficha del pedido: etiqueta, entrega al transportista y cancelación
-- (orders.fulfill, con MFA)
-- ---------------------------------------------------------------------------

-- Apunta la etiqueta de un pedido pagado con envío: la que el servidor acaba de
-- comprar en la plataforma (provider sendcloud) o la hecha en la web del
-- transportista (manual). Con el coste real, si se sabe (internal). Un pedido
-- pagado pasa a «Preparando». Solo una etiqueta viva por pedido.
-- p_shipment: {provider, service_id?, carrier_code, carrier_name, service_name,
-- provider_shipment_id?, provider_parcel_id?, external_reference?,
-- tracking_number?, tracking_url?, weight_g, parcels?, cost_cents?}.
create function public.admin_record_shipment(p_order_id uuid, p_shipment jsonb)
returns public.shipments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_order public.orders;
  v_service public.shipping_services;
  v_row public.shipments;
  v_tracking text := nullif(btrim(coalesce(p_shipment ->> 'tracking_number', '')), '');
  v_url text := nullif(btrim(coalesce(p_shipment ->> 'tracking_url', '')), '');
  v_cost integer;
begin
  if not private.has_permission('orders.fulfill') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if jsonb_typeof(p_shipment) is distinct from 'object'
     or coalesce(p_shipment ->> 'provider', '') not in ('sendcloud', 'manual') then
    raise exception 'invalid_shipment' using errcode = '22023';
  end if;
  select * into v_order from public.orders o where o.id = p_order_id for update;
  if not found then
    raise exception 'unknown_order' using errcode = '22023';
  end if;
  if v_order.fulfillment <> 'shipping' or v_order.status not in ('paid', 'processing') then
    raise exception 'shipment_unavailable' using errcode = '55000';
  end if;
  if exists (select 1 from public.order_refunds r
             where r.order_id = v_order.id and r.status in ('requested', 'unknown')) then
    raise exception 'refund_in_progress' using errcode = '55000';
  end if;
  if exists (select 1 from public.shipments s
             where s.order_id = v_order.id and s.status <> 'cancelled') then
    raise exception 'shipment_exists' using errcode = '55000';
  end if;
  if jsonb_typeof(p_shipment -> 'service_id') = 'string' then
    select * into v_service from public.shipping_services s
    where s.id = (p_shipment ->> 'service_id')::uuid;
  end if;
  -- Manual sin enlace: el de la plantilla del servicio.
  if v_url is null and v_tracking is not null and v_service.tracking_url_template is not null then
    v_url := replace(v_service.tracking_url_template, '{tracking}', v_tracking);
  end if;
  if jsonb_typeof(p_shipment -> 'cost_cents') = 'number' then
    v_cost := (p_shipment ->> 'cost_cents')::integer;
  end if;
  insert into public.shipments (
    order_id, service_id, provider, carrier_code, carrier_name, service_name,
    provider_shipment_id, provider_parcel_id, external_reference,
    tracking_number, tracking_url, weight_g, parcels, status_at, created_by
  ) values (
    v_order.id, v_service.id, p_shipment ->> 'provider',
    coalesce(nullif(p_shipment ->> 'carrier_code', ''), v_service.carrier_code),
    coalesce(nullif(p_shipment ->> 'carrier_name', ''), v_service.carrier_name),
    coalesce(nullif(p_shipment ->> 'service_name', ''), v_service.name),
    nullif(p_shipment ->> 'provider_shipment_id', ''),
    nullif(p_shipment ->> 'provider_parcel_id', ''),
    nullif(p_shipment ->> 'external_reference', ''),
    v_tracking, v_url,
    (p_shipment ->> 'weight_g')::integer,
    coalesce((p_shipment ->> 'parcels')::smallint, 1),
    now(), v_actor
  )
  returning * into v_row;
  if v_cost is not null then
    insert into internal.shipment_costs (shipment_id, cost_cents, source)
    values (v_row.id, v_cost,
            case when v_row.provider = 'sendcloud' then 'quote' else 'manual' end);
  end if;
  insert into public.shipment_events (shipment_id, source, status, message, at, actor_id)
  values (v_row.id, 'staff', 'label_created', null, now(), v_actor);
  -- La cronología del pedido no lleva el coste: la ve quien no ve costes.
  insert into public.order_events (order_id, kind, actor_id, detail)
  values (v_order.id, 'shipment_label', v_actor,
          jsonb_strip_nulls(jsonb_build_object(
            'carrier', v_row.carrier_name, 'service', v_row.service_name,
            'tracking', v_row.tracking_number, 'provider', v_row.provider)));
  insert into public.audit_log (actor_id, action, entity, entity_id, after)
  values (v_actor, 'orders.shipment_label', 'order', v_order.id::text,
          jsonb_build_object('number', v_order.number, 'shipment', v_row.id,
                             'provider', v_row.provider));
  perform private.shipping_advance_order(v_order.id, 'processing', v_actor, 'label');
  return v_row;
exception
  when check_violation or not_null_violation or invalid_text_representation
       or numeric_value_out_of_range then
    raise exception 'invalid_shipment' using errcode = '22023';
end;
$$;

-- Cancela una etiqueta que el transportista aún no ha recogido (el servidor ya
-- la canceló en la plataforma, si la tenía). El pedido no cambia de estado.
create function public.admin_cancel_shipment(p_shipment_id uuid)
returns public.shipments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_row public.shipments;
  v_status text;
begin
  if not private.has_permission('orders.fulfill') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_row from public.shipments s where s.id = p_shipment_id for update;
  if not found then
    raise exception 'unknown_shipment' using errcode = '22023';
  end if;
  select o.status into v_status from public.orders o where o.id = v_row.order_id;
  if v_row.status <> 'label_created' or v_status not in ('paid', 'processing') then
    raise exception 'shipment_not_cancellable' using errcode = '55000';
  end if;
  update public.shipments
  set status = 'cancelled', cancelled_at = now(), status_at = now()
  where id = v_row.id
  returning * into v_row;
  insert into public.shipment_events (shipment_id, source, status, at, actor_id)
  values (v_row.id, 'staff', 'cancelled', now(), v_actor);
  insert into public.order_events (order_id, kind, actor_id, detail)
  values (v_row.order_id, 'shipment_cancelled', v_actor,
          jsonb_strip_nulls(jsonb_build_object(
            'carrier', v_row.carrier_name, 'tracking', v_row.tracking_number)));
  insert into public.audit_log (actor_id, action, entity, entity_id, after)
  values (v_actor, 'orders.shipment_cancel', 'shipment', v_row.id::text,
          jsonb_build_object('order', v_row.order_id));
  return v_row;
end;
$$;

-- Recogida en la tienda para una o varias etiquetas del mismo transportista:
-- pedida por API (requested, con su id) o por teléfono (by_phone).
-- p_pickup: {provider, carrier_code, carrier_name, provider_pickup_id?, status,
-- window_start, window_end, note?}.
create function public.admin_record_pickup(p_pickup jsonb, p_shipment_ids uuid[])
returns public.shipment_pickups
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_row public.shipment_pickups;
  v_found integer;
  v_parcels integer;
  v_weight integer;
begin
  if not private.has_permission('orders.fulfill') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if jsonb_typeof(p_pickup) is distinct from 'object'
     or p_shipment_ids is null or cardinality(p_shipment_ids) not between 1 and 200 then
    raise exception 'invalid_pickup' using errcode = '22023';
  end if;
  perform 1 from public.shipments s where s.id = any (p_shipment_ids) order by s.id for update;
  select count(*), sum(s.parcels), sum(s.weight_g)
  into v_found, v_parcels, v_weight
  from public.shipments s
  where s.id = any (p_shipment_ids)
    and s.status = 'label_created'
    and s.carrier_code = p_pickup ->> 'carrier_code'
    and s.handover is null;
  if v_found <> cardinality(p_shipment_ids) then
    raise exception 'pickup_shipments_invalid' using errcode = '22023';
  end if;
  insert into public.shipment_pickups (
    provider, carrier_code, carrier_name, provider_pickup_id, status,
    window_start, window_end, parcels, total_weight_g, note, created_by
  ) values (
    p_pickup ->> 'provider',
    p_pickup ->> 'carrier_code',
    p_pickup ->> 'carrier_name',
    nullif(p_pickup ->> 'provider_pickup_id', ''),
    p_pickup ->> 'status',
    (p_pickup ->> 'window_start')::timestamptz,
    (p_pickup ->> 'window_end')::timestamptz,
    v_parcels, v_weight,
    nullif(btrim(coalesce(p_pickup ->> 'note', '')), ''),
    v_actor
  )
  returning * into v_row;
  update public.shipments s
  set handover = 'pickup', pickup_id = v_row.id
  where s.id = any (p_shipment_ids);
  insert into public.order_events (order_id, kind, actor_id, detail)
  select s.order_id, 'shipment_handover', v_actor,
         jsonb_build_object('mode', 'pickup', 'carrier', s.carrier_name,
                            'window_start', v_row.window_start,
                            'window_end', v_row.window_end,
                            'by_phone', v_row.status = 'by_phone')
  from public.shipments s where s.id = any (p_shipment_ids);
  insert into public.audit_log (actor_id, action, entity, entity_id, after)
  values (v_actor, 'orders.shipment_pickup', 'shipment_pickup', v_row.id::text,
          jsonb_build_object('carrier', v_row.carrier_code, 'parcels', v_row.parcels,
                             'status', v_row.status));
  return v_row;
exception
  when check_violation or not_null_violation or invalid_text_representation
       or invalid_datetime_format or datetime_field_overflow then
    raise exception 'invalid_pickup' using errcode = '22023';
end;
$$;

-- El paquete se ha dejado en un punto de entrega del transportista: queda en
-- sus manos, así que el pedido pasa a «Enviado» (descuenta el stock y avisa al
-- cliente con el seguimiento). p_point: {name?, address?, id?}.
create function public.admin_record_dropoff(p_shipment_id uuid, p_point jsonb default null)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_row public.shipments;
  v_order public.orders;
  v_point jsonb;
begin
  if not private.has_permission('orders.fulfill') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_point is not null and (
    jsonb_typeof(p_point) is distinct from 'object'
    or char_length(coalesce(p_point ->> 'name', '')) > 120
    or char_length(coalesce(p_point ->> 'address', '')) > 200
    or char_length(coalesce(p_point ->> 'id', '')) > 60
  ) then
    raise exception 'invalid_point' using errcode = '22023';
  end if;
  select * into v_row from public.shipments s where s.id = p_shipment_id for update;
  if not found then
    raise exception 'unknown_shipment' using errcode = '22023';
  end if;
  select * into v_order from public.orders o where o.id = v_row.order_id;
  if v_row.status <> 'label_created' or v_order.status not in ('paid', 'processing') then
    raise exception 'shipment_not_pending' using errcode = '55000';
  end if;
  if exists (select 1 from public.order_refunds r
             where r.order_id = v_order.id and r.status in ('requested', 'unknown')) then
    raise exception 'refund_in_progress' using errcode = '55000';
  end if;
  if p_point is not null then
    v_point := jsonb_strip_nulls(jsonb_build_object(
      'name', nullif(p_point ->> 'name', ''),
      'address', nullif(p_point ->> 'address', ''),
      'id', nullif(p_point ->> 'id', '')));
  end if;
  update public.shipments
  set handover = 'dropoff', handover_at = now(), dropoff_point = v_point,
      pickup_id = null
  where id = v_row.id
  returning * into v_row;
  insert into public.order_events (order_id, kind, actor_id, detail)
  values (v_row.order_id, 'shipment_handover', v_actor,
          jsonb_strip_nulls(jsonb_build_object(
            'mode', 'dropoff', 'carrier', v_row.carrier_name,
            'point', v_point ->> 'name')));
  return private.shipping_advance_order(v_row.order_id, 'shipped', v_actor, 'dropoff');
end;
$$;

-- Coste real de las etiquetas de un pedido (pricing.view_cost).
create function public.admin_shipment_costs(p_order_id uuid)
returns table (shipment_id uuid, cost_cents integer, source text, recorded_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('pricing.view_cost') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select c.shipment_id, c.cost_cents, c.source, c.recorded_at
    from internal.shipment_costs c
    join public.shipments s on s.id = c.shipment_id
    where s.order_id = p_order_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Seguimiento del proveedor (solo el servidor, tras comprobar la firma)
-- ---------------------------------------------------------------------------

-- Un aviso de estado de un paquete. Idempotente: el mismo estado a la misma
-- hora no se repite. Los avisos llegan desordenados: el estado del envío es el
-- del aviso más reciente. En camino, en reparto o en un punto → el pedido pasa
-- a «Enviado»; entregado → «Completado». Un paquete que no es de la tienda se
-- ignora ('known': false).
create function public.web_shipment_event(
  p_provider text,
  p_parcel_id text,
  p_status text,
  p_provider_status_id integer,
  p_message text,
  p_at timestamptz,
  p_tracking_number text default null,
  p_tracking_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.shipments;
  v_order public.orders;
  v_inserted boolean;
  v_newer boolean;
  v_url text := case when p_tracking_url ~ '^https://' and char_length(p_tracking_url) <= 1000
                     then p_tracking_url end;
begin
  if not private.is_service_role() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_provider is distinct from 'sendcloud' or coalesce(p_parcel_id, '') = ''
     or p_at is null or p_status is null or p_status not in (
       'label_created', 'in_transit', 'out_for_delivery', 'at_pickup_point',
       'delivered', 'exception', 'returned', 'cancelled') then
    raise exception 'invalid_event' using errcode = '22023';
  end if;
  select * into v_row from public.shipments s
  where s.provider = p_provider and s.provider_parcel_id = p_parcel_id
  for update;
  if not found then
    return jsonb_build_object('known', false);
  end if;
  insert into public.shipment_events (
    shipment_id, source, status, provider_status_id, message, at
  ) values (
    v_row.id, 'sendcloud', p_status, p_provider_status_id, left(p_message, 300), p_at
  )
  on conflict do nothing;
  v_inserted := found;
  v_newer := v_inserted and (v_row.status_at is null or p_at >= v_row.status_at);
  if v_newer and v_row.status <> 'cancelled' then
    update public.shipments
    set status = p_status,
        status_message = left(p_message, 300),
        status_at = p_at,
        delivered_at = case when p_status = 'delivered' then coalesce(delivered_at, p_at) else delivered_at end,
        tracking_number = coalesce(tracking_number, nullif(left(p_tracking_number, 120), '')),
        tracking_url = coalesce(tracking_url, v_url),
        handover_at = case when p_status in ('in_transit', 'out_for_delivery', 'at_pickup_point', 'delivered')
                           then coalesce(handover_at, p_at) else handover_at end
    where id = v_row.id
    returning * into v_row;
  end if;
  if v_inserted and v_row.status <> 'cancelled' then
    if p_status = 'delivered' then
      v_order := private.shipping_advance_order(v_row.order_id, 'completed', null, 'carrier');
    elsif p_status in ('in_transit', 'out_for_delivery', 'at_pickup_point') then
      v_order := private.shipping_advance_order(v_row.order_id, 'shipped', null, 'carrier');
    end if;
    if v_newer and p_status in ('exception', 'returned') then
      insert into public.order_events (order_id, kind, detail)
      values (v_row.order_id, 'shipment_status',
              jsonb_build_object('status', p_status, 'carrier', v_row.carrier_name,
                                 'message', left(p_message, 300)));
    end if;
  end if;
  return jsonb_build_object(
    'known', true,
    'recorded', v_inserted,
    'status', v_row.status,
    'order_status', coalesce(v_order.status,
      (select o.status from public.orders o where o.id = v_row.order_id))
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Copia diaria: las tablas nuevas entran en la lista blanca
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
    'public.discount_codes',
    'public.brands',
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
  private.shipping_price(integer, integer, integer),
  private.shipping_service_label(text, text),
  private.shipping_order_weight(jsonb),
  private.shipping_options(text, integer),
  private.shipping_rates_overlap(uuid),
  private.replace_shipping_rates(uuid, text, jsonb),
  private.order_tracking(uuid),
  private.shipping_advance_order(uuid, text, uuid, text)
  from public, anon, authenticated, service_role;

-- La tienda pregunta las opciones de su cesta (con o sin sesión).
revoke execute on function public.web_shipping_quote(jsonb) from public;
grant execute on function public.web_shipping_quote(jsonb)
  to anon, authenticated, service_role;

-- Solo el servidor con la clave privilegiada.
revoke execute on function
  public.web_order_create(uuid, text, text, uuid, jsonb, jsonb, text, integer, text, uuid, uuid),
  public.web_shipment_event(text, text, text, integer, text, timestamptz, text, text)
  from public, anon, authenticated;
grant execute on function
  public.web_order_create(uuid, text, text, uuid, jsonb, jsonb, text, integer, text, uuid, uuid),
  public.web_shipment_event(text, text, text, integer, text, timestamptz, text, text)
  to service_role;

-- Panel: comprueban permiso y MFA dentro.
revoke execute on function
  public.admin_save_shipping_settings(jsonb),
  public.admin_save_shipping_zone(text, integer, boolean),
  public.admin_shipping_services(),
  public.admin_shipping_sync(text, jsonb),
  public.admin_save_shipping_service(uuid, jsonb),
  public.admin_save_shipping_service_rates(uuid, text, jsonb),
  public.admin_save_variant_weights(jsonb),
  public.admin_record_shipment(uuid, jsonb),
  public.admin_cancel_shipment(uuid),
  public.admin_record_pickup(jsonb, uuid[]),
  public.admin_record_dropoff(uuid, jsonb),
  public.admin_shipment_costs(uuid)
  from public, anon;
grant execute on function
  public.admin_save_shipping_settings(jsonb),
  public.admin_save_shipping_zone(text, integer, boolean),
  public.admin_shipping_services(),
  public.admin_shipping_sync(text, jsonb),
  public.admin_save_shipping_service(uuid, jsonb),
  public.admin_save_shipping_service_rates(uuid, text, jsonb),
  public.admin_save_variant_weights(jsonb),
  public.admin_record_shipment(uuid, jsonb),
  public.admin_cancel_shipment(uuid),
  public.admin_record_pickup(jsonb, uuid[]),
  public.admin_record_dropoff(uuid, jsonb),
  public.admin_shipment_costs(uuid)
  to authenticated;
