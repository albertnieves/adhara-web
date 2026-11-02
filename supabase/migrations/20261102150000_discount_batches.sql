-- Códigos únicos por suscriptor (DECISIONS §185).
--
-- Un lote es un conjunto de códigos de descuento normales, de un solo uso y
-- con las mismas condiciones: uno para cada suscriptor activo del Club (para
-- importarlos en Sender y enviarlos a cada uno) o un número fijo sin
-- destinatario. Cada código es una fila más de discount_codes con
-- max_uses = 1, así que la tienda y web_order_create no cambian: el lote solo
-- los crea, los agrupa en el panel, los descarga en CSV y los apaga.
--
-- Quién recibe cada código es un dato personal: va en su propia tabla, que
-- solo lee quien tiene promotions.manage y customers.view, y se borra al
-- borrar al suscriptor. La auditoría guarda el lote y cuántos códigos, nunca
-- los emails.

-- ---------------------------------------------------------------------------
-- Lotes y destinatarios
-- ---------------------------------------------------------------------------

create table public.discount_batches (
  id uuid primary key default gen_random_uuid(),
  -- Nombre de la campaña; se copia en la descripción de cada código.
  name text not null check (char_length(name) between 1 and 120),
  -- Delante de cada código: CLUB → CLUB-7KQ4MZ9X.
  prefix text not null check (prefix ~ '^[A-Z0-9]{2,10}$'),
  -- subscribers: uno para cada suscriptor activo al crearlo; count: un
  -- número fijo, sin destinatario.
  audience text not null check (audience in ('subscribers', 'count')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index discount_batches_created_by_idx on public.discount_batches (created_by);

alter table public.discount_batches enable row level security;
revoke all on public.discount_batches from anon;
revoke insert, update, delete, truncate on public.discount_batches from authenticated;

create policy "el personal de promociones lee los lotes" on public.discount_batches
  for select to authenticated
  using ((select private.has_permission('promotions.manage')));

alter table public.discount_codes
  add column batch_id uuid references public.discount_batches (id) on delete restrict;

create index discount_codes_batch_idx on public.discount_codes (batch_id)
  where batch_id is not null;

create table public.discount_code_recipients (
  code_id uuid primary key references public.discount_codes (id) on delete cascade,
  email text not null check (
    char_length(email) <= 254
    and email = lower(email)
    and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  )
);

create index discount_code_recipients_email_idx on public.discount_code_recipients (email);

alter table public.discount_code_recipients enable row level security;
revoke all on public.discount_code_recipients from anon;
revoke insert, update, delete, truncate on public.discount_code_recipients from authenticated;

create policy "promociones y clientes leen a quién va cada código"
  on public.discount_code_recipients
  for select to authenticated
  using ((select private.has_permission('promotions.manage'))
         and (select private.has_permission('customers.view')));

-- Borrar a un suscriptor (derecho de supresión) borra a quién se dio cada
-- código; el código sigue valiendo, sin destinatario.
create function private.forget_discount_recipient()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.discount_code_recipients r where r.email = old.email;
  return old;
end;
$$;

revoke all on function private.forget_discount_recipient() from public, anon, authenticated;

create trigger newsletter_subscribers_forget_codes
  after delete on public.newsletter_subscribers
  for each row execute function private.forget_discount_recipient();

-- ---------------------------------------------------------------------------
-- Crear un lote
-- ---------------------------------------------------------------------------

-- PREFIJO-XXXXXXXX con 8 caracteres al azar de un alfabeto sin 0, O, 1 ni I
-- (32 símbolos, 40 bits): imposible de adivinar probando en «Aplicar».
create function private.discount_batch_code(p_prefix text)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea := extensions.gen_random_bytes(8);
  v_code text := p_prefix || '-';
begin
  for v_i in 0..7 loop
    v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, v_i) % 32) + 1, 1);
  end loop;
  return v_code;
end;
$$;

revoke all on function private.discount_batch_code(text) from public, anon, authenticated;

-- Crea el lote y sus códigos (como mucho 5.000) en una sola transacción.
-- Con p_audience = 'subscribers' hace falta además customers.view: lee los
-- emails del Club. Cada código: un uso, un uso por email y las condiciones
-- del lote; la tienda lo trata como cualquier otro.
create function public.admin_create_discount_batch(
  p_name text,
  p_prefix text,
  p_kind text,
  p_percent_bp integer,
  p_amount_cents integer,
  p_min_items_cents integer,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_exclude_sale_items boolean,
  p_audience text,
  p_count integer
)
returns public.discount_batches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_batch public.discount_batches;
  v_name text := btrim(coalesce(p_name, ''));
  v_prefix text := upper(btrim(coalesce(p_prefix, '')));
  v_recipients text[];
  v_total integer;
  v_code_id uuid;
