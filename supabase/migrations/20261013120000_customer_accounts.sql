-- Cuenta de cliente (docs/PLAN_CUENTA_CLIENTE.md, entrega C01; DECISIONS
-- §142–146). Clientes y personal comparten Supabase Auth: desde aquí una
-- sesión ya no significa «personal». La base ya decidía por permiso
-- (has_permission, is_staff) y 18_customer_accounts lo comprueba con una cuenta
-- de cliente. El cliente lee su ficha (RLS) y la guarda con
-- customer_save_account; sus pedidos salen de customer_orders y
-- customer_order, sin datos internos (intentos de pago, cronología, costes).

-- ---------------------------------------------------------------------------
-- Ficha del cliente
-- ---------------------------------------------------------------------------

create table public.customer_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (char_length(full_name) between 1 and 120),
  phone text check (phone ~ '^[0-9 +().-]{6,30}$'),
  locale text not null default 'es' check (locale in ('es', 'ca', 'en')),
  -- Dirección de envío guardada, completa o ninguna. Solo España, como el
  -- envío del checkout (P03).
  address_line1 text check (char_length(address_line1) between 1 and 200),
  address_line2 text check (char_length(address_line2) between 1 and 200),
  postal_code text check (postal_code ~ '^[0-9]{5}$'),
  city text check (char_length(city) between 1 and 120),
  province text check (char_length(province) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint address_complete_or_empty check (
    (address_line1 is null and address_line2 is null and postal_code is null
     and city is null and province is null)
    or (address_line1 is not null and postal_code is not null and city is not null)
  )
);

create trigger customer_accounts_updated_at
  before update on public.customer_accounts
  for each row execute function private.set_updated_at();

alter table public.customer_accounts enable row level security;
revoke all on public.customer_accounts from anon;
revoke insert, update, delete, truncate on public.customer_accounts from authenticated;

create policy "cada cliente lee su ficha" on public.customer_accounts
  for select to authenticated using (user_id = (select auth.uid()));

-- Pedido hecho con la sesión iniciada. Al borrar la cuenta el pedido se
-- conserva (obligación contable) sin el vínculo.
alter table public.orders
  add column customer_id uuid references auth.users (id) on delete set null;
create index orders_customer_idx on public.orders (customer_id);
-- Pedidos de invitado con el email verificado de la cuenta.
create index order_contacts_email_idx on public.order_contacts (email);

-- ---------------------------------------------------------------------------
-- Pedidos de la cuenta
-- ---------------------------------------------------------------------------

-- Los hechos con la sesión iniciada y los de invitado con el email de la
-- cuenta, solo si la cuenta lo tiene verificado (confirmación del alta o
-- Google). Los pendientes de pago cuya reserva ya no está en pie no se
-- enseñan: nunca se pagaron.
create function private.customer_order_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select o.id
  from public.orders o
  join public.order_contacts c on c.order_id = o.id
  join auth.users u on u.id = (select auth.uid())
  where (o.customer_id = u.id
         or (u.email_confirmed_at is not null and c.email = lower(u.email)))
    and (o.status <> 'pending_payment'
         or (o.reservation = 'active' and o.reserved_until > now()));
$$;

