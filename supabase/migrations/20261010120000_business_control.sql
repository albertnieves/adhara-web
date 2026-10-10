-- Control del negocio y del proyecto (/admin/control, DECISIONS §113–117).
-- Solo el administrador del sistema con MFA (permiso business.control). Las
-- tareas, los costes y las entregas viven en internal, fuera de la API de
-- datos, y solo se leen y escriben con las funciones admin_control_*. La
-- auditoría guarda quién y qué, nunca importes.
--
-- El mostrador pasa a guardar el precio cobrado por línea (revisa §59; §114): las
-- ventas y el beneficio del negocio salen de ahí, y lo anterior se estima con
-- el PVP vigente.

-- ---------------------------------------------------------------------------
-- Permiso
-- ---------------------------------------------------------------------------

insert into public.permissions (code, requires_aal2) values
  ('business.control', true);

insert into public.role_permissions (role, permission) values
  ('system_admin', 'business.control');

-- ---------------------------------------------------------------------------
-- Precio cobrado en el mostrador
-- ---------------------------------------------------------------------------

-- Precio por unidad con IVA, en céntimos: el cobrado (con descuento si lo
-- hubo) y el PVP vigente en ese momento. Null en las ventas anteriores a esta
-- migración y cuando el formato no tenía PVP ni se indicó precio.
alter table public.store_sale_lines
  add column unit_price_cents integer
    check (unit_price_cents between 0 and 10000000),
  add column retail_price_cents integer
    check (retail_price_cents between 0 and 10000000);

-- Misma firma que la de la fase R: cada línea admite unit_price_cents. Sin él,
-- se cobra el PVP vigente. Con él, no puede superar el PVP (solo descuentos):
-- protege de un cero de más al teclear.
create or replace function public.admin_record_store_sale(
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
  v_raw jsonb;
  v_price numeric;
  v_retail integer;
  v_charged integer;
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
    select v.retail_price_cents into v_retail
    from public.product_variants v where v.id = v_item.variant_id;
    select e -> 'unit_price_cents' into v_raw
    from jsonb_array_elements(p_items) e
    where e ->> 'variant_id' = v_item.variant_id::text
    limit 1;
    if v_raw is null or jsonb_typeof(v_raw) = 'null' then
      v_charged := v_retail;
    else
      if jsonb_typeof(v_raw) <> 'number' then
        raise exception 'invalid_amount' using errcode = '22023';
      end if;
      v_price := (v_raw #>> '{}')::numeric;
      if v_price <> trunc(v_price) or v_price < 0 or v_price > 10000000 then
        raise exception 'invalid_amount' using errcode = '22023';
      end if;
      if v_retail is not null and v_price > v_retail then
        raise exception 'price_above_retail' using errcode = '22023',
          detail = v_item.variant_id::text;
      end if;
      v_charged := v_price::integer;
    end if;

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
    insert into public.store_sale_lines (
      sale_id, variant_id, quantity, movement_id, unit_price_cents, retail_price_cents
    ) values (
      v_sale.id, v_item.variant_id, v_item.quantity, v_movement.id, v_charged, v_retail
    );
  end loop;
  drop table pg_temp.sale_items;

  insert into public.audit_log (actor_id, action, entity, entity_id, after)
  values ((select auth.uid()), 'inventory.store_' || p_kind, 'store_sale', v_sale.id::text,
          jsonb_build_object('units', v_units, 'ticket_ref', v_sale.ticket_ref));
  return v_sale;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tareas, costes y entregas (internal)
-- ---------------------------------------------------------------------------

-- Área: «project» es el trabajo con el cliente (la web y el panel); «business»
-- es la operación de la perfumería.
create table internal.control_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  area text not null check (area in ('project', 'business')),
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'blocked', 'done')),
  priority text not null default 'normal' check (priority in ('high', 'normal', 'low')),
  -- Quién tiene que moverla: tú, el cliente u otra persona.
  owner text not null default 'me' check (owner in ('me', 'client', 'other')),
  due_on date,
  notes text check (char_length(notes) <= 2000),
  completed_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint completed_only_when_done check ((status = 'done') = (completed_at is not null))
);

