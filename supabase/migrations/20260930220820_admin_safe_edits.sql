-- Versiones distintas incluso en operaciones dentro de una misma transacción.
create or replace function private.set_updated_at() returns trigger
language plpgsql set search_path='' as $$
begin
 new.updated_at := greatest(clock_timestamp(), old.updated_at + interval '1 microsecond');
 return new;
end $$;

-- El índice también protege las escrituras directas y subidas simultáneas.
create unique index product_media_one_hero on public.product_media(product_id) where role='hero';

-- Revisiones de PVP ligadas a la sesión y al estado exacto revisado.
create table private.price_reviews (
 id uuid primary key default gen_random_uuid(), actor_id uuid not null,
 variant_id uuid not null, expected_updated_at timestamptz not null,
 cost_record_id bigint, price integer not null check(price>0), compare_at integer,
 required text[] not null default '{}', expires_at timestamptz not null default now()+interval '15 minutes',
 applied_at timestamptz, product_id uuid not null
);
alter table private.price_reviews enable row level security;

create function private.lock_cost_variant() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.product_variants where id=new.variant_id for update;
 return new;
end $$;
create trigger cost_variant_lock before insert on internal.variant_cost_records
for each row execute function private.lock_cost_variant();

create function public.admin_review_price(p_variant_id uuid,p_expected timestamptz,p_price integer,p_compare_at integer,p_cost integer,p_required text[]) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_variant public.product_variants; v_cost internal.variant_cost_records; v_id uuid;
begin
 if not private.has_permission('pricing.edit_retail') or not private.has_permission('pricing.view_cost') then raise exception 'forbidden' using errcode='42501'; end if;
 select * into v_variant from public.product_variants where id=p_variant_id for update;
 if not found or v_variant.updated_at is distinct from p_expected then raise exception 'edit_conflict' using errcode='40001'; end if;
 select * into v_cost from internal.variant_cost_records where variant_id=p_variant_id order by at desc,id desc limit 1;
 if v_cost.cost_net_cents is distinct from p_cost then raise exception 'edit_conflict' using errcode='40001'; end if;
 insert into private.price_reviews(actor_id,variant_id,expected_updated_at,cost_record_id,price,compare_at,required,product_id)
 values(auth.uid(),p_variant_id,p_expected,v_cost.id,p_price,p_compare_at,coalesce(p_required,'{}'),v_variant.product_id) returning id into v_id;
 return v_id;
end $$;

create function public.admin_apply_price_review(p_review_id uuid,p_confirmed text[]) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_review private.price_reviews; v_variant public.product_variants; v_cost_id bigint;
begin
 if not private.has_permission('pricing.edit_retail') or not private.has_permission('pricing.view_cost') then raise exception 'forbidden' using errcode='42501'; end if;
 select * into v_review from private.price_reviews where id=p_review_id and actor_id=auth.uid() for update;
 if not found then raise exception 'invalid_review' using errcode='42501'; end if;
 if v_review.applied_at is not null then return v_review.product_id; end if;
 if v_review.expires_at < clock_timestamp() then raise exception 'review_expired' using errcode='22023'; end if;
 if not(v_review.required <@ coalesce(p_confirmed,'{}')) then raise exception 'confirmations_required' using errcode='22023'; end if;
 select * into v_variant from public.product_variants where id=v_review.variant_id for update;
 if not found or v_variant.updated_at is distinct from v_review.expected_updated_at then raise exception 'edit_conflict' using errcode='40001'; end if;
 select id into v_cost_id from internal.variant_cost_records where variant_id=v_review.variant_id order by at desc,id desc limit 1;
 if v_cost_id is distinct from v_review.cost_record_id then raise exception 'edit_conflict' using errcode='40001'; end if;
 update public.product_variants set retail_price_cents=v_review.price,compare_at_price_cents=v_review.compare_at where id=v_review.variant_id;
 update private.price_reviews set applied_at=now() where id=p_review_id;
 insert into public.audit_log(actor_id,action,entity,entity_id,before,after) values(auth.uid(),'pricing.review_applied','product_variant',v_variant.id::text,
 jsonb_build_object('price',v_variant.retail_price_cents),jsonb_build_object('price',v_review.price,'review_id',p_review_id,'confirmed',p_confirmed));
 return v_variant.product_id;
end $$;
revoke all on function public.admin_review_price(uuid,timestamptz,integer,integer,integer,text[]),public.admin_apply_price_review(uuid,text[]) from public,anon;
grant execute on function public.admin_review_price(uuid,timestamptz,integer,integer,integer,text[]),public.admin_apply_price_review(uuid,text[]) to authenticated;

