-- Pedidos de la web (docs/PLAN_PEDIDOS_WEB.md, entrega P02): pedido, líneas
-- con precio congelado, contacto, intentos de pago, notificaciones del banco,
-- cronología y reserva de stock con caducidad.
--
-- Solo el servidor crea pedidos y registra cobros, con la clave privilegiada
-- (funciones web_order_*, DECISIONS §131): el checkout (P03) tras calcular el
-- resumen y el adaptador del TPV (P04) tras verificar la firma. Ni anon ni
-- authenticated pueden llamarlas. El personal lee con orders.view (el contacto
-- exige además customers.view) y cambia el estado con admin_transition_order.
--
-- Estados y transiciones: mismo cuadro que src/modules/orders/domain/status.ts;
-- decisión ante un cobro: misma que domain/payment.ts. tests/unit/orders-sql.test.ts
-- comprueba el cuadro y supabase/tests/database/13_web_orders.test.sql, los casos.

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  -- Número visible para el cliente y el personal.
  number bigint generated always as identity (start with 1001) unique,
  -- Clave de idempotencia del checkout: repetir la petición no crea otro pedido.
  request_id uuid not null unique,
  channel text not null default 'web' check (channel = 'web'),
  locale text not null check (locale in ('es', 'ca', 'en')),
  status text not null default 'pending_payment' check (status in (
    'pending_payment', 'paid', 'processing', 'ready_for_pickup', 'shipped',
    'completed', 'cancelled', 'refunded', 'partially_refunded', 'needs_attention'
  )),
  fulfillment text not null check (fulfillment in ('shipping', 'click_collect')),
  -- Ubicación cuyo stock se reserva (la tienda para Click & Collect).
  location_id uuid not null references public.stock_locations (id) on delete restrict,
  currency text not null default 'EUR' check (currency = 'EUR'),
  -- Céntimos con IVA, calculados en la base con el PVP del momento.
  items_cents integer not null check (items_cents > 0),
  shipping_cents integer not null default 0 check (shipping_cents >= 0),
  total_cents integer not null,
  -- active: retenida hasta reserved_until; committed: pagada, retenida hasta
  -- enviar o entregar; consumed: convertida en venta; released: devuelta.
  reservation text not null default 'active'
    check (reservation in ('active', 'committed', 'consumed', 'released')),
  reserved_until timestamptz not null,
  -- Primer cobro correcto recibido, también si quedó como incidencia.
  received_transaction_id text,
  paid_at timestamptz,
  tracking_reference text check (char_length(tracking_reference) <= 120),
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint total_is_items_plus_shipping check (total_cents = items_cents + shipping_cents)
);

create index orders_status_idx on public.orders (status, created_at desc);
create index orders_location_idx on public.orders (location_id);
create index orders_expiry_idx on public.orders (reserved_until)
  where status = 'pending_payment' and reservation = 'active';

create trigger orders_updated_at
  before update on public.orders
  for each row execute function private.set_updated_at();

-- Instantánea de lo comprado: un cambio posterior del catálogo no la reescribe.
create table public.order_lines (
  order_id uuid not null references public.orders (id) on delete restrict,
  variant_id uuid not null references public.product_variants (id) on delete restrict,
  sku text,
  brand_name text not null,
  product_name text not null,
  size_ml integer,
  variant_label text,
  quantity integer not null check (quantity > 0),
  unit_price_cents integer not null check (unit_price_cents > 0),
  line_total_cents integer not null,
  primary key (order_id, variant_id),
  constraint line_total_is_price_by_quantity
    check (line_total_cents = unit_price_cents * quantity)
);

create index order_lines_variant_idx on public.order_lines (variant_id);

