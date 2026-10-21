-- Revisión de seguridad antes de cobrar (17/10/2026; DECISIONS §158–162 e
-- informe en docs/SECURITY_REVIEW_2026-10.md):
--   1. La procedencia de cada perfume (source_ref) sale de products, que lee
--      cualquiera, a product_sources, que solo lee el personal: nombraba al
--      proveedor y las unidades compradas.
--   2. Todo permiso del personal exige MFA también en SQL, también los de
--      lectura: con solo la contraseña se leían por la API directa los datos
--      de los clientes (order_contacts, newsletter_subscribers).
--   3. El rol del personal solo va a cuentas confirmadas y una invitación no
--      reutiliza una cuenta sin confirmar abierta por otra persona.
--   4. Freno de peticiones para las acciones públicas del checkout
--      (web_order_rate_limit, solo el servidor).

-- ---------------------------------------------------------------------------
-- 1. Procedencia solo para el personal
-- ---------------------------------------------------------------------------

create table public.product_sources (
  product_id uuid primary key references public.products (id) on delete cascade,
  source_ref text not null check (char_length(btrim(source_ref)) between 1 and 2000),
  updated_at timestamptz not null default now()
);

create trigger product_sources_updated_at
  before update on public.product_sources
  for each row execute function private.set_updated_at();
create trigger audit_sources
  after insert or update or delete on public.product_sources
  for each row execute function private.audit_catalog_change();

alter table public.product_sources enable row level security;
revoke all on public.product_sources from anon;
revoke truncate on public.product_sources from authenticated;

create policy "el personal lee la procedencia" on public.product_sources
  for select to authenticated using ((select private.is_staff()));
create policy "catalog.edit da de alta la procedencia" on public.product_sources
  for insert to authenticated
  with check ((select private.has_permission('catalog.edit')));
create policy "catalog.edit cambia la procedencia" on public.product_sources
  for update to authenticated
  using ((select private.has_permission('catalog.edit')))
  with check ((select private.has_permission('catalog.edit')));
create policy "catalog.edit borra la procedencia" on public.product_sources
  for delete to authenticated
  using ((select private.has_permission('catalog.edit')));

-- Copia sin pasar por la auditoría: es un traslado, no un cambio del personal.
alter table public.product_sources disable trigger audit_sources;
insert into public.product_sources (product_id, source_ref)
select p.id, btrim(p.source_ref)
from public.products p
where nullif(btrim(p.source_ref), '') is not null;
alter table public.product_sources enable trigger audit_sources;

alter table public.products drop column source_ref;