create index control_tasks_status_idx on internal.control_tasks (status, due_on);

create trigger control_tasks_updated_at
  before update on internal.control_tasks
  for each row execute function private.set_updated_at();

-- Costes fijos o puntuales, netos (sin IVA). Los del negocio cuentan en su
-- beneficio; los del proyecto, en el balance del proyecto.
create table internal.control_costs (
  id uuid primary key default gen_random_uuid(),
  concept text not null check (char_length(btrim(concept)) between 1 and 120),
  area text not null check (area in ('project', 'business')),
  category text not null check (category in (
    'hosting', 'software', 'marketing', 'rent', 'supplies', 'staff',
    'advisory', 'logistics', 'fees', 'other'
  )),
  amount_net_cents integer not null check (amount_net_cents between 0 and 100000000),
  frequency text not null check (frequency in ('monthly', 'yearly', 'once')),
  starts_on date not null,
  ends_on date,
  notes text check (char_length(notes) <= 1000),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ends_after_start check (ends_on is null or ends_on >= starts_on)
);

create index control_costs_area_idx on internal.control_costs (area, starts_on);

create trigger control_costs_updated_at
  before update on internal.control_costs
  for each row execute function private.set_updated_at();

-- Entregas del proyecto al cliente, con su importe y su cobro. Sin estado de
-- facturación (null) cuando aún no se ha decidido.
create table internal.control_deliveries (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  description text check (char_length(description) <= 2000),
  status text not null default 'planned'
    check (status in ('planned', 'in_progress', 'delivered', 'accepted')),
  due_on date,
  delivered_on date,
  reference text check (char_length(reference) <= 300),
  amount_net_cents integer check (amount_net_cents between 0 and 100000000),
  billing_status text check (billing_status in ('none', 'pending', 'invoiced', 'paid')),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index control_deliveries_status_idx on internal.control_deliveries (status, due_on);

create trigger control_deliveries_updated_at
  before update on internal.control_deliveries
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Funciones (todas exigen business.control, que exige MFA)
-- ---------------------------------------------------------------------------

create function private.require_business_control()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not private.has_permission('business.control') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$$;

create function public.admin_control_tasks()
returns table (
  id uuid,
  title text,
  area text,
  status text,
  priority text,
  owner text,
  due_on date,
  notes text,
  completed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_business_control();
  return query
    select t.id, t.title, t.area, t.status, t.priority, t.owner, t.due_on,
           t.notes, t.completed_at, t.created_at, t.updated_at
    from internal.control_tasks t
    order by t.created_at, t.id;
end;
$$;

create function public.admin_control_save_task(
  p_id uuid,
  p_title text,
  p_area text,
  p_status text,
  p_priority text,
  p_owner text,
  p_due_on date default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before internal.control_tasks;
  v_after internal.control_tasks;
begin
  perform private.require_business_control();
  if p_id is null then
    insert into internal.control_tasks (
      title, area, status, priority, owner, due_on, notes, completed_at, created_by
    ) values (
      btrim(p_title), p_area, p_status, p_priority, p_owner, p_due_on,
      nullif(btrim(p_notes), ''),
      case when p_status = 'done' then now() end,
      (select auth.uid())
    )
    returning * into v_after;
  else
    select * into v_before from internal.control_tasks t where t.id = p_id for update;
    if not found then
      raise exception 'unknown_record' using errcode = '22023';
    end if;
    update internal.control_tasks t
    set title = btrim(p_title),
        area = p_area,
        status = p_status,
        priority = p_priority,
        owner = p_owner,
        due_on = p_due_on,
        notes = nullif(btrim(p_notes), ''),
        completed_at = case
          when p_status <> 'done' then null
          else coalesce(v_before.completed_at, now())
        end
    where t.id = p_id
    returning * into v_after;
  end if;

  insert into public.audit_log (actor_id, action, entity, entity_id, after)
  values ((select auth.uid()),
          case when p_id is null then 'control.task_created' else 'control.task_updated' end,
          'control_task', v_after.id::text,
          jsonb_build_object('title', v_after.title, 'status', v_after.status));
  return v_after.id;
end;
$$;

-- Marcar como hecha o reabrir desde la lista, sin abrir el formulario.
create function public.admin_control_set_task_status(p_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_after internal.control_tasks;
begin
  perform private.require_business_control();
  update internal.control_tasks t
  set status = p_status,
      completed_at = case
        when p_status <> 'done' then null
        else coalesce(t.completed_at, now())
      end
  where t.id = p_id
  returning * into v_after;
  if not found then
    raise exception 'unknown_record' using errcode = '22023';
  end if;
  insert into public.audit_log (actor_id, action, entity, entity_id, after)
  values ((select auth.uid()), 'control.task_updated', 'control_task', p_id::text,
          jsonb_build_object('title', v_after.title, 'status', v_after.status));
end;
$$;

create function public.admin_control_delete_task(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text;
begin
  perform private.require_business_control();
  delete from internal.control_tasks t where t.id = p_id returning t.title into v_title;
  if not found then
    raise exception 'unknown_record' using errcode = '22023';
  end if;
  insert into public.audit_log (actor_id, action, entity, entity_id, before)
  values ((select auth.uid()), 'control.task_deleted', 'control_task', p_id::text,
          jsonb_build_object('title', v_title));
end;
$$;

create function public.admin_control_costs()
returns table (
  id uuid,
  concept text,
  area text,
  category text,
  amount_net_cents integer,
  frequency text,
  starts_on date,
  ends_on date,
  notes text,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_business_control();
  return query
    select c.id, c.concept, c.area, c.category, c.amount_net_cents, c.frequency,
           c.starts_on, c.ends_on, c.notes, c.updated_at
    from internal.control_costs c
    order by c.starts_on, c.concept, c.id;
end;
$$;

create function public.admin_control_save_cost(
  p_id uuid,
  p_concept text,
  p_area text,
  p_category text,
  p_amount_net_cents integer,
  p_frequency text,
  p_starts_on date,
  p_ends_on date default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform private.require_business_control();
  if p_id is null then
    insert into internal.control_costs (
      concept, area, category, amount_net_cents, frequency, starts_on, ends_on,
      notes, created_by
    ) values (
      btrim(p_concept), p_area, p_category, p_amount_net_cents, p_frequency,
      p_starts_on, case when p_frequency = 'once' then null else p_ends_on end,
      nullif(btrim(p_notes), ''), (select auth.uid())
    )
    returning id into v_id;
  else
    update internal.control_costs c
    set concept = btrim(p_concept),
        area = p_area,
        category = p_category,
        amount_net_cents = p_amount_net_cents,
        frequency = p_frequency,
        starts_on = p_starts_on,
        ends_on = case when p_frequency = 'once' then null else p_ends_on end,
        notes = nullif(btrim(p_notes), '')
    where c.id = p_id
    returning c.id into v_id;
    if v_id is null then
      raise exception 'unknown_record' using errcode = '22023';
    end if;
  end if;

  insert into public.audit_log (actor_id, action, entity, entity_id, after)
  values ((select auth.uid()),
          case when p_id is null then 'control.cost_created' else 'control.cost_updated' end,
          'control_cost', v_id::text, jsonb_build_object('concept', btrim(p_concept)));
  return v_id;
end;
$$;

create function public.admin_control_delete_cost(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_concept text;
begin
  perform private.require_business_control();
  delete from internal.control_costs c where c.id = p_id returning c.concept into v_concept;
  if not found then
    raise exception 'unknown_record' using errcode = '22023';
  end if;
  insert into public.audit_log (actor_id, action, entity, entity_id, before)
  values ((select auth.uid()), 'control.cost_deleted', 'control_cost', p_id::text,
          jsonb_build_object('concept', v_concept));
end;
$$;

create function public.admin_control_deliveries()
returns table (
  id uuid,
  title text,
  description text,
  status text,
  due_on date,
  delivered_on date,
  reference text,
  amount_net_cents integer,
  billing_status text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_business_control();
  return query
    select d.id, d.title, d.description, d.status, d.due_on, d.delivered_on,
           d.reference, d.amount_net_cents, d.billing_status, d.created_at,
           d.updated_at
    from internal.control_deliveries d
    order by d.created_at, d.id;
end;
$$;

create function public.admin_control_save_delivery(
  p_id uuid,
  p_title text,
  p_status text,
  p_description text default null,
  p_due_on date default null,
  p_delivered_on date default null,
  p_reference text default null,
  p_amount_net_cents integer default null,
  p_billing_status text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform private.require_business_control();
  if p_id is null then
    insert into internal.control_deliveries (
      title, description, status, due_on, delivered_on, reference,
      amount_net_cents, billing_status, created_by
    ) values (
      btrim(p_title), nullif(btrim(p_description), ''), p_status, p_due_on,
      p_delivered_on, nullif(btrim(p_reference), ''), p_amount_net_cents,
      p_billing_status, (select auth.uid())
    )
    returning id into v_id;
  else
    update internal.control_deliveries d
    set title = btrim(p_title),
        description = nullif(btrim(p_description), ''),
        status = p_status,
        due_on = p_due_on,
        delivered_on = p_delivered_on,
        reference = nullif(btrim(p_reference), ''),
        amount_net_cents = p_amount_net_cents,
        billing_status = p_billing_status
    where d.id = p_id
    returning d.id into v_id;
    if v_id is null then
      raise exception 'unknown_record' using errcode = '22023';
    end if;
  end if;

  insert into public.audit_log (actor_id, action, entity, entity_id, after)
  values ((select auth.uid()),
          case when p_id is null then 'control.delivery_created'
               else 'control.delivery_updated' end,
          'control_delivery', v_id::text,
          jsonb_build_object('title', btrim(p_title), 'status', p_status));
  return v_id;
end;
$$;

create function public.admin_control_delete_delivery(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text;
begin
  perform private.require_business_control();
  delete from internal.control_deliveries d where d.id = p_id returning d.title into v_title;
  if not found then
    raise exception 'unknown_record' using errcode = '22023';
  end if;
  insert into public.audit_log (actor_id, action, entity, entity_id, before)
  values ((select auth.uid()), 'control.delivery_deleted', 'control_delivery', p_id::text,
          jsonb_build_object('title', v_title));
end;
$$;

-- Hechos del negocio por mes (Europe/Madrid) y formato en [p_from, p_to):
-- unidades vendidas y devueltas (todas las ventas, también las registradas
-- desde Inventario), importe cobrado de las líneas de mostrador con precio,
-- coste de lo vendido con el coste vigente en cada movimiento y compras
-- recibidas a coste. El PVP vigente permite estimar lo que no tiene precio.
create function public.admin_control_month_facts(p_from date, p_to date)
returns table (
  month date,
  variant_id uuid,
  sold_units integer,
  returned_units integer,
  priced_sold_units integer,
  sold_gross_cents bigint,
  priced_returned_units integer,
  returned_gross_cents bigint,
  cogs_net_cents bigint,
  uncosted_units integer,
  received_units integer,
  received_net_cents bigint,
  uncosted_received_units integer,
  retail_price_cents integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_business_control();
  if p_from is null or p_to is null or p_from >= p_to or p_to > p_from + 1830 then
    raise exception 'invalid_period' using errcode = '22023';
  end if;
  return query
    with moves as (
      select date_trunc('month', mv.created_at at time zone 'Europe/Madrid')::date as m,
             mv.variant_id as vid,
             private.movement_report_bucket(mv.type) as bucket,
             mv.type,
             abs(mv.delta_on_hand) as units,
             l.unit_price_cents as price,
             c.cost_net_cents as cost
      from public.inventory_movements mv
      left join public.store_sale_lines l on l.movement_id = mv.id
      left join lateral private.variant_cost_for(mv.variant_id, mv.created_at) c on true
      where mv.created_at >= (p_from::timestamp at time zone 'Europe/Madrid')
        and mv.created_at < (p_to::timestamp at time zone 'Europe/Madrid')
        and (private.movement_report_bucket(mv.type) in ('sold', 'returned')
             or mv.type = 'PURCHASE_RECEIPT')
        and mv.delta_on_hand <> 0
    )
    select x.m, x.vid,
           coalesce(sum(x.units) filter (where x.bucket = 'sold'), 0)::integer,
           coalesce(sum(x.units) filter (where x.bucket = 'returned'), 0)::integer,
           coalesce(sum(x.units) filter (where x.bucket = 'sold' and x.price is not null), 0)::integer,
           coalesce(sum(x.units::bigint * x.price) filter (where x.bucket = 'sold'), 0)::bigint,
           coalesce(sum(x.units) filter (where x.bucket = 'returned' and x.price is not null), 0)::integer,
           coalesce(sum(x.units::bigint * x.price) filter (where x.bucket = 'returned'), 0)::bigint,
           (coalesce(sum(x.units::bigint * x.cost) filter (where x.bucket = 'sold'), 0)
            - coalesce(sum(x.units::bigint * x.cost) filter (where x.bucket = 'returned'), 0))::bigint,
           coalesce(sum(x.units) filter (
             where x.bucket in ('sold', 'returned') and x.cost is null), 0)::integer,
           coalesce(sum(x.units) filter (where x.type = 'PURCHASE_RECEIPT'), 0)::integer,
           coalesce(sum(x.units::bigint * x.cost) filter (where x.type = 'PURCHASE_RECEIPT'), 0)::bigint,
           coalesce(sum(x.units) filter (
             where x.type = 'PURCHASE_RECEIPT' and x.cost is null), 0)::integer,
           (select v.retail_price_cents from public.product_variants v where v.id = x.vid)
    from moves x
    group by x.m, x.vid
    order by x.m, x.vid;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permisos de ejecución
-- ---------------------------------------------------------------------------

-- Auxiliar de las funciones security definer: nadie la llama directamente.
revoke execute on function private.require_business_control() from public, anon, authenticated;

revoke execute on function
  public.admin_control_tasks(),
  public.admin_control_save_task(uuid, text, text, text, text, text, date, text),
  public.admin_control_set_task_status(uuid, text),
  public.admin_control_delete_task(uuid),
  public.admin_control_costs(),
  public.admin_control_save_cost(uuid, text, text, text, integer, text, date, date, text),
  public.admin_control_delete_cost(uuid),
  public.admin_control_deliveries(),
  public.admin_control_save_delivery(uuid, text, text, text, date, date, text, integer, text),
  public.admin_control_delete_delivery(uuid),
  public.admin_control_month_facts(date, date)
  from public, anon;
grant execute on function
  public.admin_control_tasks(),
  public.admin_control_save_task(uuid, text, text, text, text, text, date, text),
  public.admin_control_set_task_status(uuid, text),
  public.admin_control_delete_task(uuid),
  public.admin_control_costs(),
  public.admin_control_save_cost(uuid, text, text, text, integer, text, date, date, text),
  public.admin_control_delete_cost(uuid),
  public.admin_control_deliveries(),
  public.admin_control_save_delivery(uuid, text, text, text, date, date, text, integer, text),
  public.admin_control_delete_delivery(uuid),
  public.admin_control_month_facts(date, date)
  to authenticated;