begin
  if not private.has_permission('promotions.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_audience is null or p_audience not in ('subscribers', 'count')
     or p_kind is null or p_kind not in ('percent', 'amount')
     or p_exclude_sale_items is null then
    raise exception 'invalid_batch' using errcode = '22023';
  end if;
  if p_audience = 'subscribers' then
    if not private.has_permission('customers.view') then
      raise exception 'forbidden' using errcode = '42501';
    end if;
    select array_agg(n.email order by n.consented_at, n.email) into v_recipients
    from public.newsletter_subscribers n
    where n.unsubscribed_at is null;
    v_total := coalesce(array_length(v_recipients, 1), 0);
    if v_total = 0 then
      raise exception 'no_recipients' using errcode = '22023';
    end if;
  else
    v_total := p_count;
  end if;
  if v_total is null or v_total not between 1 and 5000 then
    raise exception 'invalid_batch_size' using errcode = '22023';
  end if;
  begin
    insert into public.discount_batches (name, prefix, audience, created_by)
    values (v_name, v_prefix, p_audience, v_actor)
    returning * into v_batch;
  exception
    when check_violation then
      raise exception 'invalid_batch' using errcode = '22023';
  end;
  for v_i in 1..v_total loop
    v_code_id := null;
    -- Una colisión con un código que ya existe es casi imposible; si pasa,
    -- se sortea otro.
    while v_code_id is null loop
      begin
        insert into public.discount_codes (
          code, description, kind, percent_bp, amount_cents, min_items_cents,
          starts_at, ends_at, max_uses, once_per_email, exclude_sale_items, active,
          created_by, updated_by, batch_id
        ) values (
          private.discount_batch_code(v_prefix), v_name, p_kind,
          case when p_kind = 'percent' then p_percent_bp end,
          case when p_kind = 'amount' then p_amount_cents end,
          p_min_items_cents, p_starts_at, p_ends_at, 1, true, p_exclude_sale_items, true,
          v_actor, v_actor, v_batch.id
        )
        on conflict (code) do nothing
        returning id into v_code_id;
      exception
        when check_violation then
          raise exception 'invalid_discount' using errcode = '22023';
      end;
    end loop;
    if p_audience = 'subscribers' then
      insert into public.discount_code_recipients (code_id, email)
      values (v_code_id, v_recipients[v_i]);
    end if;
  end loop;
  insert into public.audit_log (actor_id, action, entity, entity_id, after)
  values (v_actor, 'promotions.batch_create', 'discount_batch', v_batch.id::text,
          jsonb_build_object(
            'name', v_name, 'prefix', v_prefix, 'audience', p_audience, 'codes', v_total,
            'kind', p_kind,
            'percent_bp', case when p_kind = 'percent' then p_percent_bp end,
            'amount_cents', case when p_kind = 'amount' then p_amount_cents end,
            'min_items_cents', p_min_items_cents, 'starts_at', p_starts_at,
            'ends_at', p_ends_at, 'exclude_sale_items', p_exclude_sale_items
          ));
  return v_batch;
end;
$$;

-- ---------------------------------------------------------------------------
-- Ver, descargar y apagar un lote
-- ---------------------------------------------------------------------------

-- Lotes con sus condiciones (las del primer código: todas son iguales) y sus
-- usos. Sin datos de clientes.
create function public.admin_list_discount_batches()
returns table (
  id uuid,
  name text,
  prefix text,
  audience text,
  created_at timestamptz,
  kind text,
  percent_bp integer,
  amount_cents integer,
  min_items_cents integer,
  starts_at timestamptz,
  ends_at timestamptz,
  exclude_sale_items boolean,
  codes integer,
  active_codes integer,
  used_codes integer,
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
  select b.id, b.name, b.prefix, b.audience, b.created_at,
         f.kind, f.percent_bp, f.amount_cents, f.min_items_cents, f.starts_at, f.ends_at,
         f.exclude_sale_items,
         (select count(*)::integer from public.discount_codes d where d.batch_id = b.id),
         (select count(*)::integer from public.discount_codes d
          where d.batch_id = b.id and d.active),
         (select count(*)::integer from public.discount_codes d
          where d.batch_id = b.id and private.discount_code_uses(d.id) > 0),
         (select count(*)::integer from public.orders o
          join public.discount_codes d on d.id = o.discount_code_id
          where d.batch_id = b.id and o.paid_at is not null),
         (select coalesce(sum(o.discount_cents), 0)::bigint from public.orders o
          join public.discount_codes d on d.id = o.discount_code_id
          where d.batch_id = b.id and o.paid_at is not null)
  from public.discount_batches b
  cross join lateral (
    select d.kind, d.percent_bp, d.amount_cents, d.min_items_cents, d.starts_at,
           d.ends_at, d.exclude_sale_items
    from public.discount_codes d
    where d.batch_id = b.id
    order by d.created_at, d.code
    limit 1
  ) f
  order by b.created_at desc;
end;
$$;

-- Los códigos de un lote para el CSV de Sender, con su destinatario solo si
-- además hay customers.view. Deja la descarga en la auditoría (sin emails).
create function public.admin_discount_batch_codes(p_batch_id uuid)
returns table (code text, email text, active boolean, used boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_people boolean := private.has_permission('customers.view');
begin
  if not private.has_permission('promotions.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.discount_batches b where b.id = p_batch_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  insert into public.audit_log (actor_id, action, entity, entity_id, after)
  values ((select auth.uid()), 'promotions.batch_export', 'discount_batch', p_batch_id::text,
          jsonb_build_object('with_recipients', v_people));
  return query
  select d.code, case when v_people then r.email end, d.active,
         private.discount_code_uses(d.id) > 0
  from public.discount_codes d
  left join public.discount_code_recipients r on r.code_id = d.id
  where d.batch_id = p_batch_id
  order by r.email nulls last, d.code;
end;
$$;

-- Enciende o apaga todos los códigos del lote. Devuelve cuántos cambian.
create function public.admin_set_discount_batch_active(p_batch_id uuid, p_active boolean)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_changed integer;
begin
  if not private.has_permission('promotions.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_active is null then
    raise exception 'invalid_batch' using errcode = '22023';
  end if;
  if not exists (select 1 from public.discount_batches b where b.id = p_batch_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  update public.discount_codes d
  set active = p_active, updated_by = (select auth.uid())
  where d.batch_id = p_batch_id and d.active is distinct from p_active;
  get diagnostics v_changed = row_count;
  insert into public.audit_log (actor_id, action, entity, entity_id, after)
  values ((select auth.uid()), 'promotions.batch_active', 'discount_batch', p_batch_id::text,
          jsonb_build_object('active', p_active, 'changed', v_changed));
  return v_changed;
end;
$$;

-- La lista de códigos del panel deja fuera los de los lotes, que se ven
-- agrupados (§185). Misma firma y resultado que en 20261015120000.
create or replace function public.admin_list_discount_codes()
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
  where d.batch_id is null
  order by d.created_at desc;
end;
$$;

revoke all on function
  public.admin_create_discount_batch(text, text, text, integer, integer, integer,
    timestamptz, timestamptz, boolean, text, integer),
  public.admin_list_discount_batches(),
  public.admin_discount_batch_codes(uuid),
  public.admin_set_discount_batch_active(uuid, boolean)
  from public, anon;
grant execute on function
  public.admin_create_discount_batch(text, text, text, integer, integer, integer,
    timestamptz, timestamptz, boolean, text, integer),
  public.admin_list_discount_batches(),
  public.admin_discount_batch_codes(uuid),
  public.admin_set_discount_batch_active(uuid, boolean)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Derecho de acceso: la exportación del cliente (§184) incluye los códigos
-- que se le dieron. Igual que en 20261102120000 más `discount_codes`.
-- ---------------------------------------------------------------------------

create or replace function public.admin_customer_export(p_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_email text;
  v_data jsonb;
begin
  if not private.has_permission('customers.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  v_email := private.customer_email_for_key(p_key);
  if v_email is null then
    raise exception 'unknown_customer' using errcode = '22023';
  end if;
  v_data := jsonb_build_object(
    'email', v_email,
    'generated_at', now(),
    'account', (
      select jsonb_build_object(
        'full_name', a.full_name,
        'phone', a.phone,
        'locale', a.locale,
        'address_line1', a.address_line1,
        'address_line2', a.address_line2,
        'postal_code', a.postal_code,
        'city', a.city,
        'province', a.province,
        'created_at', a.created_at,
        'updated_at', a.updated_at,
        'email_confirmed_at', u.email_confirmed_at,
        'last_sign_in_at', u.last_sign_in_at,
        'sign_in_methods', coalesce(u.raw_app_meta_data -> 'providers', '[]'::jsonb)
      )
      from public.customer_accounts a
      join auth.users u on u.id = a.user_id
      where lower(u.email::text) = v_email
      limit 1
    ),
    'newsletter', (
      select jsonb_build_object(
        'email', n.email,
        'locale', n.locale,
        'source', n.source,
        'consent_version', n.consent_version,
        'consented_at', n.consented_at,
        'unsubscribed_at', n.unsubscribed_at
      )
      from public.newsletter_subscribers n
      where n.email = v_email
    ),
    'orders', coalesce((
      select jsonb_agg(jsonb_build_object(
        'number', o.number,
        'created_at', o.created_at,
        'locale', o.locale,
        'status', o.status,
        'fulfillment', o.fulfillment,
        'items_cents', o.items_cents,
        'discount_code', o.discount_code,
        'discount_cents', o.discount_cents,
        'shipping_cents', o.shipping_cents,
        'shipping_service', o.shipping_service_label,
        'total_cents', o.total_cents,
        'paid_at', o.paid_at,
        'tracking_reference', o.tracking_reference,
        'with_account', o.customer_id is not null,
        'contact', jsonb_build_object(
          'full_name', c.full_name,
          'email', c.email,
          'phone', c.phone,
          'address_line1', c.address_line1,
          'address_line2', c.address_line2,
          'postal_code', c.postal_code,
          'city', c.city,
          'province', c.province,
          'country', c.country
        ),
        'lines', coalesce((
          select jsonb_agg(jsonb_build_object(
            'brand', l.brand_name,
            'product', l.product_name,
            'format', l.variant_label,
            'size_ml', l.size_ml,
            'quantity', l.quantity,
            'unit_price_cents', l.unit_price_cents,
            'line_total_cents', l.line_total_cents
          ) order by l.product_name, l.size_ml)
          from public.order_lines l
          where l.order_id = o.id
        ), '[]'::jsonb),
        'payments', coalesce((
          select jsonb_agg(jsonb_build_object(
            'provider', p.provider,
            'outcome', p.outcome,
            'amount_cents', p.amount_cents,
            'received_at', p.received_at
          ) order by p.received_at)
          from public.order_payments p
          where p.order_id = o.id
        ), '[]'::jsonb),
        'refunds', coalesce((
          select jsonb_agg(jsonb_build_object(
            'amount_cents', r.amount_cents,
            'status', r.status,
            'created_at', r.created_at,
            'resolved_at', r.resolved_at
          ) order by r.created_at)
          from public.order_refunds r
          where r.order_id = o.id
        ), '[]'::jsonb)
      ) order by o.created_at)
      from public.order_contacts c
      join public.orders o on o.id = c.order_id
      where lower(btrim(c.email)) = v_email
    ), '[]'::jsonb),
    'discount_codes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', d.code,
        'campaign', b.name,
        'assigned_at', b.created_at,
        'used', private.discount_code_uses(d.id) > 0
      ) order by b.created_at, d.code)
      from public.discount_code_recipients r
      join public.discount_codes d on d.id = r.code_id
      join public.discount_batches b on b.id = d.batch_id
      where r.email = v_email
    ), '[]'::jsonb),
    'conversations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'number', cv.number,
        'created_at', cv.created_at,
        'channel', cv.channel,
        'status', cv.status,
        'topic', cv.topic,
        'subject', cv.subject,
        'locale', cv.locale,
        'order_number', o.number,
        'full_name', cc.full_name,
        'messages', coalesce((
          select jsonb_agg(jsonb_build_object(
            'kind', m.kind,
            'source', m.source,
            'body', m.body,
            'attachments', m.attachments,
            'created_at', m.created_at
          ) order by m.created_at, m.id)
          from public.conversation_messages m
          where m.conversation_id = cv.id
        ), '[]'::jsonb)
      ) order by cv.created_at)
      from public.conversation_contacts cc
      join public.conversations cv on cv.id = cc.conversation_id
      left join public.orders o on o.id = cv.order_id
      where cc.email = v_email
    ), '[]'::jsonb)
  );
  insert into public.audit_log (actor_id, action, entity, entity_id, after)
  values (v_actor, 'customers.export', 'customer', p_key,
          jsonb_build_object(
            'orders', jsonb_array_length(v_data -> 'orders'),
            'conversations', jsonb_array_length(v_data -> 'conversations'),
            'account', v_data -> 'account' <> 'null'::jsonb,
            'newsletter', v_data -> 'newsletter' <> 'null'::jsonb
          ));
  return v_data;
end;
$$;

-- ---------------------------------------------------------------------------
-- Copia diaria: los lotes antes que sus códigos y los destinatarios después
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
