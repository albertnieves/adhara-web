-- Datos exclusivos de pruebas. Todo se revierte.
begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000000041','owner-delivery@test.invalid'),
 ('00000000-0000-4000-8000-000000000042','store-delivery@test.invalid'),
 ('00000000-0000-4000-8000-000000000043','viewer-delivery@test.invalid');
insert into public.staff_members(user_id,role) values
 ('00000000-0000-4000-8000-000000000041','system_admin'),
 ('00000000-0000-4000-8000-000000000042','store_admin'),
 ('00000000-0000-4000-8000-000000000043','viewer');
insert into public.brands(id,slug,name) values('00000000-0000-4000-8000-000000000b41','test-delivery','Prueba');
insert into public.products(id,brand_id,slug,name) values('00000000-0000-4000-8000-000000000a41','00000000-0000-4000-8000-000000000b41','test-delivery','Prueba');
insert into public.product_variants(id,product_id,size_ml,retail_price_cents) values('00000000-0000-4000-8000-000000000c41','00000000-0000-4000-8000-000000000a41',100,5000);
insert into public.product_media(id,product_id,url,role,origin) values
 ('00000000-0000-4000-8000-000000000d41','00000000-0000-4000-8000-000000000a41','https://example.invalid/1.jpg','hero','own_photo'),
 ('00000000-0000-4000-8000-000000000d42','00000000-0000-4000-8000-000000000a41','https://example.invalid/2.jpg','gallery','own_photo');