-- La regla de precio anterior también se comprueba al escribir por API directa.
create function private.guard_compare_price() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_min integer;
begin
 if new.compare_at_price_cents is null then return new; end if;
 if tg_op='UPDATE' and new.compare_at_price_cents is not distinct from old.compare_at_price_cents and new.retail_price_cents is not distinct from old.retail_price_cents then return new; end if;
 select min(h.price_cents) into v_min from public.admin_variant_price_history(new.id) h
 where h.valid_from < now() and (h.valid_to is null or h.valid_to > now()-interval '30 days');
 if v_min is null or new.compare_at_price_cents>v_min then raise exception 'invalid_previous_price' using errcode='23514'; end if;
 return new;
end $$;
create trigger compare_price_guard before insert or update on public.product_variants for each row execute function private.guard_compare_price();

create function public.admin_set_primary_media(p_product_id uuid,p_media_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not private.has_permission('media.edit') then raise exception 'forbidden' using errcode='42501'; end if;
 perform 1 from public.products where id=p_product_id for update;
 if not exists(select 1 from public.product_media where product_id=p_product_id and id=p_media_id) then raise exception 'invalid_media' using errcode='22023'; end if;
 update public.product_media set role='gallery' where product_id=p_product_id and role='hero';
 update public.product_media set role='hero' where product_id=p_product_id and id=p_media_id;
end $$;
revoke all on function public.admin_set_primary_media(uuid,uuid) from public,anon;
grant execute on function public.admin_set_primary_media(uuid,uuid) to authenticated;

-- Las operaciones del panel llevan una clave idempotente que no se reutiliza para otro contenido.
create table private.inventory_requests (
 actor_id uuid not null, request_id uuid not null, input jsonb not null, result jsonb,
 primary key(actor_id,request_id)
);
alter table private.inventory_requests enable row level security;
create function public.admin_inventory_once(p_request_id uuid,p_input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_previous private.inventory_requests; v_result public.inventory_movements;
begin
 if not private.is_staff() or p_request_id is null then raise exception 'forbidden' using errcode='42501'; end if;
 if p_input->>'kind'='stocktake' then
  if not private.has_permission('inventory.stocktake') then raise exception 'forbidden' using errcode='42501'; end if;
 else
  if not coalesce(private.has_permission(private.movement_permission(p_input->>'type')),false) then raise exception 'forbidden' using errcode='42501'; end if;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_request_id::text,0));
 select * into v_previous from private.inventory_requests where actor_id=auth.uid() and request_id=p_request_id;
 if found then
  if v_previous.input<>p_input then raise exception 'edit_conflict' using errcode='40001'; end if;
  return v_previous.result;
 end if;
 if p_input->>'kind'='stocktake' then
  v_result:=public.admin_record_stocktake((p_input->>'variantId')::uuid,(p_input->>'locationId')::uuid,(p_input->>'counted')::integer,p_input->>'reason');
 else
  v_result:=public.admin_record_inventory_movement((p_input->>'variantId')::uuid,(p_input->>'locationId')::uuid,p_input->>'type',(p_input->>'quantity')::integer,p_input->>'reason',p_input->>'reference');
 end if;
 insert into private.inventory_requests values(auth.uid(),p_request_id,p_input,to_jsonb(v_result));
 return to_jsonb(v_result);
end $$;
revoke all on function public.admin_inventory_once(uuid,jsonb) from public,anon;
grant execute on function public.admin_inventory_once(uuid,jsonb) to authenticated;

create function private.audit_catalog_change() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into public.audit_log(actor_id,action,entity,entity_id,before,after)
 values(auth.uid(),'catalog.'||lower(tg_op),tg_table_name,
 coalesce(to_jsonb(new)->>'id',to_jsonb(old)->>'id',to_jsonb(new)->>'product_id',to_jsonb(old)->>'product_id'),
 case when tg_op<>'INSERT' then to_jsonb(old) end,case when tg_op<>'DELETE' then to_jsonb(new) end);
 return null;
end $$;
create trigger audit_products after insert or update or delete on public.products for each row execute function private.audit_catalog_change();
create trigger audit_translations after insert or update or delete on public.product_translations for each row execute function private.audit_catalog_change();
create trigger audit_media after insert or update or delete on public.product_media for each row execute function private.audit_catalog_change();