create or replace function public.admin_control_data_quality()
returns table (
  check_key text,
  severity text,
  product_id uuid,
  variant_id uuid,
  label text,
  detail text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_business_control();
  return query
    with prod as (
      select p.id as pid, p.status, ps.source_ref, b.name || ' · ' || p.name as plabel
      from public.products p
      join public.brands b on b.id = p.brand_id
      left join public.product_sources ps on ps.product_id = p.id
    ),
    var as (
      select v.id as vid, v.product_id as pid, v.active, v.sku,
             nullif(btrim(v.ean), '') as ean, v.retail_price_cents as price, x.status,
             x.plabel || ' · ' || coalesce(nullif(btrim(v.label), ''), v.size_ml || ' ml', '—')
               as vlabel
      from public.product_variants v
      join prod x on x.pid = v.product_id
    ),
    main_media as (
      select distinct on (m.product_id) m.product_id as pid, m.provisional, m.origin
      from public.product_media m
      order by m.product_id, (m.role = 'hero') desc, m.position, m.created_at, m.id
    ),
    ledger as (
      select coalesce(l.variant_id, mv.variant_id) as vid,
             coalesce(l.location_id, mv.location_id) as lid,
             coalesce(l.on_hand, 0)::bigint as on_hand,
             coalesce(l.reserved, 0)::bigint as reserved,
             coalesce(mv.on_hand, 0)::bigint as moved_on_hand,
             coalesce(mv.reserved, 0)::bigint as moved_reserved
      from public.inventory_levels l
      full join (
        select m.variant_id, m.location_id,
               sum(m.delta_on_hand) as on_hand, sum(m.delta_reserved) as reserved
        from public.inventory_movements m
        group by m.variant_id, m.location_id
      ) mv on mv.variant_id = l.variant_id and mv.location_id = l.location_id
    ),
    found as (
      select 'variant_without_price'::text as k, 'high'::text as s, v.pid, v.vid,
             v.vlabel as lbl, 'Formato activo sin PVP'::text as d
      from var v
      where v.status = 'published' and v.active and v.price is null
      union all
      select 'variant_without_cost', 'medium', v.pid, v.vid, v.vlabel,
             'Sin ningún coste registrado'
      from var v
      where v.status <> 'archived' and v.active
        and not exists (
          select 1 from internal.variant_cost_records c where c.variant_id = v.vid)
      union all
      select 'product_without_image', 'high', p.pid, null, p.plabel, 'Sin ninguna imagen'
      from prod p
      where p.status = 'published'
        and not exists (select 1 from main_media mm where mm.pid = p.pid)
      union all
      select 'provisional_image', 'low', p.pid, null, p.plabel,
             'Imagen principal provisional: ' || case mm.origin
               when 'own_photo' then 'foto propia'
               when 'catalog_pdf' then 'catálogo PDF'
               when 'brand_official' then 'imagen oficial de la marca'
               when 'generated_draft' then 'borrador generado'
               else mm.origin
             end
      from prod p
      join main_media mm on mm.pid = p.pid
      where p.status = 'published' and mm.provisional
      union all
      select 'product_without_scent', 'low', p.pid, null, p.plabel,
             case when sp.product_id is null then 'Sin perfil olfativo'
                  else 'Perfil olfativo sin notas ni familias' end
      from prod p
      left join public.product_scent_profiles sp on sp.product_id = p.pid
      where p.status = 'published'
        and (sp.product_id is null
             or cardinality(sp.top_notes) + cardinality(sp.heart_notes)
                + cardinality(sp.base_notes) + cardinality(sp.key_notes)
                + cardinality(sp.families) = 0)
      union all
      select 'missing_translation', 'medium', p.pid, null, p.plabel,
             'Falta el texto en: ' || string_agg(loc.code, ', ' order by loc.n)
      from prod p
      cross join unnest(array['es', 'ca', 'en']) with ordinality as loc(code, n)
      where p.status = 'published'
        and not exists (
          select 1 from public.product_translations t
          where t.product_id = p.pid and t.locale = loc.code
            and (nullif(btrim(t.tagline), '') is not null
                 or nullif(btrim(t.description), '') is not null))
      group by p.pid, p.plabel
      union all
      select 'stock_mismatch', 'high', v.pid, v.vid, v.vlabel,
             format('%s: %s en existencias y %s según los movimientos',
                    sl.name, g.on_hand, g.moved_on_hand)
             || case when g.reserved <> g.moved_reserved
                     then format('; %s reservadas y %s según los movimientos',
                                 g.reserved, g.moved_reserved)
                     else '' end
      from ledger g
      join var v on v.vid = g.vid
      join public.stock_locations sl on sl.id = g.lid
      where g.on_hand <> g.moved_on_hand or g.reserved <> g.moved_reserved
      union all
      select 'draft_with_stock', 'medium', v.pid, v.vid, v.vlabel,
             format('%s uds en existencias', st.units)
      from var v
      join (
        select l.variant_id, sum(l.on_hand)::bigint as units
        from public.inventory_levels l
        group by l.variant_id
      ) st on st.variant_id = v.vid
      where v.status = 'draft' and st.units > 0
      union all
      select 'variant_without_sku', 'low', v.pid, v.vid, v.vlabel, 'Formato activo sin SKU'
      from var v
      where v.status = 'published' and v.active and nullif(btrim(v.sku), '') is null
      union all
      select 'duplicate_ean', 'medium', e.pid, e.vid, e.vlabel,
             format('EAN %s en %s formatos', e.ean, e.copies)
      from (
        select v.pid, v.vid, v.vlabel, v.ean, count(*) over (partition by v.ean) as copies
        from var v
        where v.ean is not null
      ) e
      where e.copies > 1
      union all
      select 'source_to_review', 'low', p.pid, null, p.plabel, left(p.source_ref, 300)
      from prod p
      where p.status <> 'archived' and p.source_ref ilike '%por revisar%'
    )
    select f.k, f.s, f.pid, f.vid, f.lbl, f.d
    from found f
    order by case f.s when 'high' then 1 when 'medium' then 2 else 3 end,
             f.k, f.lbl, f.vid nulls first, f.d;
end;
$$;


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
-- 2. MFA en todos los permisos del personal
-- ---------------------------------------------------------------------------

-- El panel ya exige aal2 en cada página (requireStaff): la excepción de los
-- permisos de lectura solo servía a quien llamara a la API sin el segundo
-- factor.
update public.permissions set requires_aal2 = true where not requires_aal2;

-- ---------------------------------------------------------------------------
-- 3. Rol del personal solo para cuentas confirmadas
-- ---------------------------------------------------------------------------

create or replace function public.admin_grant_staff(
  p_email text,
  p_role text,
  p_display_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_before jsonb;
begin
  if not private.has_permission('staff.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_role not in ('system_admin', 'store_admin', 'viewer') then
    raise exception 'invalid_role' using errcode = '22023';
  end if;
  select u.id into v_user
  from auth.users u
  where lower(u.email) = lower(btrim(p_email));
  if v_user is null then
    raise exception 'unknown_user' using errcode = '22023';
  end if;
  -- Una cuenta sin confirmar puede haberla abierto otra persona con ese email
  -- (alta pública de la cuenta de cliente): el rol solo va a cuentas confirmadas.
  if not exists (
    select 1 from auth.users u where u.id = v_user and u.email_confirmed_at is not null
  ) then
    raise exception 'unconfirmed_user' using errcode = '22023';
  end if;
  if v_user = (select auth.uid()) then
    raise exception 'cannot_change_self' using errcode = '22023';
  end if;
  select to_jsonb(s) into v_before from public.staff_members s where s.user_id = v_user;
  insert into public.staff_members (user_id, role, display_name, created_by)
  values (v_user, p_role, nullif(btrim(p_display_name), ''), (select auth.uid()))
  on conflict (user_id) do update
    set role = excluded.role,
        display_name = coalesce(excluded.display_name, public.staff_members.display_name),
        active = true;
  insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
  values ((select auth.uid()), 'staff.grant', 'staff_member', v_user::text, v_before,
          jsonb_build_object('role', p_role, 'active', true));
  return v_user;
end;
$$;


create or replace function public.admin_prepare_invite(p_email text,p_role text,p_display_name text) returns void
language plpgsql security definer set search_path='' as $$
declare v_email text:=lower(btrim(p_email));
begin
 if not private.has_permission('staff.manage') then raise exception 'forbidden' using errcode='42501'; end if;
 if p_role not in ('system_admin','store_admin','viewer') or v_email not like '%@%' or length(v_email)>254 then raise exception 'invalid_role' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_email,17));
 if exists(select 1 from auth.users where lower(email)=v_email and email_confirmed_at is not null) then raise exception 'existing_user' using errcode='22023'; end if;
 -- Alta pública sin confirmar (no la creó una invitación): Auth la reutilizaría
 -- y el rol acabaría en la cuenta con la contraseña de quien la abrió.
 if exists(select 1 from auth.users where lower(email)=v_email and email_confirmed_at is null and invited_at is null) then raise exception 'unconfirmed_user' using errcode='22023'; end if;
 if exists(select 1 from private.pending_staff_grants where email=v_email and created_at>now()-interval '60 seconds') then raise exception 'rate_limited' using errcode='22023'; end if;
 insert into private.pending_staff_grants(email,role,display_name) values(v_email,p_role,nullif(btrim(p_display_name),''))
 on conflict(email) do update set role=excluded.role,display_name=excluded.display_name,created_at=now();
 insert into public.audit_log(actor_id,action,entity,entity_id,after)
 values(auth.uid(),'staff.invite_requested','staff_invite',v_email,jsonb_build_object('role',p_role));
end $$;

-- ---------------------------------------------------------------------------
-- 4. Freno de peticiones de las acciones públicas
-- ---------------------------------------------------------------------------

-- Una fila por acción, huella del cliente y ventana. La huella la calcula el
-- servidor (sha-256 de la acción, la IP y el día): aquí no llega la IP.
create table private.web_rate_limits (
  bucket text not null check (bucket ~ '^[a-z_]{1,40}$'),
  client_key text not null check (client_key ~ '^[0-9a-f]{64}$'),
  window_start timestamptz not null,
  hits integer not null default 1 check (hits > 0),
  primary key (bucket, client_key, window_start)
);
alter table private.web_rate_limits enable row level security;

-- true si la petición entra en el límite (y la cuenta); false si lo pasa.
create function public.web_order_rate_limit(
  p_bucket text,
  p_client_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz;
  v_hits integer;
begin
  if not private.is_service_role() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_bucket is null or p_bucket !~ '^[a-z_]{1,40}$'
     or p_client_key is null or p_client_key !~ '^[0-9a-f]{64}$'
     or p_limit is null or p_limit not between 1 and 10000
     or p_window_seconds is null or p_window_seconds not between 1 and 86400 then
    raise exception 'invalid_limit' using errcode = '22023';
  end if;
  v_window := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into private.web_rate_limits as r (bucket, client_key, window_start)
  values (p_bucket, p_client_key, v_window)
  on conflict (bucket, client_key, window_start)
    do update set hits = r.hits + 1
  returning r.hits into v_hits;
  -- Limpieza de ventanas viejas, de vez en cuando.
  if random() < 0.02 then
    delete from private.web_rate_limits where window_start < now() - interval '1 day';
  end if;
  return v_hits <= p_limit;
end;
$$;

revoke execute on function public.web_order_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.web_order_rate_limit(text, text, integer, integer)
  to service_role;