insert into public.stock_locations(code,name,kind) values('delivery-test','Prueba','store');
create function pg_temp.act_as(uid text,aal text) returns void language sql as $$ select set_config('request.jwt.claims',json_build_object('sub',uid,'aal',aal,'role','authenticated')::text,true); $$;
create temporary table saved(name text primary key,value text);
grant all on saved to authenticated,anon;
insert into saved values('original',(select payload::text from public.store_content where kind='home' and locale='es'));
set local role anon;
select throws_ok($$select public.admin_get_content('home','es')$$,'42501',null,'anon no lee borradores');
select throws_ok($$update public.store_content set revision=100$$,'42501',null,'anon no modifica publicado');
select is((select payload->>'address' from public.store_content where kind='store'),'Carrer de Pompeu Fabra 1','dirección facilitada');
reset role;
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000041','aal1');
select throws_ok($$select public.admin_get_content('home','es')$$,'42501','forbidden','sin MFA no lee borrador');
select is_empty($$update public.products set name='No' returning id$$,'sin MFA no edita ficha');
select is_empty($$update public.product_media set alt='No' returning id$$,'sin MFA no edita imágenes');
select throws_ok($$insert into storage.objects(bucket_id,name) values('editorial','denied.jpg')$$,'42501',null,'sin MFA no sube editorial');
select pg_temp.act_as('00000000-0000-4000-8000-000000000043','aal2');
select throws_ok($$select public.admin_get_content('home','es')$$,'42501','forbidden','viewer no lee borradores');
select throws_ok($$select public.admin_apply_price_review(gen_random_uuid(),'{}')$$,'42501','forbidden','viewer no aplica PVP');
select pg_temp.act_as('00000000-0000-4000-8000-000000000042','aal2');
select throws_ok($$select public.admin_get_content('store','es')$$,'42501','forbidden','tienda no cambia configuración reservada');
select throws_ok($$select public.admin_save_content('home','es',0,'{"heroTitle":"x","heroCta":"y"}')$$,'22023','invalid_content','payload incompleto rechazado');
select is(public.admin_save_content('home','es',0,(select value::jsonb || '{"heroTitle":"Borrador privado"}' from saved where name='original')),1,'tienda guarda borrador');
select is((select payload->>'heroTitle' from public.store_content where kind='home' and locale='es'),(select value::jsonb->>'heroTitle' from saved where name='original'),'borrador no cambia público');
select is(public.admin_get_content('home','es')->'payload'->>'heroTitle','Borrador privado','sesión autorizada lee borrador');
select throws_ok($$select public.admin_save_content('home','es',0,(select value::jsonb from saved where name='original'))$$,'40001','edit_conflict','edición desactualizada rechazada');
select throws_ok($$select public.admin_publish_content('home','es',0)$$,'40001','edit_conflict','no publica revisión distinta');
select lives_ok($$select public.admin_publish_content('home','es',1)$$,'publicación autorizada');
select is((select payload->>'heroTitle' from public.store_content where kind='home' and locale='es'),'Borrador privado','público recibe revisión publicada');
select is((select revision from public.store_content where kind='home' and locale='ca'),0,'no cambia catalán');
select lives_ok($$select public.admin_publish_content('home','es',1)$$,'republicar es idempotente');
select is(public.admin_restore_content('home','es',1,((public.admin_get_content('home','es')->'history')->-1->>'id')::bigint),2,'restaurar crea nueva revisión');
select is((select revision from public.store_content where kind='home' and locale='es'),1,'restaurar no publica');
select lives_ok($$insert into storage.objects(bucket_id,name) values('editorial','draft-test.jpg')$$,'tienda sube editorial privada');
reset role;
set local role anon;
select is_empty($$select name from storage.objects where bucket_id='editorial'$$,'anon no lee archivos borradores');
reset role;
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000041','aal2');
select throws_ok($$select public.admin_save_content('store','es',0,(select payload || '{"instagram":"javascript:alert(1)"}' from public.store_content where kind='store'))$$,'22023','invalid_content','URL insegura rechazada por SQL');
select throws_ok($$update public.staff_members set active=false where user_id=auth.uid()$$,'23514','last_admin','protege último administrador también por API');
select lives_ok($$select public.admin_prepare_invite('invite@test.invalid','store_admin','Invitado')$$,'prepara invitación');
select throws_ok($$select public.admin_prepare_invite('invite@test.invalid','store_admin','Invitado')$$,'22023','rate_limited','límite de reenvío');
select lives_ok($$select public.admin_cancel_invite('invite@test.invalid')$$,'cancela invitación');
-- Revisión ligada al actor y a la versión de precio/coste.
insert into saved select 'review',public.admin_review_price(id,updated_at,5500,null,null,array['large_change'])::text from public.product_variants;
select throws_ok($$select public.admin_apply_price_review((select value::uuid from saved where name='review'),'{}')$$,'22023','confirmations_required','exige confirmación almacenada');
select pg_temp.act_as('00000000-0000-4000-8000-000000000042','aal2');
select throws_ok($$select public.admin_apply_price_review((select value::uuid from saved where name='review'),array['large_change'])$$,'42501','invalid_review','no aplica revisión de otro usuario');
select pg_temp.act_as('00000000-0000-4000-8000-000000000041','aal2');
select lives_ok($$select public.admin_apply_price_review((select value::uuid from saved where name='review'),array['large_change'])$$,'aplica exactamente precio revisado');
select lives_ok($$select public.admin_apply_price_review((select value::uuid from saved where name='review'),array['large_change'])$$,'reintento idempotente');
select is((select retail_price_cents from public.product_variants),5500,'reintento no incrementa dos veces');
insert into saved select 'stale',public.admin_review_price(id,updated_at,6000,null,null,'{}')::text from public.product_variants;
update public.product_variants set retail_price_cents=6500;
select throws_ok($$select public.admin_apply_price_review((select value::uuid from saved where name='stale'),'{}')$$,'40001','edit_conflict','otra edición en misma transacción invalida revisión');
insert into saved select 'cost',public.admin_review_price(id,updated_at,7000,null,null,'{}')::text from public.product_variants;
select public.admin_record_variant_cost('00000000-0000-4000-8000-000000000c41',2000);
select throws_ok($$select public.admin_apply_price_review((select value::uuid from saved where name='cost'),'{}')$$,'40001','edit_conflict','nuevo coste invalida revisión');
insert into saved select 'expired',public.admin_review_price(id,updated_at,7000,null,2000,'{}')::text from public.product_variants;
reset role;
update private.price_reviews set expires_at=now()-interval '1 minute' where id=(select value::uuid from saved where name='expired');
set local role authenticated;
select throws_ok($$select public.admin_apply_price_review((select value::uuid from saved where name='expired'),'{}')$$,'22023','review_expired','revisión caducada rechazada');
select throws_ok($$select public.admin_set_primary_media('00000000-0000-4000-8000-000000000a41',gen_random_uuid())$$,'22023','invalid_media','imagen incorrecta no borra principal');
select is((select count(*)::int from public.product_media where role='hero'),1,'principal conservada');
select lives_ok($$select public.admin_set_primary_media('00000000-0000-4000-8000-000000000a41','00000000-0000-4000-8000-000000000d42')$$,'cambio de principal atómico');
select throws_ok($$update public.product_media set role='hero' where id='00000000-0000-4000-8000-000000000d41'$$,'23505',null,'API directa no crea dos principales');
insert into saved select 'movement',jsonb_build_object('kind','movement','variantId','00000000-0000-4000-8000-000000000c41','locationId',id,'type','PURCHASE_RECEIPT','quantity',5)::text from public.stock_locations limit 1;
select lives_ok($$select public.admin_inventory_once('00000000-0000-4000-8000-000000000e41',(select value::jsonb from saved where name='movement'))$$,'recepción con clave');
select lives_ok($$select public.admin_inventory_once('00000000-0000-4000-8000-000000000e41',(select value::jsonb from saved where name='movement'))$$,'reintento de recepción');
select is((select on_hand from public.inventory_levels where variant_id='00000000-0000-4000-8000-000000000c41'),5,'no duplica unidades');
select throws_ok($$select public.admin_inventory_once('00000000-0000-4000-8000-000000000e41',(select value::jsonb || '{"quantity":6}' from saved where name='movement'))$$,'40001','edit_conflict','misma clave distinto contenido rechazada');
update public.staff_members set active=false where user_id='00000000-0000-4000-8000-000000000042';
select pg_temp.act_as('00000000-0000-4000-8000-000000000042','aal2');
select throws_ok($$select public.admin_get_content('home','es')$$,'42501','forbidden','revocación inmediata aun con token anterior');
reset role;
select is((select count(*)::int from private.store_revisions where kind='home' and locale='es' and action='publish'),2,'publicación repetida no duplica historial');
select * from finish();
rollback;
