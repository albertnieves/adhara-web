-- Borradores y revisiones privados; la API pública solo contiene lo publicado.
create table private.store_documents (
 kind text not null check(kind in ('home','store')),
 locale text not null check(locale in ('es','ca','en')),
 revision integer not null default 0,
 payload jsonb not null default '{}',
 updated_at timestamptz not null default now(),
 updated_by uuid,
 primary key(kind,locale),
 check(kind <> 'store' or locale='es')
);
create table private.store_revisions (
 id bigint generated always as identity primary key,
 kind text not null, locale text not null, revision integer not null,
 payload jsonb not null, actor_id uuid, at timestamptz not null default now(),
 action text not null check(action in ('save','publish','restore'))
);
alter table private.store_documents enable row level security;
alter table private.store_revisions enable row level security;
create trigger store_revision_immutable before update or delete on private.store_revisions
for each row execute function private.reject_mutation();
create table public.store_content (
 kind text not null, locale text not null, payload jsonb not null,
 revision integer not null, published_at timestamptz not null default now(),
 primary key(kind,locale)
);
alter table public.store_content enable row level security;
revoke all on public.store_content from anon,authenticated;
grant select on public.store_content to anon,authenticated;
create policy published_content_read on public.store_content for select to anon,authenticated using(true);

create function private.check_content_access(p_kind text) returns void
language plpgsql set search_path='' as $$
begin
 if p_kind not in ('home','store') or not private.has_permission(case when p_kind='store' then 'settings.manage' else 'content.edit' end) or private.current_aal()<>'aal2' then
  raise exception 'forbidden' using errcode='42501';
 end if;
end $$;

