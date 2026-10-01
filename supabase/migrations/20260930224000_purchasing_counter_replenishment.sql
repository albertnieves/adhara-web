-- Tienda física y reposición (docs/PLAN_TIENDA_REPOSICION.md; A3 completa y
-- A4.1 de docs/ADMIN_PLAN.md): proveedores y pedidos de compra en internal
-- (fuera de la API), ventas de mostrador, parámetros del vigilante de stock y
-- los datos agregados que necesita.
--
-- Solo añade tablas y funciones. Las entradas y salidas de stock pasan por
-- public.admin_record_inventory_movement (llamada con argumentos por nombre),
-- así que sus reglas, bloqueo de fila y auditoría se aplican igual.
-- Toda escritura exige además sesión con MFA (aal2), aunque el permiso no la
-- exija por sí mismo: el panel solo abre con MFA y la API directa tampoco debe
-- permitir menos.

-- ---------------------------------------------------------------------------
-- Proveedores y condiciones de compra por formato
-- ---------------------------------------------------------------------------

create table internal.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  contact_name text check (char_length(contact_name) <= 120),
  email text check (char_length(email) <= 200),
  phone text check (char_length(phone) <= 40),
  -- Plazo habitual de entrega en días naturales; null = desconocido.
  lead_time_days integer check (lead_time_days between 0 and 365),
  notes text check (char_length(notes) <= 1000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index suppliers_name_key on internal.suppliers (lower(btrim(name)));

create trigger suppliers_updated_at
  before update on internal.suppliers
  for each row execute function private.set_updated_at();

create table internal.supplier_variants (
  supplier_id uuid not null references internal.suppliers (id) on delete cascade,
  variant_id uuid not null references public.product_variants (id) on delete cascade,
  supplier_sku text check (char_length(supplier_sku) <= 80),
  -- Múltiplo de compra: las propuestas se redondean hacia arriba a este número.
  pack_size integer not null default 1 check (pack_size between 1 and 10000),
  -- Plazo de este formato si difiere del habitual del proveedor.
  lead_time_days integer check (lead_time_days between 0 and 365),
  preferred boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (supplier_id, variant_id)
);

create index supplier_variants_variant_idx on internal.supplier_variants (variant_id);
create unique index supplier_variants_one_preferred
  on internal.supplier_variants (variant_id) where preferred;

create trigger supplier_variants_updated_at
  before update on internal.supplier_variants
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Pedidos de compra
-- ---------------------------------------------------------------------------

create sequence internal.purchase_order_number_seq;

create table internal.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  supplier_id uuid not null references internal.suppliers (id) on delete restrict,
  location_id uuid not null references public.stock_locations (id) on delete restrict,
  status text not null default 'draft' check (status in (
    'draft', 'ordered', 'partially_received', 'received', 'closed', 'cancelled'
  )),
  expected_on date,
  -- Nº de pedido o de albarán del proveedor.
  supplier_reference text check (char_length(supplier_reference) <= 80),
  notes text check (char_length(notes) <= 1000),
  -- Sube con cada cambio: las ediciones indican la revisión que vio la persona.
  revision integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ordered_at timestamptz,
  closed_at timestamptz
);

create index purchase_orders_supplier_idx on internal.purchase_orders (supplier_id);
create index purchase_orders_status_idx on internal.purchase_orders (status, created_at desc);
create index purchase_orders_location_idx on internal.purchase_orders (location_id);
create index purchase_orders_created_by_idx on internal.purchase_orders (created_by);

create trigger purchase_orders_updated_at
  before update on internal.purchase_orders
  for each row execute function private.set_updated_at();

create table internal.purchase_order_lines (
  id bigint generated always as identity primary key,
  order_id uuid not null references internal.purchase_orders (id) on delete cascade,
  variant_id uuid not null references public.product_variants (id) on delete restrict,
  quantity_ordered integer not null check (quantity_ordered between 1 and 100000),
  quantity_received integer not null default 0 check (quantity_received >= 0),
  -- Coste neto unitario acordado (sin IVA); solo visible con pricing.view_cost.
  unit_cost_net_cents integer check (unit_cost_net_cents >= 0),
  position integer not null default 0,
  constraint received_within_ordered check (quantity_received <= quantity_ordered),
  unique (order_id, variant_id)
);

create index purchase_order_lines_variant_idx on internal.purchase_order_lines (variant_id);

-- Recepciones: una por entrega (o por pulsación), de solo inserción. La clave
-- de petición hace que repetir el envío no vuelva a sumar stock.
create table internal.purchase_receipts (
  id bigint generated always as identity primary key,
  order_id uuid not null references internal.purchase_orders (id) on delete restrict,
  request_id uuid not null unique,
  reference text check (char_length(reference) <= 120),
  units integer not null check (units > 0),
  costs_recorded integer not null default 0,
  actor_id uuid references auth.users (id) on delete set null,
  at timestamptz not null default now()
);

create index purchase_receipts_order_idx on internal.purchase_receipts (order_id, at);
create index purchase_receipts_actor_idx on internal.purchase_receipts (actor_id);

create table internal.purchase_receipt_lines (
  receipt_id bigint not null references internal.purchase_receipts (id) on delete restrict,
  line_id bigint not null references internal.purchase_order_lines (id) on delete restrict,
  quantity integer not null check (quantity > 0),
  movement_id bigint not null references public.inventory_movements (id) on delete restrict,
  primary key (receipt_id, line_id)
);

create index purchase_receipt_lines_line_idx on internal.purchase_receipt_lines (line_id);
create index purchase_receipt_lines_movement_idx on internal.purchase_receipt_lines (movement_id);

create trigger purchase_receipts_append_only
  before update or delete on internal.purchase_receipts
  for each row execute function private.reject_mutation();
create trigger purchase_receipt_lines_append_only
  before update or delete on internal.purchase_receipt_lines
  for each row execute function private.reject_mutation();

-- Transiciones manuales (mismo cuadro que ORDER_TRANSITIONS en TS). La
-- recepción mueve ordered/partially_received a partially_received o received.
create function private.purchase_order_transition(p_status text, p_action text)
returns text
language sql
immutable
set search_path = ''
as $$
  select t.next
  from (values
    ('draft', 'order', 'ordered'),
    ('draft', 'cancel', 'cancelled'),
    ('ordered', 'cancel', 'cancelled'),
    ('partially_received', 'close', 'closed')
  ) as t(status, action, next)
  where t.status = p_status and t.action = p_action;