-- Lista de pedidos de la cuenta, del más reciente al más antiguo.
create function public.customer_orders()
returns table (
  number bigint,
  status text,
  fulfillment text,
  total_cents integer,
  units integer,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select o.number, o.status, o.fulfillment, o.total_cents,
         (select coalesce(sum(l.quantity), 0)::integer
          from public.order_lines l where l.order_id = o.id),
         o.created_at
  from public.orders o
  where o.id in (select private.customer_order_ids())
  order by o.created_at desc
  limit 200;
$$;

-- Ficha de un pedido de la cuenta, o null si no existe o no es suyo (sin
-- distinguir ambos casos). Lo que el cliente ya recibió en su confirmación:
-- artículos, importes, entrega, contacto y seguimiento.
create function public.customer_order(p_number bigint)
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
    'total_cents', o.total_cents,
    'created_at', o.created_at,
    'paid_at', o.paid_at,
    'tracking_reference', o.tracking_reference,
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

-- ---------------------------------------------------------------------------
-- Guardar la ficha
-- ---------------------------------------------------------------------------

-- Nombre, teléfono e idioma, y la dirección de envío completa o ninguna:
-- p_address {"address_line1", "address_line2"?, "postal_code", "city",
-- "province"?} o null para quitarla.
create function public.customer_save_account(
  p_full_name text,
  p_phone text,
  p_locale text,
  p_address jsonb default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_name text := nullif(btrim(coalesce(p_full_name, '')), '');
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_line1 text := nullif(btrim(coalesce(p_address ->> 'address_line1', '')), '');
  v_line2 text := nullif(btrim(coalesce(p_address ->> 'address_line2', '')), '');
  v_postal text := nullif(btrim(coalesce(p_address ->> 'postal_code', '')), '');
  v_city text := nullif(btrim(coalesce(p_address ->> 'city', '')), '');
  v_province text := nullif(btrim(coalesce(p_address ->> 'province', '')), '');
begin
  if v_user is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_locale is null or p_locale not in ('es', 'ca', 'en')
     or char_length(coalesce(v_name, '')) > 120
     or (v_phone is not null and v_phone !~ '^[0-9 +().-]{6,30}$') then
    raise exception 'invalid_account' using errcode = '22023';
  end if;
  if p_address is not null and jsonb_typeof(p_address) is distinct from 'object' then
    raise exception 'invalid_address' using errcode = '22023';
  end if;
  if (v_line1 is not null or v_line2 is not null or v_postal is not null
      or v_city is not null or v_province is not null)
     and (v_line1 is null or char_length(v_line1) > 200
          or char_length(coalesce(v_line2, '')) > 200
          or v_postal is null or v_postal !~ '^[0-9]{5}$'
          or v_city is null or char_length(v_city) > 120
          or char_length(coalesce(v_province, '')) > 120) then
    raise exception 'invalid_address' using errcode = '22023';
  end if;

  insert into public.customer_accounts (
    user_id, full_name, phone, locale, address_line1, address_line2,
    postal_code, city, province
  ) values (
    v_user, v_name, v_phone, p_locale, v_line1, v_line2, v_postal, v_city, v_province
  )
  on conflict (user_id) do update
  set full_name = excluded.full_name,
      phone = excluded.phone,
      locale = excluded.locale,
      address_line1 = excluded.address_line1,
      address_line2 = excluded.address_line2,
      postal_code = excluded.postal_code,
      city = excluded.city,
      province = excluded.province;
end;
$$;

-- ---------------------------------------------------------------------------
-- Pedido con la sesión iniciada: web_order_create guarda la cuenta
-- ---------------------------------------------------------------------------

-- Igual que en P03 (20261012120000) con p_customer_id: la cuenta de la sesión,
-- que el servidor comprueba con Supabase Auth antes de llamar. null para un
-- pedido de invitado. Un reintento con la misma clave devuelve el pedido ya
-- creado sin tocarlo.
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
  p_customer_id uuid default null
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
    total_cents, reserved_until, customer_id
  ) values (
    p_request_id, p_locale, p_fulfillment, v_location, v_items_cents::integer,
    v_shipping_cents, (v_items_cents + v_shipping_cents)::integer,
    now() + make_interval(mins => p_hold_minutes), p_customer_id
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
                             'with_account', p_customer_id is not null,
                             'reserved_until', v_order.reserved_until));
  v_attempt := private.new_payment_attempt(v_order, p_provider);
  return private.web_order_summary(v_order, v_attempt);
end;
$$;

-- ---------------------------------------------------------------------------
-- Copia diaria: la ficha del cliente entra en la lista blanca
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
    'public.customer_accounts',
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

revoke execute on function private.customer_order_ids()
  from public, anon, authenticated, service_role;

-- Cualquier sesión (cliente o personal comprando); cada función solo ve lo suyo.
revoke execute on function
  public.customer_orders(),
  public.customer_order(bigint),
  public.customer_save_account(text, text, text, jsonb)
  from public, anon;
grant execute on function
  public.customer_orders(),
  public.customer_order(bigint),
  public.customer_save_account(text, text, text, jsonb)
  to authenticated;

-- Solo el servidor con la clave privilegiada, como antes.
revoke execute on function
  public.web_order_create(uuid, text, text, uuid, jsonb, jsonb, text, integer, uuid)
  from public, anon, authenticated;
grant execute on function
  public.web_order_create(uuid, text, text, uuid, jsonb, jsonb, text, integer, uuid)
  to service_role;