-- Datos personales: solo con orders.view y customers.view.
create table public.order_contacts (
  order_id uuid primary key references public.orders (id) on delete restrict,
  full_name text not null check (char_length(full_name) between 1 and 120),
  email text not null check (
    char_length(email) <= 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ),
  phone text check (phone ~ '^[0-9 +().-]{6,30}$'),
  -- Dirección de envío: se rellenará cuando haya tarifas de envío (P03).
  address_line1 text check (char_length(address_line1) <= 200),
  address_line2 text check (char_length(address_line2) <= 200),
  postal_code text check (char_length(postal_code) <= 20),
  city text check (char_length(city) <= 120),
  province text check (char_length(province) <= 120),
  country text check (country ~ '^[A-Z]{2}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger order_contacts_updated_at
  before update on public.order_contacts
  for each row execute function private.set_updated_at();

-- Cada ida al banco usa una referencia nueva (el TPV no admite repetirla).
create table public.order_payment_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  provider text not null check (provider ~ '^[a-z][a-z0-9_]{1,31}$'),
  -- 12 dígitos: válida como número de pedido de Redsys.
  reference text not null check (reference ~ '^[0-9]{12}$'),
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'EUR' check (currency = 'EUR'),
  -- Hora real (no la de la transacción) para ordenar los intentos.
  created_at timestamptz not null default clock_timestamp(),
  unique (provider, reference)
);

create index order_payment_attempts_order_idx
  on public.order_payment_attempts (order_id, created_at desc);

-- Notificaciones ya verificadas por el adaptador del proveedor, una vez cada una.
-- Nunca datos de tarjeta.
create table public.order_payments (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete restrict,
  attempt_id uuid not null references public.order_payment_attempts (id) on delete restrict,
  provider text not null,
  transaction_id text not null check (char_length(transaction_id) between 1 and 100),
  outcome text not null check (outcome in ('succeeded', 'declined', 'pending')),
  amount_cents integer not null check (amount_cents > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  decision text not null check (decision in ('confirm', 'ignore', 'review')),
  reason text check (reason in (
    'not_paid', 'amount_mismatch', 'currency_mismatch', 'additional_payment',
    'reservation_unavailable', 'unexpected_status'
  )),
  received_at timestamptz not null default now(),
  unique (provider, transaction_id, outcome)
);

create index order_payments_order_idx on public.order_payments (order_id, received_at);
create index order_payments_attempt_idx on public.order_payments (attempt_id);
create index order_payments_review_idx on public.order_payments (order_id)
  where decision = 'review';

-- Cronología del pedido, sin datos personales. actor_id null: el sistema.
create table public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete restrict,
  kind text not null check (kind in (
    'created', 'reservation_released', 'payment_confirmed', 'payment_review',
    'payment_not_paid', 'payment_attempt', 'status_changed'
  )),
  from_status text,
  to_status text,
  detail jsonb,
  actor_id uuid references auth.users (id) on delete set null,
  at timestamptz not null default now()
);

create index order_events_order_idx on public.order_events (order_id, at);
create index order_events_actor_idx on public.order_events (actor_id);

create trigger order_lines_append_only
  before update or delete on public.order_lines
  for each row execute function private.reject_mutation();
create trigger order_payment_attempts_append_only
  before update or delete on public.order_payment_attempts
  for each row execute function private.reject_mutation();
create trigger order_payments_append_only
  before update or delete on public.order_payments
  for each row execute function private.reject_mutation();
create trigger order_events_append_only
  before update or delete on public.order_events
  for each row execute function private.reject_mutation();

-- ---------------------------------------------------------------------------
-- RLS: lectura del personal; nadie escribe directamente
-- ---------------------------------------------------------------------------

alter table public.orders enable row level security;
alter table public.order_lines enable row level security;
alter table public.order_contacts enable row level security;
alter table public.order_payment_attempts enable row level security;
alter table public.order_payments enable row level security;
alter table public.order_events enable row level security;

revoke all on public.orders, public.order_lines, public.order_contacts,
  public.order_payment_attempts, public.order_payments, public.order_events
  from anon;
revoke insert, update, delete, truncate on public.orders, public.order_lines,
  public.order_contacts, public.order_payment_attempts, public.order_payments,
  public.order_events
  from authenticated;

create policy "orders.view lee pedidos" on public.orders
  for select to authenticated using ((select private.has_permission('orders.view')));
create policy "orders.view lee líneas" on public.order_lines
  for select to authenticated using ((select private.has_permission('orders.view')));
create policy "orders.view lee intentos de pago" on public.order_payment_attempts
  for select to authenticated using ((select private.has_permission('orders.view')));
create policy "orders.view lee cobros" on public.order_payments
  for select to authenticated using ((select private.has_permission('orders.view')));
create policy "orders.view lee la cronología" on public.order_events
  for select to authenticated using ((select private.has_permission('orders.view')));
create policy "orders.view y customers.view leen el contacto" on public.order_contacts
  for select to authenticated
  using (
    (select private.has_permission('orders.view'))
    and (select private.has_permission('customers.view'))
  );

-- ---------------------------------------------------------------------------
-- Reglas
-- ---------------------------------------------------------------------------

-- Transiciones permitidas (mismo cuadro y orden que TRANSITIONS en TS).
-- actor: system (cobro o caducidad, nunca el panel) o el permiso necesario.
create function private.order_transition(p_from text, p_to text)
returns table (actor text, inventory text, refund boolean, only_fulfillment text)
language sql
immutable
set search_path = ''
as $$
  select t.actor, t.inventory, t.refund, t.only_fulfillment
  from (values
    ('pending_payment', 'paid', 'system', 'commit_reservation', false, null),
    ('pending_payment', 'cancelled', 'system', 'release_reservation', false, null),
    ('pending_payment', 'needs_attention', 'system', 'none', false, null),
    ('paid', 'processing', 'orders.fulfill', 'none', false, null),
    ('paid', 'cancelled', 'orders.refund', 'release_reservation', true, null),
    ('processing', 'ready_for_pickup', 'orders.fulfill', 'none', false, 'click_collect'),
    ('processing', 'shipped', 'orders.fulfill', 'sale_online', false, 'shipping'),
    ('processing', 'cancelled', 'orders.refund', 'release_reservation', true, null),
    ('ready_for_pickup', 'completed', 'orders.fulfill', 'sale_click_collect', false, 'click_collect'),
    ('ready_for_pickup', 'cancelled', 'orders.refund', 'release_reservation', true, null),
    ('shipped', 'completed', 'orders.fulfill', 'none', false, 'shipping'),
    ('completed', 'partially_refunded', 'orders.refund', 'none', true, null),
    ('completed', 'refunded', 'orders.refund', 'none', true, null),
    ('partially_refunded', 'refunded', 'orders.refund', 'none', true, null),
    ('needs_attention', 'paid', 'orders.refund', 'reserve_and_commit', false, null),
    ('needs_attention', 'cancelled', 'orders.refund', 'release_reservation', true, null)
  ) as t(from_status, to_status, actor, inventory, refund, only_fulfillment)
  where t.from_status = p_from and t.to_status = p_to;
$$;

-- Movimiento de stock de un pedido: los tipos que el panel no registra a mano.
-- Bloquea el nivel y aplica las mismas comprobaciones que
-- admin_record_inventory_movement.
create function private.apply_order_movement(
  p_variant_id uuid,
  p_location_id uuid,
  p_type text,
  p_quantity integer,
  p_reference text,
  p_actor uuid
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_effect record;
  v_level public.inventory_levels;
  v_delta_on_hand integer;
  v_delta_reserved integer;
begin
  if p_type not in ('RESERVATION', 'RESERVATION_RELEASE', 'SALE_ONLINE', 'SALE_CLICK_COLLECT')
     or p_quantity is null or p_quantity <= 0 then
    raise exception 'invalid_movement' using errcode = '22023';
  end if;
  select * into v_effect from private.movement_effect(p_type);
  v_delta_on_hand := v_effect.on_hand * p_quantity;
  v_delta_reserved := v_effect.reserved * p_quantity;

  insert into public.inventory_levels (variant_id, location_id)
  values (p_variant_id, p_location_id)
  on conflict do nothing;
  select * into v_level
  from public.inventory_levels l
  where l.variant_id = p_variant_id and l.location_id = p_location_id
  for update;

  if p_type = 'RESERVATION' and v_level.on_hand - v_level.reserved < p_quantity then
    raise exception 'insufficient_stock' using errcode = '23514',
      detail = p_variant_id::text;
  end if;
  if v_level.on_hand + v_delta_on_hand < 0 then
    raise exception 'negative_on_hand' using errcode = '23514';
  end if;
  if v_level.reserved + v_delta_reserved < 0 then
    raise exception 'insufficient_reserved' using errcode = '23514';
  end if;

  update public.inventory_levels
  set on_hand = on_hand + v_delta_on_hand,
      reserved = reserved + v_delta_reserved,
      updated_at = now()
  where variant_id = p_variant_id and location_id = p_location_id;

  insert into public.inventory_movements (
    variant_id, location_id, type, quantity, delta_on_hand, delta_reserved,
    on_hand_after, reserved_after, reference, actor_id
  ) values (
    p_variant_id, p_location_id, p_type, p_quantity, v_delta_on_hand, v_delta_reserved,
    v_level.on_hand + v_delta_on_hand, v_level.reserved + v_delta_reserved,
    p_reference, p_actor
  );
end;
$$;

-- Aplica un tipo de movimiento a todas las líneas, en orden de formato para que
-- dos pedidos simultáneos bloqueen los niveles en el mismo orden.
create function private.apply_order_inventory(p_order public.orders, p_type text, p_actor uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_line record;
begin
  for v_line in
    select l.variant_id, l.quantity from public.order_lines l
    where l.order_id = p_order.id order by l.variant_id
  loop
    perform private.apply_order_movement(
      v_line.variant_id, p_order.location_id, p_type, v_line.quantity,
      'Pedido web ' || p_order.number, p_actor
    );
  end loop;
end;
$$;

-- Referencia aleatoria de 12 dígitos, única por proveedor. Aleatoria y no
-- correlativa para que dos entornos con el mismo TPV de pruebas no choquen.
create function private.new_payment_attempt(p_order public.orders, p_provider text)
returns public.order_payment_attempts
language plpgsql
set search_path = ''
as $$
declare
  v_attempt public.order_payment_attempts;
begin
  if p_provider is null or p_provider !~ '^[a-z][a-z0-9_]{1,31}$' then
    raise exception 'invalid_provider' using errcode = '22023';
  end if;
  loop
    insert into public.order_payment_attempts (order_id, provider, reference, amount_cents, currency)
    values (
      p_order.id, p_provider,
      lpad(((('x' || encode(extensions.gen_random_bytes(6), 'hex'))::bit(48)::bigint)
            % 1000000000000)::text, 12, '0'),
      p_order.total_cents, p_order.currency
    )
    on conflict (provider, reference) do nothing
    returning * into v_attempt;
    exit when v_attempt.id is not null;
  end loop;
  insert into public.order_events (order_id, kind, detail)
  values (p_order.id, 'payment_attempt',
          jsonb_build_object('provider', p_provider, 'reference', v_attempt.reference));
  return v_attempt;
end;
$$;

create function private.web_order_summary(
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
    'total_cents', p_order.total_cents,
    'currency', p_order.currency,
    'reserved_until', p_order.reserved_until,
    'provider', p_attempt.provider,
    'payment_reference', p_attempt.reference
  );
$$;

-- ---------------------------------------------------------------------------
-- Servidor (clave privilegiada): crear, pagar, reintentar y caducar
-- ---------------------------------------------------------------------------

-- Pedido pendiente de pago con su reserva, todo o nada. El navegador solo
-- elige formatos y cantidades: el precio sale del catálogo publicado.
-- p_items: [{"variant_id": uuid, "quantity": int}, …]
-- p_contact: {"full_name": text, "email": text, "phone": text?}
create function public.web_order_create(
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
  v_items_cents bigint;
  v_lines integer;
  v_unavailable uuid;
  v_name text := btrim(coalesce(p_contact ->> 'full_name', ''));
  v_email text := lower(btrim(coalesce(p_contact ->> 'email', '')));
  v_phone text := nullif(btrim(coalesce(p_contact ->> 'phone', '')), '');
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
  -- Sin zonas ni tarifas reales no se vende con envío (PLAN_PEDIDOS_WEB, P03).
  if p_fulfillment = 'shipping' then
    raise exception 'shipping_unavailable' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.stock_locations l where l.id = p_location_id and l.active
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
  if v_items_cents > 2147483647 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;

  -- La cabecera va primero: un reintento simultáneo con la misma clave espera
  -- aquí y, cuando la primera termina, recibe el pedido ya creado.
  insert into public.orders (
    request_id, locale, fulfillment, location_id, items_cents, shipping_cents,
    total_cents, reserved_until
  ) values (
    p_request_id, p_locale, p_fulfillment, p_location_id, v_items_cents::integer, 0,
    v_items_cents::integer, now() + make_interval(mins => p_hold_minutes)
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

  insert into public.order_contacts (order_id, full_name, email, phone)
  values (v_order.id, v_name, v_email, v_phone);

  perform private.apply_order_inventory(v_order, 'RESERVATION', null);

  insert into public.order_events (order_id, kind, to_status, detail)
  values (v_order.id, 'created', v_order.status,
          jsonb_build_object('total_cents', v_order.total_cents, 'lines', v_lines,
                             'fulfillment', v_order.fulfillment,
                             'reserved_until', v_order.reserved_until));
  v_attempt := private.new_payment_attempt(v_order, p_provider);
  return private.web_order_summary(v_order, v_attempt);
end;
$$;

-- Nueva referencia para volver al banco tras un pago rechazado o abandonado,
-- mientras la reserva siga en pie.
create function public.web_order_new_attempt(p_order_id uuid, p_provider text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  if not private.is_service_role() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_order from public.orders o where o.id = p_order_id for update;
  if not found then
    raise exception 'unknown_order' using errcode = '22023';
  end if;
  if v_order.status <> 'pending_payment' or v_order.reservation <> 'active'
     or v_order.reserved_until <= now() then
    raise exception 'order_not_payable' using errcode = '55000';
  end if;
  return private.web_order_summary(v_order, private.new_payment_attempt(v_order, p_provider));
end;
$$;

-- Notificación del proveedor YA VERIFICADA por su adaptador (firma, comercio,
-- terminal, entorno y tipo de operación). Decide como planCardPaymentConfirmation
-- y aplica el efecto en la misma transacción, bajo el bloqueo del pedido: dos
-- notificaciones simultáneas producen un único efecto.
-- Devuelve {order_id, number, action, reason}; action: confirm, review, ignore o reject.
create function public.web_order_record_payment(
  p_provider text,
  p_reference text,
  p_transaction_id text,
  p_outcome text,
  p_amount_cents integer,
  p_currency text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.order_payment_attempts;
  v_order public.orders;
  v_decision text;
  v_reason text;
  v_to text;
begin
  if not private.is_service_role() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if coalesce(btrim(p_provider), '') = '' or coalesce(btrim(p_reference), '') = ''
     or coalesce(btrim(p_transaction_id), '') = '' or char_length(p_transaction_id) > 100
     or p_outcome is null or p_outcome not in ('succeeded', 'declined', 'pending')
     or p_amount_cents is null or p_amount_cents <= 0
     or p_currency is null or p_currency !~ '^[A-Z]{3}$' then
    return jsonb_build_object('action', 'reject', 'reason', 'invalid_data');
  end if;
  select * into v_attempt from public.order_payment_attempts a
  where a.provider = p_provider and a.reference = p_reference;
  if not found then
    return jsonb_build_object('action', 'reject', 'reason', 'wrong_payment');
  end if;
  select * into v_order from public.orders o where o.id = v_attempt.order_id for update;

  -- Reintento de una notificación ya registrada: sin efectos.
  if exists (
    select 1 from public.order_payments p
    where p.provider = p_provider and p.transaction_id = p_transaction_id
      and p.outcome = p_outcome
  ) then
    return jsonb_build_object('order_id', v_order.id, 'number', v_order.number,
                              'action', 'ignore', 'reason', 'already_recorded');
  end if;

  if p_outcome <> 'succeeded' then
    v_decision := 'ignore'; v_reason := 'not_paid';
  elsif p_currency <> v_order.currency then
    v_decision := 'review'; v_reason := 'currency_mismatch';
  elsif p_amount_cents <> v_order.total_cents then
    v_decision := 'review'; v_reason := 'amount_mismatch';
  elsif v_order.received_transaction_id is not null then
    if v_order.received_transaction_id = p_transaction_id then
      v_decision := 'ignore'; v_reason := 'already_recorded';
    else
      v_decision := 'review'; v_reason := 'additional_payment';
    end if;
  elsif v_order.status <> 'pending_payment' then
    v_decision := 'review'; v_reason := 'unexpected_status';
  elsif v_order.reservation <> 'active' then
    v_decision := 'review'; v_reason := 'reservation_unavailable';
  else
    v_decision := 'confirm';
  end if;

  if v_reason is distinct from 'already_recorded' then
    insert into public.order_payments (
      order_id, attempt_id, provider, transaction_id, outcome, amount_cents,
      currency, decision, reason
    ) values (
      v_order.id, v_attempt.id, p_provider, p_transaction_id, p_outcome,
      p_amount_cents, p_currency, v_decision, v_reason
    );
  end if;

  if v_decision = 'confirm' then
    update public.orders
    set status = 'paid', reservation = 'committed', received_transaction_id = p_transaction_id,
        paid_at = now(), revision = revision + 1
    where id = v_order.id;
    insert into public.order_events (order_id, kind, from_status, to_status, detail)
    values (v_order.id, 'payment_confirmed', v_order.status, 'paid',
            jsonb_build_object('provider', p_provider, 'transaction_id', p_transaction_id,
                               'amount_cents', p_amount_cents));
  elsif v_decision = 'review' then
    -- Un pedido pendiente pasa a la cola de incidencias; uno ya en marcha
    -- conserva su estado logístico y gana la incidencia.
    v_to := case when v_order.status = 'pending_payment' then 'needs_attention'
                 else v_order.status end;
    update public.orders
    set status = v_to,
        received_transaction_id = coalesce(received_transaction_id, p_transaction_id),
        revision = revision + 1
    where id = v_order.id;
    insert into public.order_events (order_id, kind, from_status, to_status, detail)
    values (v_order.id, 'payment_review', v_order.status, v_to,
            jsonb_build_object('reason', v_reason, 'provider', p_provider,
                               'transaction_id', p_transaction_id,
                               'amount_cents', p_amount_cents, 'currency', p_currency));
  elsif v_reason = 'not_paid' then
    insert into public.order_events (order_id, kind, detail)
    values (v_order.id, 'payment_not_paid',
            jsonb_build_object('outcome', p_outcome, 'provider', p_provider,
                               'transaction_id', p_transaction_id));
  end if;

  return jsonb_build_object('order_id', v_order.id, 'number', v_order.number,
                            'action', v_decision, 'reason', v_reason);
end;
$$;

-- Devuelve al stock las reservas caducadas sin pago. El pedido sigue pendiente:
-- un cobro tardío lo lleva a revisión (reservation_unavailable), nunca a pagado.
-- Pensada para una tarea programada frecuente; salta los pedidos bloqueados por
-- un cobro en curso, que la siguiente pasada ya verá pagados.
create function public.web_order_release_expired(p_limit integer default 100)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_count integer := 0;
begin
  if not private.is_service_role() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_limit is null or p_limit not between 1 and 1000 then
    raise exception 'invalid_limit' using errcode = '22023';
  end if;
  for v_order in
    select * from public.orders o
    where o.status = 'pending_payment' and o.reservation = 'active'
      and o.reserved_until < now()
    order by o.reserved_until
    limit p_limit
    for update skip locked
  loop
    perform private.apply_order_inventory(v_order, 'RESERVATION_RELEASE', null);
    update public.orders
    set reservation = 'released', revision = revision + 1
    where id = v_order.id;
    insert into public.order_events (order_id, kind, detail)
    values (v_order.id, 'reservation_released', jsonb_build_object('reason', 'expired'));
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Panel: cambio de estado por el personal
-- ---------------------------------------------------------------------------

-- Aplica una transición del cuadro con su efecto de inventario en la misma
-- transacción. Preparar y entregar exigen orders.fulfill con MFA; resolver una
-- incidencia, orders.refund (que ya exige MFA). Las transiciones con reembolso
-- esperan al adaptador del proveedor (P06): nunca se marca reembolsado solo
-- porque alguien pulse un botón.
create function public.admin_transition_order(
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
-- Copia diaria: los pedidos entran en la lista blanca (tras sus referencias)
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

-- Auxiliares de las funciones security definer: nadie las llama directamente.
revoke execute on function
  private.order_transition(text, text),
  private.apply_order_movement(uuid, uuid, text, integer, text, uuid),
  private.apply_order_inventory(public.orders, text, uuid),
  private.new_payment_attempt(public.orders, text),
  private.web_order_summary(public.orders, public.order_payment_attempts)
  from public, anon, authenticated, service_role;

-- Solo el servidor con la clave privilegiada.
revoke execute on function
  public.web_order_create(uuid, text, text, uuid, jsonb, jsonb, text, integer),
  public.web_order_new_attempt(uuid, text),
  public.web_order_record_payment(text, text, text, text, integer, text),
  public.web_order_release_expired(integer)
  from public, anon, authenticated;
grant execute on function
  public.web_order_create(uuid, text, text, uuid, jsonb, jsonb, text, integer),
  public.web_order_new_attempt(uuid, text),
  public.web_order_record_payment(text, text, text, text, integer, text),
  public.web_order_release_expired(integer)
  to service_role;

revoke execute on function public.admin_transition_order(uuid, text, integer, text)
  from public, anon;
grant execute on function public.admin_transition_order(uuid, text, integer, text)
  to authenticated;