$$;

-- ---------------------------------------------------------------------------
-- Ventas y devoluciones de mostrador
-- ---------------------------------------------------------------------------

-- El panel no emite tickets ni guarda importes: descuenta unidades y guarda el
-- nº de ticket del TPV o de la caja para poder cuadrar.
create table public.store_sales (
  id bigint generated always as identity primary key,
  request_id uuid not null unique,
  location_id uuid not null references public.stock_locations (id) on delete restrict,
  kind text not null check (kind in ('sale', 'return')),
  ticket_ref text check (char_length(ticket_ref) <= 60),
  units integer not null check (units > 0),
  actor_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index store_sales_location_idx on public.store_sales (location_id, created_at desc);
create index store_sales_actor_idx on public.store_sales (actor_id);

create table public.store_sale_lines (
  sale_id bigint not null references public.store_sales (id) on delete restrict,
  variant_id uuid not null references public.product_variants (id) on delete restrict,
  quantity integer not null check (quantity > 0),
  movement_id bigint not null references public.inventory_movements (id) on delete restrict,
  primary key (sale_id, variant_id)
);

create index store_sale_lines_variant_idx on public.store_sale_lines (variant_id);
create index store_sale_lines_movement_idx on public.store_sale_lines (movement_id);

create trigger store_sales_append_only
  before update or delete on public.store_sales
  for each row execute function private.reject_mutation();
create trigger store_sale_lines_append_only
  before update or delete on public.store_sale_lines
  for each row execute function private.reject_mutation();

-- ---------------------------------------------------------------------------
-- Parámetros del vigilante de stock (fila única, visibles en el panel)
-- ---------------------------------------------------------------------------

create table public.stock_watch_settings (
  id boolean primary key default true check (id),
  -- Días de ventas que se analizan para calcular la velocidad de venta.
  sales_window_days integer not null check (sales_window_days between 7 and 365),
  -- Días de venta que debe cubrir una reposición, además del plazo.
  target_cover_days integer not null check (target_cover_days between 1 and 365),
  -- Colchón sobre el plazo de entrega.
  safety_days integer not null check (safety_days between 0 and 180),
  -- Días sin ventas, con existencias, para considerar stock inmovilizado.
  dead_stock_days integer not null check (dead_stock_days between 7 and 730),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create index stock_watch_settings_updated_by_idx on public.stock_watch_settings (updated_by);

-- Valores provisionales hasta que los fije el negocio (ADMIN_PLAN §8, pregunta 7).
insert into public.stock_watch_settings (
  sales_window_days, target_cover_days, safety_days, dead_stock_days
) values (30, 30, 7, 120);

-- ---------------------------------------------------------------------------
-- Auxiliares
-- ---------------------------------------------------------------------------

-- Lista [{variant_id, quantity, unit_cost_net_cents?}] validada, sin repetidos.
-- cost_given distingue «sin clave» (no tocar) de «null» (quitar el coste).
create function private.parse_quantity_items(p_items jsonb, p_max integer)
returns table (
  variant_id uuid,
  quantity integer,
  cost_given boolean,
  unit_cost_net_cents integer,
  item_position integer
)
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_item jsonb;
  v_index bigint;
  v_seen uuid[] := '{}';
  v_quantity numeric;
  v_cost numeric;
begin
  if jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) > p_max then
    raise exception 'invalid_items' using errcode = '22023';
  end if;
  for v_item, v_index in
    select a.e, a.i from jsonb_array_elements(p_items) with ordinality as a(e, i)
  loop
    if jsonb_typeof(v_item) is distinct from 'object'
       or jsonb_typeof(v_item -> 'variant_id') is distinct from 'string'
       or jsonb_typeof(v_item -> 'quantity') is distinct from 'number' then
      raise exception 'invalid_items' using errcode = '22023';
    end if;
    if (v_item ->> 'variant_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'invalid_items' using errcode = '22023';
    end if;
    v_quantity := (v_item ->> 'quantity')::numeric;
    if v_quantity <> trunc(v_quantity) or v_quantity < 1 or v_quantity > 100000 then
      raise exception 'invalid_quantity' using errcode = '22023';
    end if;
    variant_id := (v_item ->> 'variant_id')::uuid;
    if variant_id = any (v_seen) then
      raise exception 'invalid_items' using errcode = '22023';
    end if;
    v_seen := v_seen || variant_id;
    quantity := v_quantity::integer;
    cost_given := v_item ? 'unit_cost_net_cents';
    unit_cost_net_cents := null;
    if cost_given and jsonb_typeof(v_item -> 'unit_cost_net_cents') <> 'null' then
      if jsonb_typeof(v_item -> 'unit_cost_net_cents') <> 'number' then
        raise exception 'invalid_amount' using errcode = '22023';
      end if;
      v_cost := (v_item ->> 'unit_cost_net_cents')::numeric;
      if v_cost <> trunc(v_cost) or v_cost < 0 or v_cost > 2147483647 then
        raise exception 'invalid_amount' using errcode = '22023';
      end if;
      unit_cost_net_cents := v_cost::integer;
    end if;
    item_position := v_index::integer;
    return next;
  end loop;
end;
$$;

-- Coste neto vigente de un formato (último registro), para prellenar pedidos.
create function private.current_variant_cost(p_variant_id uuid)
returns integer
language sql
stable
set search_path = ''
as $$
  select c.cost_net_cents
  from internal.variant_cost_records c
  where c.variant_id = p_variant_id
  order by c.at desc, c.id desc
  limit 1;
$$;

-- Pedido bloqueado para cambiarlo, comprobando que nadie lo cambió entretanto.
create function private.lock_purchase_order(p_order_id uuid, p_revision integer)
returns internal.purchase_orders
language plpgsql
set search_path = ''
as $$
declare
  v_order internal.purchase_orders;
begin
  select * into v_order from internal.purchase_orders o where o.id = p_order_id for update;
  if not found then
    raise exception 'unknown_order' using errcode = '22023';
  end if;
  if p_revision is null or v_order.revision <> p_revision then
    raise exception 'stale_revision' using errcode = '55000';
  end if;
  return v_order;
end;
$$;

-- ---------------------------------------------------------------------------
-- Proveedores (purchasing.manage, que ya exige MFA)
-- ---------------------------------------------------------------------------

create function public.admin_list_suppliers()
returns table (
  id uuid,
  name text,
  contact_name text,
  email text,
  phone text,
  lead_time_days integer,
  notes text,
  active boolean,
  variant_count integer,
  open_orders integer,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('purchasing.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select s.id, s.name, s.contact_name, s.email, s.phone, s.lead_time_days,
           s.notes, s.active,
           (select count(*)::integer from internal.supplier_variants sv
             where sv.supplier_id = s.id),
           (select count(*)::integer from internal.purchase_orders o
             where o.supplier_id = s.id
               and o.status in ('draft', 'ordered', 'partially_received')),
           s.created_at
    from internal.suppliers s
    order by s.active desc, lower(s.name);
end;
$$;

-- Alta (p_id null) o cambio de un proveedor.
create function public.admin_save_supplier(
  p_id uuid,
  p_name text,
  p_contact_name text default null,
  p_email text default null,
  p_phone text default null,
  p_lead_time_days integer default null,
  p_notes text default null,
  p_active boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before internal.suppliers;
  v_after internal.suppliers;
begin
  if not private.has_permission('purchasing.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_id is null then
    insert into internal.suppliers (
      name, contact_name, email, phone, lead_time_days, notes, active
    ) values (
      btrim(p_name), nullif(btrim(p_contact_name), ''), nullif(btrim(p_email), ''),
      nullif(btrim(p_phone), ''), p_lead_time_days, nullif(btrim(p_notes), ''),
      coalesce(p_active, true)
    )
    returning * into v_after;
  else
    select * into v_before from internal.suppliers s where s.id = p_id for update;
    if not found then
      raise exception 'unknown_supplier' using errcode = '22023';
    end if;
    update internal.suppliers s
    set name = btrim(p_name),
        contact_name = nullif(btrim(p_contact_name), ''),
        email = nullif(btrim(p_email), ''),
        phone = nullif(btrim(p_phone), ''),
        lead_time_days = p_lead_time_days,
        notes = nullif(btrim(p_notes), ''),
        active = coalesce(p_active, true)
    where s.id = p_id
    returning * into v_after;
  end if;

  insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
  values ((select auth.uid()),
          case when p_id is null then 'purchasing.supplier_created'
               else 'purchasing.supplier_updated' end,
          'supplier', v_after.id::text,
          case when v_before.id is null then null
               else to_jsonb(v_before) - 'created_at' - 'updated_at' end,
          to_jsonb(v_after) - 'created_at' - 'updated_at');
  return v_after.id;
end;
$$;

-- Condiciones de compra por proveedor y formato. Filtra por proveedor, por
-- formatos o ambos; el plazo efectivo es el del formato o el del proveedor.
create function public.admin_supplier_terms(
  p_supplier_id uuid default null,
  p_variant_ids uuid[] default null
)
returns table (
  supplier_id uuid,
  supplier_name text,
  supplier_active boolean,
  variant_id uuid,
  supplier_sku text,
  pack_size integer,
  lead_time_days integer,
  effective_lead_time_days integer,
  preferred boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('purchasing.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select s.id, s.name, s.active, sv.variant_id, sv.supplier_sku, sv.pack_size,
           sv.lead_time_days, coalesce(sv.lead_time_days, s.lead_time_days),
           sv.preferred
    from internal.supplier_variants sv
    join internal.suppliers s on s.id = sv.supplier_id
    where (p_supplier_id is null or sv.supplier_id = p_supplier_id)
      and (p_variant_ids is null or sv.variant_id = any (p_variant_ids))
    order by sv.variant_id, sv.preferred desc, lower(s.name);
end;
$$;

create function public.admin_save_supplier_variant(
  p_supplier_id uuid,
  p_variant_id uuid,
  p_supplier_sku text default null,
  p_pack_size integer default 1,
  p_lead_time_days integer default null,
  p_preferred boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before internal.supplier_variants;
begin
  if not private.has_permission('purchasing.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from internal.suppliers s where s.id = p_supplier_id) then
    raise exception 'unknown_supplier' using errcode = '22023';
  end if;
  if not exists (select 1 from public.product_variants v where v.id = p_variant_id) then
    raise exception 'unknown_variant' using errcode = '22023';
  end if;
  if p_pack_size is null or p_pack_size < 1 then
    raise exception 'invalid_quantity' using errcode = '22023';
  end if;
  select * into v_before from internal.supplier_variants sv
  where sv.supplier_id = p_supplier_id and sv.variant_id = p_variant_id;
  -- Un solo proveedor preferente por formato.
  if coalesce(p_preferred, false) then
    update internal.supplier_variants sv set preferred = false
    where sv.variant_id = p_variant_id and sv.supplier_id <> p_supplier_id and sv.preferred;
  end if;
  insert into internal.supplier_variants (
    supplier_id, variant_id, supplier_sku, pack_size, lead_time_days, preferred
  ) values (
    p_supplier_id, p_variant_id, nullif(btrim(p_supplier_sku), ''), p_pack_size,
    p_lead_time_days, coalesce(p_preferred, false)
  )
  on conflict (supplier_id, variant_id) do update
    set supplier_sku = excluded.supplier_sku,
        pack_size = excluded.pack_size,
        lead_time_days = excluded.lead_time_days,
        preferred = excluded.preferred;
  insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
  values ((select auth.uid()), 'purchasing.terms_saved', 'supplier_variant',
          p_supplier_id::text || '/' || p_variant_id::text,
          case when v_before.supplier_id is null then null
               else jsonb_build_object('supplier_sku', v_before.supplier_sku,
                                       'pack_size', v_before.pack_size,
                                       'lead_time_days', v_before.lead_time_days,
                                       'preferred', v_before.preferred) end,
          jsonb_build_object('supplier_sku', nullif(btrim(p_supplier_sku), ''),
                             'pack_size', p_pack_size,
                             'lead_time_days', p_lead_time_days,
                             'preferred', coalesce(p_preferred, false)));
end;
$$;

create function public.admin_remove_supplier_variant(p_supplier_id uuid, p_variant_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('purchasing.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from internal.supplier_variants sv
  where sv.supplier_id = p_supplier_id and sv.variant_id = p_variant_id;
  if found then
    insert into public.audit_log (actor_id, action, entity, entity_id)
    values ((select auth.uid()), 'purchasing.terms_removed', 'supplier_variant',
            p_supplier_id::text || '/' || p_variant_id::text);
  end if;
end;
$$;

-- Asigna el proveedor a todos los formatos de una marca (o de todo el catálogo
-- con p_brand_id null) que aún no tenían condiciones con él. Preferente solo
-- donde el formato no tenga ya otro preferente.
create function public.admin_assign_supplier_brand(
  p_supplier_id uuid,
  p_brand_id uuid default null,
  p_preferred boolean default true
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not private.has_permission('purchasing.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from internal.suppliers s where s.id = p_supplier_id) then
    raise exception 'unknown_supplier' using errcode = '22023';
  end if;
  insert into internal.supplier_variants (supplier_id, variant_id, preferred)
  select p_supplier_id, v.id,
         coalesce(p_preferred, false) and not exists (
           select 1 from internal.supplier_variants other
           where other.variant_id = v.id and other.preferred
         )
  from public.product_variants v
  join public.products p on p.id = v.product_id
  where p.status <> 'archived'
    and (p_brand_id is null or p.brand_id = p_brand_id)
  on conflict (supplier_id, variant_id) do nothing;
  get diagnostics v_count = row_count;
  insert into public.audit_log (actor_id, action, entity, entity_id, after)
  values ((select auth.uid()), 'purchasing.terms_assigned', 'supplier',
          p_supplier_id::text,
          jsonb_build_object('brand_id', p_brand_id, 'count', v_count));
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Pedidos de compra (purchasing.manage)
-- ---------------------------------------------------------------------------

create function public.admin_create_purchase_order(
  p_supplier_id uuid,
  p_location_id uuid,
  p_lines jsonb default '[]'::jsonb,
  p_expected_on date default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order internal.purchase_orders;
  v_can_cost boolean := private.has_permission('pricing.view_cost');
  v_lines integer;
begin
  if not private.has_permission('purchasing.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (
    select 1 from internal.suppliers s where s.id = p_supplier_id and s.active
  ) then
    raise exception 'unknown_supplier' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.stock_locations l where l.id = p_location_id and l.active
  ) then
    raise exception 'unknown_location' using errcode = '22023';
  end if;
  if exists (
    select 1 from private.parse_quantity_items(coalesce(p_lines, '[]'::jsonb), 500) i
    where not exists (select 1 from public.product_variants v where v.id = i.variant_id)
  ) then
    raise exception 'unknown_variant' using errcode = '22023';
  end if;

  insert into internal.purchase_orders (
    number, supplier_id, location_id, expected_on, notes, created_by
  ) values (
    'PC-' || to_char(now() at time zone 'Europe/Madrid', 'YYYY') || '-'
      || lpad(nextval('internal.purchase_order_number_seq')::text, 4, '0'),
    p_supplier_id, p_location_id, p_expected_on, nullif(btrim(p_notes), ''),
    (select auth.uid())
  )
  returning * into v_order;

  -- Sin permiso de costes, el coste del cliente se ignora; si falta, se toma
  -- el coste vigente del formato.
  insert into internal.purchase_order_lines (
    order_id, variant_id, quantity_ordered, unit_cost_net_cents, position
  )
  select v_order.id, i.variant_id, i.quantity,
         case when v_can_cost and i.cost_given then i.unit_cost_net_cents
              else private.current_variant_cost(i.variant_id) end,
         i.item_position
  from private.parse_quantity_items(coalesce(p_lines, '[]'::jsonb), 500) i;
  get diagnostics v_lines = row_count;

  insert into public.audit_log (actor_id, action, entity, entity_id, after)
  values ((select auth.uid()), 'purchasing.order_created', 'purchase_order',
          v_order.id::text,
          jsonb_build_object('number', v_order.number, 'supplier_id', p_supplier_id,
                             'lines', v_lines));
  return v_order.id;
end;
$$;

create function public.admin_list_purchase_orders(
  p_status text default null,
  p_order_id uuid default null
)
returns table (
  id uuid,
  number text,
  supplier_id uuid,
  supplier_name text,
  location_id uuid,
  location_name text,
  status text,
  expected_on date,
  supplier_reference text,
  notes text,
  revision integer,
  created_at timestamptz,
  ordered_at timestamptz,
  closed_at timestamptz,
  line_count integer,
  units_ordered integer,
  units_received integer,
  total_cost_net_cents bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_can_cost boolean := private.has_permission('pricing.view_cost');
begin
  if not private.has_permission('purchasing.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select o.id, o.number, s.id, s.name, l.id, l.name, o.status, o.expected_on,
           o.supplier_reference, o.notes, o.revision, o.created_at, o.ordered_at,
           o.closed_at,
           coalesce(t.line_count, 0), coalesce(t.units_ordered, 0),
           coalesce(t.units_received, 0),
           case when v_can_cost then t.total_cost end
    from internal.purchase_orders o
    join internal.suppliers s on s.id = o.supplier_id
    join public.stock_locations l on l.id = o.location_id
    left join lateral (
      select count(*)::integer as line_count,
             sum(pl.quantity_ordered)::integer as units_ordered,
             sum(pl.quantity_received)::integer as units_received,
             -- Solo si todas las líneas tienen coste; si no, se desconoce.
             case when bool_and(pl.unit_cost_net_cents is not null)
                  then sum(pl.quantity_ordered::bigint * pl.unit_cost_net_cents)::bigint end
               as total_cost
      from internal.purchase_order_lines pl
      where pl.order_id = o.id
    ) t on true
    where (p_status is null or o.status = p_status)
      and (p_order_id is null or o.id = p_order_id)
    order by o.created_at desc, o.number desc;
end;
$$;

create function public.admin_purchase_order_lines(p_order_id uuid)
returns table (
  line_id bigint,
  variant_id uuid,
  quantity_ordered integer,
  quantity_received integer,
  unit_cost_net_cents integer,
  supplier_sku text,
  pack_size integer,
  line_position integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_can_cost boolean := private.has_permission('pricing.view_cost');
begin
  if not private.has_permission('purchasing.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select pl.id, pl.variant_id, pl.quantity_ordered, pl.quantity_received,
           case when v_can_cost then pl.unit_cost_net_cents end,
           sv.supplier_sku, sv.pack_size, pl.position
    from internal.purchase_order_lines pl
    join internal.purchase_orders o on o.id = pl.order_id
    left join internal.supplier_variants sv
      on sv.supplier_id = o.supplier_id and sv.variant_id = pl.variant_id
    where pl.order_id = p_order_id
    order by pl.position, pl.id;
end;
$$;

create function public.admin_purchase_order_receipts(p_order_id uuid)
returns table (
  receipt_id bigint,
  reference text,
  units integer,
  costs_recorded integer,
  actor_name text,
  at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('purchasing.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select r.id, r.reference, r.units, r.costs_recorded,
           coalesce(sm.display_name, u.email::text), r.at
    from internal.purchase_receipts r
    left join public.staff_members sm on sm.user_id = r.actor_id
    left join auth.users u on u.id = r.actor_id
    where r.order_id = p_order_id
    order by r.at, r.id;
end;
$$;

create function public.admin_update_purchase_order(
  p_order_id uuid,
  p_revision integer,
  p_expected_on date default null,
  p_supplier_reference text default null,
  p_notes text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order internal.purchase_orders;
begin
  if not private.has_permission('purchasing.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  v_order := private.lock_purchase_order(p_order_id, p_revision);
  if v_order.status not in ('draft', 'ordered', 'partially_received') then
    raise exception 'invalid_status' using errcode = '55000';
  end if;
  update internal.purchase_orders o
  set expected_on = p_expected_on,
      supplier_reference = nullif(btrim(p_supplier_reference), ''),
      notes = nullif(btrim(p_notes), ''),
      revision = o.revision + 1
  where o.id = p_order_id;
  insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
  values ((select auth.uid()), 'purchasing.order_updated', 'purchase_order',
          p_order_id::text,
          jsonb_build_object('expected_on', v_order.expected_on,
                             'supplier_reference', v_order.supplier_reference,
                             'notes', v_order.notes),
          jsonb_build_object('expected_on', p_expected_on,
                             'supplier_reference', nullif(btrim(p_supplier_reference), ''),
                             'notes', nullif(btrim(p_notes), '')));
  return v_order.revision + 1;
end;
$$;

-- Sustituye las líneas de un borrador. Sin la clave del coste en una línea, se
-- conserva el que tenía (o el vigente si es nueva); sin permiso de costes, la
-- clave se ignora.
create function public.admin_set_purchase_order_lines(
  p_order_id uuid,
  p_revision integer,
  p_lines jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order internal.purchase_orders;
  v_can_cost boolean := private.has_permission('pricing.view_cost');
  v_lines integer;
begin
  if not private.has_permission('purchasing.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  v_order := private.lock_purchase_order(p_order_id, p_revision);
  if v_order.status <> 'draft' then
    raise exception 'invalid_status' using errcode = '55000';
  end if;
  create temporary table pg_temp.new_lines on commit drop as
    select i.variant_id, i.quantity, i.cost_given, i.unit_cost_net_cents, i.item_position
    from private.parse_quantity_items(p_lines, 500) i;
  if exists (
    select 1 from pg_temp.new_lines n
    where not exists (select 1 from public.product_variants v where v.id = n.variant_id)
  ) then
    raise exception 'unknown_variant' using errcode = '22023';
  end if;

  delete from internal.purchase_order_lines pl
  where pl.order_id = p_order_id
    and not exists (select 1 from pg_temp.new_lines n where n.variant_id = pl.variant_id);
  update internal.purchase_order_lines pl
  set quantity_ordered = n.quantity,
      position = n.item_position,
      unit_cost_net_cents = case when v_can_cost and n.cost_given
                                 then n.unit_cost_net_cents
                                 else pl.unit_cost_net_cents end
  from pg_temp.new_lines n
  where pl.order_id = p_order_id and pl.variant_id = n.variant_id;
  insert into internal.purchase_order_lines (
    order_id, variant_id, quantity_ordered, unit_cost_net_cents, position
  )
  select p_order_id, n.variant_id, n.quantity,
         case when v_can_cost and n.cost_given then n.unit_cost_net_cents
              else private.current_variant_cost(n.variant_id) end,
         n.item_position
  from pg_temp.new_lines n
  where not exists (
    select 1 from internal.purchase_order_lines pl
    where pl.order_id = p_order_id and pl.variant_id = n.variant_id
  );
  select count(*)::integer into v_lines from pg_temp.new_lines;
  drop table pg_temp.new_lines;

  update internal.purchase_orders o set revision = o.revision + 1 where o.id = p_order_id;
  insert into public.audit_log (actor_id, action, entity, entity_id, after)
  values ((select auth.uid()), 'purchasing.order_lines_set', 'purchase_order',
          p_order_id::text, jsonb_build_object('lines', v_lines));
  return v_order.revision + 1;
end;
$$;

create function public.admin_transition_purchase_order(
  p_order_id uuid,
  p_revision integer,
  p_action text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order internal.purchase_orders;
  v_next text;
begin
  if not private.has_permission('purchasing.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  v_order := private.lock_purchase_order(p_order_id, p_revision);
  v_next := private.purchase_order_transition(v_order.status, p_action);
  if v_next is null then
    raise exception 'invalid_status' using errcode = '55000';
  end if;
  if p_action = 'order' and not exists (
    select 1 from internal.purchase_order_lines pl where pl.order_id = p_order_id
  ) then
    raise exception 'empty_order' using errcode = '22023';
  end if;
  update internal.purchase_orders o
  set status = v_next,
      revision = o.revision + 1,
      ordered_at = case when v_next = 'ordered' then now() else o.ordered_at end,
      closed_at = case when v_next in ('cancelled', 'closed') then now() else o.closed_at end
  where o.id = p_order_id;
  insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
  values ((select auth.uid()), 'purchasing.order_' || v_next, 'purchase_order',
          p_order_id::text,
          jsonb_build_object('status', v_order.status),
          jsonb_build_object('status', v_next));
  return v_next;
end;
$$;

-- Solo los borradores se borran; lo demás se cancela o se cierra.
create function public.admin_delete_purchase_order(p_order_id uuid, p_revision integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order internal.purchase_orders;
begin
  if not private.has_permission('purchasing.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  v_order := private.lock_purchase_order(p_order_id, p_revision);
  if v_order.status <> 'draft' then
    raise exception 'invalid_status' using errcode = '55000';
  end if;
  delete from internal.purchase_orders o where o.id = p_order_id;
  insert into public.audit_log (actor_id, action, entity, entity_id, before)
  values ((select auth.uid()), 'purchasing.order_deleted', 'purchase_order',
          p_order_id::text, jsonb_build_object('number', v_order.number));
end;
$$;

-- Recepción de un pedido: suma stock (PURCHASE_RECEIPT) por cada línea en la
-- misma transacción. El pedido queda bloqueado mientras tanto, así que dos
-- recepciones simultáneas no superan lo pedido. Repetir la misma clave de
-- petición devuelve la recepción ya registrada sin volver a sumar.
-- p_items: [{"line_id": bigint, "quantity": int}, …]
create function public.admin_receive_purchase_order(
  p_order_id uuid,
  p_request_id uuid,
  p_items jsonb,
  p_reference text default null,
  p_record_costs boolean default false
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order internal.purchase_orders;
  v_receipt_id bigint;
  v_existing internal.purchase_receipts;
  v_item record;
  v_line internal.purchase_order_lines;
  v_movement public.inventory_movements;
  v_units integer := 0;
  v_costs integer := 0;
  v_reference text;
begin
  if not private.has_permission('purchasing.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if coalesce(p_record_costs, false) and not private.has_permission('pricing.edit_cost') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_request_id is null then
    raise exception 'invalid_items' using errcode = '22023';
  end if;

  select * into v_order from internal.purchase_orders o where o.id = p_order_id for update;
  if not found then
    raise exception 'unknown_order' using errcode = '22023';
  end if;
  -- Reintento de una recepción ya registrada (doble toque o red lenta).
  select * into v_existing from internal.purchase_receipts r where r.request_id = p_request_id;
  if found then
    if v_existing.order_id <> p_order_id then
      raise exception 'invalid_items' using errcode = '22023';
    end if;
    return v_existing.id;
  end if;
  if v_order.status not in ('ordered', 'partially_received') then
    raise exception 'invalid_status' using errcode = '55000';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) = 0
     or jsonb_array_length(p_items) > 500 then
    raise exception 'invalid_items' using errcode = '22023';
  end if;
  create temporary table pg_temp.receive_items (line_id bigint primary key, quantity integer)
    on commit drop;
  for v_item in select e from jsonb_array_elements(p_items) as a(e) loop
    if jsonb_typeof(v_item.e -> 'line_id') is distinct from 'number'
       or jsonb_typeof(v_item.e -> 'quantity') is distinct from 'number' then
      raise exception 'invalid_items' using errcode = '22023';
    end if;
    if (v_item.e ->> 'quantity')::numeric <> trunc((v_item.e ->> 'quantity')::numeric)
       or (v_item.e ->> 'quantity')::numeric < 0
       or (v_item.e ->> 'quantity')::numeric > 100000
       or (v_item.e ->> 'line_id')::numeric <> trunc((v_item.e ->> 'line_id')::numeric) then
      raise exception 'invalid_quantity' using errcode = '22023';
    end if;
    if exists (
      select 1 from pg_temp.receive_items i where i.line_id = (v_item.e ->> 'line_id')::bigint
    ) then
      raise exception 'invalid_items' using errcode = '22023';
    end if;
    -- Cantidad 0: la línea no llega en esta entrega.
    if (v_item.e ->> 'quantity')::integer > 0 then
      insert into pg_temp.receive_items (line_id, quantity)
      values ((v_item.e ->> 'line_id')::bigint, (v_item.e ->> 'quantity')::integer);
    end if;
  end loop;
  if not exists (select 1 from pg_temp.receive_items) then
    raise exception 'invalid_quantity' using errcode = '22023';
  end if;
  if exists (
    select 1 from pg_temp.receive_items i
    where not exists (
      select 1 from internal.purchase_order_lines pl
      where pl.id = i.line_id and pl.order_id = p_order_id
    )
  ) then
    raise exception 'unknown_line' using errcode = '22023';
  end if;

  select coalesce(sum(i.quantity), 0)::integer into v_units from pg_temp.receive_items i;
  -- Costes que pasarán a ser vigentes: los del pedido que difieren (o faltaban).
  if coalesce(p_record_costs, false) then
    select count(*)::integer into v_costs
    from pg_temp.receive_items i
    join internal.purchase_order_lines pl on pl.id = i.line_id
    where pl.unit_cost_net_cents is not null
      and private.current_variant_cost(pl.variant_id) is distinct from pl.unit_cost_net_cents;
  end if;
  insert into internal.purchase_receipts (
    order_id, request_id, reference, units, costs_recorded, actor_id
  ) values (
    p_order_id, p_request_id, nullif(btrim(p_reference), ''), v_units, v_costs,
    (select auth.uid())
  )
  returning id into v_receipt_id;

  v_reference := left(v_order.number
    || coalesce(' · ' || nullif(btrim(p_reference), ''), ''), 120);

  -- En orden de formato para bloquear los niveles siempre en el mismo orden.
  for v_item in
    select i.line_id, i.quantity, pl.variant_id
    from pg_temp.receive_items i
    join internal.purchase_order_lines pl on pl.id = i.line_id
    order by pl.variant_id
  loop
    select * into v_line from internal.purchase_order_lines pl
    where pl.id = v_item.line_id for update;
    if v_line.quantity_received + v_item.quantity > v_line.quantity_ordered then
      raise exception 'over_receipt' using errcode = '23514',
        detail = v_line.variant_id::text;
    end if;
    v_movement := public.admin_record_inventory_movement(
      p_variant_id => v_line.variant_id,
      p_location_id => v_order.location_id,
      p_type => 'PURCHASE_RECEIPT',
      p_quantity => v_item.quantity,
      p_reason => null,
      p_reference => v_reference
    );
    update internal.purchase_order_lines pl
    set quantity_received = pl.quantity_received + v_item.quantity
    where pl.id = v_line.id;
    insert into internal.purchase_receipt_lines (receipt_id, line_id, quantity, movement_id)
    values (v_receipt_id, v_line.id, v_item.quantity, v_movement.id);

    -- El coste del pedido pasa a ser el vigente si difiere (o si no había).
    if coalesce(p_record_costs, false) and v_line.unit_cost_net_cents is not null
       and private.current_variant_cost(v_line.variant_id)
           is distinct from v_line.unit_cost_net_cents then
      insert into internal.variant_cost_records (variant_id, cost_net_cents, note, actor_id)
      values (v_line.variant_id, v_line.unit_cost_net_cents,
              left('Pedido ' || v_order.number, 200), (select auth.uid()));
    end if;
  end loop;
  drop table pg_temp.receive_items;

  if v_costs > 0 then
    -- Como en admin_record_variant_costs: cuántos, nunca los importes.
    insert into public.audit_log (actor_id, action, entity, entity_id, after)
    values ((select auth.uid()), 'pricing.costs_recorded', 'purchase_order',
            p_order_id::text, jsonb_build_object('count', v_costs));
  end if;

  update internal.purchase_orders o
  set status = case
        when not exists (
          select 1 from internal.purchase_order_lines pl
          where pl.order_id = o.id and pl.quantity_received < pl.quantity_ordered
        ) then 'received'
        else 'partially_received'
      end,
      closed_at = case
        when not exists (
          select 1 from internal.purchase_order_lines pl
          where pl.order_id = o.id and pl.quantity_received < pl.quantity_ordered
        ) then now()
        else o.closed_at
      end,
      revision = o.revision + 1
  where o.id = p_order_id;

  insert into public.audit_log (actor_id, action, entity, entity_id, after)
  values ((select auth.uid()), 'purchasing.order_received', 'purchase_order',
          p_order_id::text,
          jsonb_build_object('receipt_id', v_receipt_id, 'units', v_units));
  return v_receipt_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Mostrador (inventory.sell_in_store con MFA)
-- ---------------------------------------------------------------------------

-- Venta o devolución de varias líneas, todo o nada. Una línea sin unidades
-- disponibles detiene la venta e indica el formato en el detalle del error.
-- p_items: [{"variant_id": uuid, "quantity": int}, …]
create function public.admin_record_store_sale(
  p_location_id uuid,
  p_kind text,
  p_items jsonb,
  p_request_id uuid,
  p_ticket_ref text default null
)
returns public.store_sales
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale public.store_sales;
  v_item record;
  v_available integer;
  v_movement public.inventory_movements;
  v_units integer;
begin
  if not (private.has_permission('inventory.sell_in_store')
          and private.current_aal() = 'aal2') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_kind is null or p_kind not in ('sale', 'return') or p_request_id is null then
    raise exception 'invalid_items' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.stock_locations l where l.id = p_location_id and l.active
  ) then
    raise exception 'unknown_location' using errcode = '22023';
  end if;

  create temporary table pg_temp.sale_items on commit drop as
    select i.variant_id, i.quantity
    from private.parse_quantity_items(p_items, 100) i;
  select coalesce(sum(i.quantity), 0)::integer into v_units from pg_temp.sale_items i;
  if v_units = 0 then
    raise exception 'invalid_items' using errcode = '22023';
  end if;
  if exists (
    select 1 from pg_temp.sale_items i
    where not exists (select 1 from public.product_variants v where v.id = i.variant_id)
  ) then
    raise exception 'unknown_variant' using errcode = '22023';
  end if;

  -- La cabecera va primero: un reintento simultáneo con la misma clave espera
  -- aquí y, cuando la primera termina, recibe la venta ya registrada.
  insert into public.store_sales (request_id, location_id, kind, ticket_ref, units, actor_id)
  values (p_request_id, p_location_id, p_kind, nullif(btrim(p_ticket_ref), ''), v_units,
          (select auth.uid()))
  on conflict (request_id) do nothing
  returning * into v_sale;
  if v_sale.id is null then
    drop table pg_temp.sale_items;
    select * into v_sale from public.store_sales s where s.request_id = p_request_id;
    return v_sale;
  end if;

  for v_item in select i.variant_id, i.quantity from pg_temp.sale_items i order by i.variant_id loop
    if p_kind = 'sale' then
      insert into public.inventory_levels (variant_id, location_id)
      values (v_item.variant_id, p_location_id)
      on conflict do nothing;
      select l.on_hand - l.reserved into v_available
      from public.inventory_levels l
      where l.variant_id = v_item.variant_id and l.location_id = p_location_id
      for update;
      if v_available < v_item.quantity then
        raise exception 'insufficient_stock' using errcode = '23514',
          detail = v_item.variant_id::text;
      end if;
    end if;
    v_movement := public.admin_record_inventory_movement(
      p_variant_id => v_item.variant_id,
      p_location_id => p_location_id,
      p_type => case p_kind when 'sale' then 'SALE_STORE' else 'RETURN' end,
      p_quantity => v_item.quantity,
      p_reason => null,
      p_reference => coalesce(v_sale.ticket_ref, 'Mostrador #' || v_sale.id)
    );
    insert into public.store_sale_lines (sale_id, variant_id, quantity, movement_id)
    values (v_sale.id, v_item.variant_id, v_item.quantity, v_movement.id);
  end loop;
  drop table pg_temp.sale_items;

  insert into public.audit_log (actor_id, action, entity, entity_id, after)
  values ((select auth.uid()), 'inventory.store_' || p_kind, 'store_sale', v_sale.id::text,
          jsonb_build_object('units', v_units, 'ticket_ref', v_sale.ticket_ref));
  return v_sale;
end;
$$;

-- ---------------------------------------------------------------------------
-- Vigilante de stock (inventory.view)
-- ---------------------------------------------------------------------------

-- Datos por formato para watchStock: ventas en la ventana de los parámetros,
-- primera entrada, suma de movimientos (para comprobar que el nivel cuadra),
-- plazo y múltiplo del proveedor de reposición y unidades pendientes de recibir.
-- No devuelve nombres de proveedor ni costes: el encargado también lo usa.
create function public.admin_stock_watch_facts(p_location_id uuid)
returns table (
  variant_id uuid,
  units_sold integer,
  last_sale_at timestamptz,
  first_stocked_at timestamptz,
  ledger_on_hand integer,
  ledger_reserved integer,
  lead_time_days integer,
  pack_size integer,
  incoming_units integer,
  has_supplier boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_window integer;
begin
  if not private.has_permission('inventory.view') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select s.sales_window_days into v_window from public.stock_watch_settings s where s.id;
  return query
    with moves as (
      select m.variant_id,
             coalesce(sum(-m.delta_on_hand) filter (
               where m.type in ('SALE_STORE', 'SALE_ONLINE', 'SALE_CLICK_COLLECT')
                 and m.created_at >= now() - make_interval(days => coalesce(v_window, 30))
             ), 0)::integer as units_sold,
             max(m.created_at) filter (
               where m.type in ('SALE_STORE', 'SALE_ONLINE', 'SALE_CLICK_COLLECT')
             ) as last_sale_at,
             min(m.created_at) filter (where m.delta_on_hand > 0) as first_stocked_at,
             sum(m.delta_on_hand)::integer as ledger_on_hand,
             sum(m.delta_reserved)::integer as ledger_reserved
      from public.inventory_movements m
      where m.location_id = p_location_id
      group by m.variant_id
    ),
    -- Proveedor de reposición: el preferente activo o el único activo. Con
    -- varios y ninguno preferente no se elige: lo decide una persona.
    terms as (
      select distinct on (sv.variant_id)
             sv.variant_id,
             coalesce(sv.lead_time_days, s.lead_time_days) as lead_time_days,
             sv.pack_size
      from internal.supplier_variants sv
      join internal.suppliers s on s.id = sv.supplier_id and s.active
      where sv.preferred
         or not exists (
           select 1
           from internal.supplier_variants other
           join internal.suppliers os on os.id = other.supplier_id and os.active
           where other.variant_id = sv.variant_id and other.supplier_id <> sv.supplier_id
         )
      order by sv.variant_id, sv.preferred desc
    ),
    incoming as (
      select pl.variant_id,
             sum(pl.quantity_ordered - pl.quantity_received)::integer as units
      from internal.purchase_order_lines pl
      join internal.purchase_orders o on o.id = pl.order_id
      where o.location_id = p_location_id
        and o.status in ('ordered', 'partially_received')
      group by pl.variant_id
    ),
    ids as (
      select l.variant_id from public.inventory_levels l where l.location_id = p_location_id
      union select moves.variant_id from moves
      union select terms.variant_id from terms
      union select incoming.variant_id from incoming
    )
    select ids.variant_id,
           coalesce(moves.units_sold, 0),
           moves.last_sale_at,
           moves.first_stocked_at,
           coalesce(moves.ledger_on_hand, 0),
           coalesce(moves.ledger_reserved, 0),
           terms.lead_time_days,
           terms.pack_size,
           coalesce(incoming.units, 0),
           terms.variant_id is not null
    from ids
    left join moves on moves.variant_id = ids.variant_id
    left join terms on terms.variant_id = ids.variant_id
    left join incoming on incoming.variant_id = ids.variant_id;
end;
$$;

create function public.admin_set_stock_watch_settings(
  p_sales_window_days integer,
  p_target_cover_days integer,
  p_safety_days integer,
  p_dead_stock_days integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before public.stock_watch_settings;
begin
  if not private.has_permission('settings.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_before from public.stock_watch_settings s where s.id for update;
  update public.stock_watch_settings s
  set sales_window_days = p_sales_window_days,
      target_cover_days = p_target_cover_days,
      safety_days = p_safety_days,
      dead_stock_days = p_dead_stock_days,
      updated_by = (select auth.uid()),
      updated_at = now()
  where s.id;
  insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
  values ((select auth.uid()), 'settings.stock_watch_updated', 'stock_watch_settings', null,
          jsonb_build_object('sales_window_days', v_before.sales_window_days,
                             'target_cover_days', v_before.target_cover_days,
                             'safety_days', v_before.safety_days,
                             'dead_stock_days', v_before.dead_stock_days),
          jsonb_build_object('sales_window_days', p_sales_window_days,
                             'target_cover_days', p_target_cover_days,
                             'safety_days', p_safety_days,
                             'dead_stock_days', p_dead_stock_days));
end;
$$;

-- ---------------------------------------------------------------------------
-- Permisos de ejecución y RLS
-- ---------------------------------------------------------------------------

revoke execute on function
  public.admin_list_suppliers(),
  public.admin_save_supplier(uuid, text, text, text, text, integer, text, boolean),
  public.admin_supplier_terms(uuid, uuid[]),
  public.admin_save_supplier_variant(uuid, uuid, text, integer, integer, boolean),
  public.admin_remove_supplier_variant(uuid, uuid),
  public.admin_assign_supplier_brand(uuid, uuid, boolean),
  public.admin_create_purchase_order(uuid, uuid, jsonb, date, text),
  public.admin_list_purchase_orders(text, uuid),
  public.admin_purchase_order_lines(uuid),
  public.admin_purchase_order_receipts(uuid),
  public.admin_update_purchase_order(uuid, integer, date, text, text),
  public.admin_set_purchase_order_lines(uuid, integer, jsonb),
  public.admin_transition_purchase_order(uuid, integer, text),
  public.admin_delete_purchase_order(uuid, integer),
  public.admin_receive_purchase_order(uuid, uuid, jsonb, text, boolean),
  public.admin_record_store_sale(uuid, text, jsonb, uuid, text),
  public.admin_stock_watch_facts(uuid),
  public.admin_set_stock_watch_settings(integer, integer, integer, integer)
  from public, anon;
grant execute on function
  public.admin_list_suppliers(),
  public.admin_save_supplier(uuid, text, text, text, text, integer, text, boolean),
  public.admin_supplier_terms(uuid, uuid[]),
  public.admin_save_supplier_variant(uuid, uuid, text, integer, integer, boolean),
  public.admin_remove_supplier_variant(uuid, uuid),
  public.admin_assign_supplier_brand(uuid, uuid, boolean),
  public.admin_create_purchase_order(uuid, uuid, jsonb, date, text),
  public.admin_list_purchase_orders(text, uuid),
  public.admin_purchase_order_lines(uuid),
  public.admin_purchase_order_receipts(uuid),
  public.admin_update_purchase_order(uuid, integer, date, text, text),
  public.admin_set_purchase_order_lines(uuid, integer, jsonb),
  public.admin_transition_purchase_order(uuid, integer, text),
  public.admin_delete_purchase_order(uuid, integer),
  public.admin_receive_purchase_order(uuid, uuid, jsonb, text, boolean),
  public.admin_record_store_sale(uuid, text, jsonb, uuid, text),
  public.admin_stock_watch_facts(uuid),
  public.admin_set_stock_watch_settings(integer, integer, integer, integer)
  to authenticated;

-- Tablas públicas nuevas: lectura con inventory.view; nadie escribe directamente.
alter table public.store_sales enable row level security;
alter table public.store_sale_lines enable row level security;
alter table public.stock_watch_settings enable row level security;

revoke all on public.store_sales, public.store_sale_lines,
  public.stock_watch_settings from anon;
revoke insert, update, delete, truncate on public.store_sales,
  public.store_sale_lines, public.stock_watch_settings from authenticated;

create policy "inventory.view lee ventas de mostrador" on public.store_sales
  for select to authenticated using ((select private.has_permission('inventory.view')));
create policy "inventory.view lee líneas de mostrador" on public.store_sale_lines
  for select to authenticated using ((select private.has_permission('inventory.view')));
create policy "inventory.view lee parámetros del vigilante" on public.stock_watch_settings
  for select to authenticated using ((select private.has_permission('inventory.view')));