create function public.admin_get_content(p_kind text,p_locale text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb;
begin
 perform private.check_content_access(p_kind);
 select to_jsonb(d) || jsonb_build_object('published_revision',c.revision,
 'history',coalesce((select jsonb_agg(h order by h.id desc) from
 (select id,revision,action,at,actor_id from private.store_revisions where kind=p_kind and locale=p_locale order by id desc limit 20) h),'[]'::jsonb))
 into v_result from private.store_documents d left join public.store_content c using(kind,locale)
 where d.kind=p_kind and d.locale=p_locale;
 return v_result;
end $$;

create function public.admin_save_content(p_kind text,p_locale text,p_expected integer,p_payload jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare v_revision integer; v_key text; v_value text;
begin
 perform private.check_content_access(p_kind);
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>24000 then
  raise exception 'invalid_content' using errcode='22023';
 end if;
 for v_key,v_value in select key,value from jsonb_each_text(p_payload) loop
  if jsonb_typeof(p_payload->v_key)<>'string' or length(v_value)>4000 or
   (p_kind='home' and v_key not in ('heroEyebrow','heroTitle','heroLead','heroCta','storeBody','imagePath','imageAlt','imageSource')) or
   (p_kind='store' and v_key not in ('address','city','phone','email','hours','instagram','facebook')) then
   raise exception 'invalid_content' using errcode='22023';
  end if;
 end loop;
 if (p_kind='home' and not p_payload ?& array['heroEyebrow','heroTitle','heroLead','heroCta','storeBody','imagePath','imageAlt','imageSource']) or
    (p_kind='store' and not p_payload ?& array['address','city','phone','email','hours','instagram','facebook']) then
  raise exception 'invalid_content' using errcode='22023';
 end if;
 if p_kind='home' and length(p_payload->>'imagePath')>500 then
  raise exception 'invalid_content' using errcode='22023';
 end if;
 if p_kind='store' and (
  coalesce(length(btrim(p_payload->>'city')),0)=0 or length(p_payload->>'phone')>50 or
  length(p_payload->>'email')>254 or
  ((p_payload->>'email')<>'' and (p_payload->>'email') !~ '^([A-Za-z0-9_''+-]+[.])*[A-Za-z0-9_''+-]*[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9-]*[.])+[A-Za-z]{2,}$') or
  ((p_payload->>'instagram')<>'' and (p_payload->>'instagram') !~ '^https://([A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?[.])+[A-Za-z]{2,}([/?#][^[:space:]]*)?$') or
  ((p_payload->>'facebook')<>'' and (p_payload->>'facebook') !~ '^https://([A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?[.])+[A-Za-z]{2,}([/?#][^[:space:]]*)?$')
 ) then raise exception 'invalid_content' using errcode='22023'; end if;
 if p_kind='home' and (coalesce(length(btrim(p_payload->>'heroTitle')),0)=0 or coalesce(length(btrim(p_payload->>'heroCta')),0)=0) then
  raise exception 'invalid_content' using errcode='22023';
 end if;
 if p_kind='store' and coalesce(length(btrim(p_payload->>'address')),0)=0 then
  raise exception 'invalid_content' using errcode='22023';
 end if;
 if coalesce(p_payload->>'imagePath','')<>'' and (
   coalesce(length(btrim(p_payload->>'imageAlt')),0)=0 or coalesce(length(btrim(p_payload->>'imageSource')),0)=0 or
   not exists(select 1 from storage.objects where bucket_id='editorial' and name=p_payload->>'imagePath')
 ) then raise exception 'invalid_content' using errcode='22023'; end if;
 update private.store_documents set payload=p_payload,revision=revision+1,updated_at=now(),updated_by=auth.uid()
 where kind=p_kind and locale=p_locale and revision=p_expected returning revision into v_revision;
 if not found then raise exception 'edit_conflict' using errcode='40001'; end if;
 insert into private.store_revisions(kind,locale,revision,payload,actor_id,action)
 values(p_kind,p_locale,v_revision,p_payload,auth.uid(),'save');
 insert into public.audit_log(actor_id,action,entity,entity_id,after)
 values(auth.uid(),'content.saved',p_kind,p_locale,jsonb_build_object('revision',v_revision));
 return v_revision;
end $$;

create function public.admin_publish_content(p_kind text,p_locale text,p_expected integer) returns void
language plpgsql security definer set search_path='' as $$
declare v_doc private.store_documents;
begin
 perform private.check_content_access(p_kind);
 select * into v_doc from private.store_documents where kind=p_kind and locale=p_locale for update;
 if not found or v_doc.revision<>p_expected then raise exception 'edit_conflict' using errcode='40001'; end if;
 if exists(select 1 from public.store_content where kind=p_kind and locale=p_locale and revision=p_expected) then return; end if;
 insert into public.store_content(kind,locale,payload,revision) values(p_kind,p_locale,v_doc.payload,v_doc.revision)
 on conflict(kind,locale) do update set payload=excluded.payload,revision=excluded.revision,published_at=now();
 insert into private.store_revisions(kind,locale,revision,payload,actor_id,action)
 values(p_kind,p_locale,v_doc.revision,v_doc.payload,auth.uid(),'publish');
 insert into public.audit_log(actor_id,action,entity,entity_id,after)
 values(auth.uid(),'content.published',p_kind,p_locale,jsonb_build_object('revision',v_doc.revision));
end $$;

create function public.admin_restore_content(p_kind text,p_locale text,p_expected integer,p_revision_id bigint) returns integer
language plpgsql security definer set search_path='' as $$
declare v_payload jsonb; v_revision integer;
begin
 perform private.check_content_access(p_kind);
 select payload into v_payload from private.store_revisions where id=p_revision_id and kind=p_kind and locale=p_locale;
 if not found then raise exception 'invalid_content' using errcode='22023'; end if;
 v_revision := public.admin_save_content(p_kind,p_locale,p_expected,v_payload);
 insert into private.store_revisions(kind,locale,revision,payload,actor_id,action)
 values(p_kind,p_locale,v_revision,v_payload,auth.uid(),'restore');
 return v_revision;
end $$;

revoke all on function public.admin_get_content(text,text),public.admin_save_content(text,text,integer,jsonb),public.admin_publish_content(text,text,integer),public.admin_restore_content(text,text,integer,bigint) from public,anon;
grant execute on function public.admin_get_content(text,text),public.admin_save_content(text,text,integer,jsonb),public.admin_publish_content(text,text,integer),public.admin_restore_content(text,text,integer,bigint) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('editorial','editorial',false,4194304,array['image/jpeg','image/png','image/webp','image/avif']);
create policy editorial_read on storage.objects for select to anon,authenticated using(
 bucket_id='editorial' and exists(select 1 from public.store_content c where c.payload->>'imagePath'=name)
);
create policy editorial_staff_read on storage.objects for select to authenticated using(
 bucket_id='editorial' and (select private.has_permission('content.edit'))
);
create policy editorial_staff_upload on storage.objects for insert to authenticated with check(
 bucket_id='editorial' and (select private.has_permission('content.edit'))
);
-- Sin UPDATE/DELETE: las revisiones conservan sus imágenes; URLs firmadas breves.

insert into private.store_documents(kind,locale,payload) values('home','es','{"heroEyebrow": "Perfumería árabe · Castelldefels", "heroTitle": "El lenguaje del perfume árabe", "heroLead": "Una selección de fragancias de las casas de Oriente Medio, presentada con la calma que merecen.", "heroCta": "Descubrir la colección", "storeBody": "Ven a descubrir las fragancias en persona. La compra online llegará muy pronto.", "imagePath": "", "imageAlt": "", "imageSource": ""}'::jsonb);

insert into private.store_documents(kind,locale,payload) values('home','ca','{"heroEyebrow": "Perfumeria àrab · Castelldefels", "heroTitle": "El llenguatge del perfum àrab", "heroLead": "Una selecció de fragàncies de les cases de l’Orient Mitjà, presentada amb la calma que es mereixen.", "heroCta": "Descobreix la col·lecció", "storeBody": "Vine a descobrir les fragàncies en persona. La compra en línia arribarà molt aviat.", "imagePath": "", "imageAlt": "", "imageSource": ""}'::jsonb);

insert into private.store_documents(kind,locale,payload) values('home','en','{"heroEyebrow": "Arabian perfumery · Castelldefels", "heroTitle": "The language of Arabian perfume", "heroLead": "A selection of fragrances from the perfume houses of the Middle East, presented with the calm they deserve.", "heroCta": "Discover the collection", "storeBody": "Come and discover the fragrances in person. Online shopping is coming very soon.", "imagePath": "", "imageAlt": "", "imageSource": ""}'::jsonb);

insert into private.store_documents(kind,locale,payload) values('store','es','{"address": "Carrer de Pompeu Fabra 1", "city": "Castelldefels", "phone": "", "email": "", "hours": "", "instagram": "", "facebook": ""}'::jsonb);
insert into public.store_content(kind,locale,payload,revision) select kind,locale,payload,revision from private.store_documents;
insert into private.store_revisions(kind,locale,revision,payload,action) select kind,locale,revision,payload,'publish' from private.store_documents;
