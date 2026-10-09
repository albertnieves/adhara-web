-- Perfil olfativo (lectura pública solo de publicados, escritura con
-- catalog.edit o research.edit y MFA) y suscriptores a promociones (alta
-- pública por función, lectura y cambios solo con customers.*).
-- Datos ficticios solo de prueba; la transacción se revierte.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(30);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000081', 'sistema@test.invalid'),
  ('00000000-0000-4000-8000-000000000082', 'tienda@test.invalid'),
  ('00000000-0000-4000-8000-000000000083', 'encargado@test.invalid'),
  ('00000000-0000-4000-8000-000000000084', 'cliente@test.invalid');

insert into public.staff_members (user_id, role) values
  ('00000000-0000-4000-8000-000000000081', 'system_admin'),
  ('00000000-0000-4000-8000-000000000082', 'store_admin'),
  ('00000000-0000-4000-8000-000000000083', 'viewer');

insert into public.brands (id, slug, name) values
  ('00000000-0000-4000-8000-0000000000b8', 'marca-olfativa', 'Marca olfativa');
insert into public.products (id, brand_id, slug, name) values
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000b8',
   'perfume-olfativo', 'Perfume olfativo'),
  ('00000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-0000000000b8',
   'borrador-olfativo', 'Borrador olfativo');
insert into public.product_variants (product_id, size_ml, retail_price_cents, active) values
  ('00000000-0000-4000-8000-0000000000d1', 100, 4990, true);
update public.products set status = 'published'
  where id = '00000000-0000-4000-8000-0000000000d1';

insert into public.product_scent_profiles
  (product_id, top_notes, heart_notes, base_notes, families, seasons, times_of_day, source_url)
values
  ('00000000-0000-4000-8000-0000000000d1', '{bergamot}', '{rose}', '{amber}',
   '{floral}', '{spring}', '{day}', 'https://example.invalid/publicado'),
  ('00000000-0000-4000-8000-0000000000d2', '{lemon}', '{}', '{}',
   '{}', '{}', '{}', 'https://example.invalid/borrador');

create function pg_temp.act_as(user_id text, aal text) returns void
language sql as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', user_id, 'aal', aal, 'role', 'authenticated')::text,
    true
  );
$$;

-- Restricciones del perfil.
select throws_ok(
  $$insert into public.product_scent_profiles (product_id, top_notes, source_url)
    values ('00000000-0000-4000-8000-0000000000d2', '{"Bergamota"}', 'https://x.invalid')
    on conflict (product_id) do update set top_notes = excluded.top_notes$$,
  '23514', null, 'las notas son claves del vocabulario, no texto libre');
select throws_ok(
  $$update public.product_scent_profiles set seasons = '{monsoon}'
    where product_id = '00000000-0000-4000-8000-0000000000d1'$$,
  '23514', null, 'solo estaciones conocidas');
select throws_ok(
  $$update public.product_scent_profiles set times_of_day = '{evening}'
    where product_id = '00000000-0000-4000-8000-0000000000d1'$$,
  '23514', null, 'solo día o noche');
select throws_ok(
  $$update public.product_scent_profiles set families = '{marine}'
    where product_id = '00000000-0000-4000-8000-0000000000d1'$$,
  '23514', null, 'solo familias conocidas');
select throws_ok(
  $$update public.product_scent_profiles set source_url = 'inventado'
    where product_id = '00000000-0000-4000-8000-0000000000d1'$$,
  '23514', null, 'la fuente es una URL https');

-- Lectura pública: solo perfumes publicados.
set local role anon;
select is(
  (select array_agg(product_id::text) from public.product_scent_profiles
   where product_id in ('00000000-0000-4000-8000-0000000000d1',
                        '00000000-0000-4000-8000-0000000000d2')),
  array['00000000-0000-4000-8000-0000000000d1'],
  'anon solo ve el perfil del publicado');
select throws_ok(
  $$update public.product_scent_profiles set seasons = '{winter}'
    where product_id = '00000000-0000-4000-8000-0000000000d1'$$,
  '42501', null, 'anon no cambia perfiles');
reset role;

set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000084', 'aal2');
select is(
  (select count(*)::int from public.product_scent_profiles
   where product_id = '00000000-0000-4000-8000-0000000000d2'),
  0, 'un usuario sin personal no ve el perfil del borrador');
select is_empty(
  $$update public.product_scent_profiles set seasons = '{winter}'
    where product_id = '00000000-0000-4000-8000-0000000000d1' returning 1$$,
  'un usuario sin personal no cambia perfiles');
select pg_temp.act_as('00000000-0000-4000-8000-000000000083', 'aal2');
select is(
  (select count(*)::int from public.product_scent_profiles
   where product_id = '00000000-0000-4000-8000-0000000000d2'),
  1, 'el personal ve el perfil del borrador');
select is_empty(
  $$update public.product_scent_profiles set seasons = '{winter}'
    where product_id = '00000000-0000-4000-8000-0000000000d1' returning 1$$,
  'el encargado no cambia perfiles');
select pg_temp.act_as('00000000-0000-4000-8000-000000000082', 'aal1');
select is_empty(
  $$update public.product_scent_profiles set seasons = '{winter}'
    where product_id = '00000000-0000-4000-8000-0000000000d1' returning 1$$,
  'sin MFA la tienda no cambia perfiles');
select pg_temp.act_as('00000000-0000-4000-8000-000000000082', 'aal2');
select isnt_empty(
  $$update public.product_scent_profiles set seasons = '{winter}'
    where product_id = '00000000-0000-4000-8000-0000000000d1' returning 1$$,
  'store_admin con MFA cambia el perfil');
select lives_ok(
  $$delete from public.product_scent_profiles
    where product_id = '00000000-0000-4000-8000-0000000000d2'$$,
  'store_admin con MFA borra un perfil');
reset role;

-- Suscriptores: alta pública por función.
set local role anon;
select lives_ok(
  $$select public.newsletter_subscribe('  Ana@Example.COM ', 'ca', 'promos-2026-10')$$,
  'anon se suscribe');
select lives_ok(
  $$select public.newsletter_subscribe('ana@example.com', 'es', 'promos-2026-10')$$,
  'repetir el alta no falla ni revela que existía');
select throws_ok(
  $$select public.newsletter_subscribe('no-es-un-email', 'es', 'promos-2026-10')$$,
  '22023', 'invalid_email', 'email no válido');
select throws_ok(
  $$select public.newsletter_subscribe('b@example.com', 'fr', 'promos-2026-10')$$,
  '22023', 'invalid_locale', 'idioma no válido');
select throws_ok(
  $$select * from public.newsletter_subscribers$$,
  '42501', null, 'anon no lee suscriptores');
select throws_ok(
  $$insert into public.newsletter_subscribers (email, locale, consent_version)
    values ('c@example.com', 'es', 'x')$$,
  '42501', null, 'anon no inserta directamente');
reset role;

select is(
  (select email || ' ' || locale from public.newsletter_subscribers
   where email = 'ana@example.com'),
  'ana@example.com es', 'email normalizado, una sola fila y último idioma');

-- Lectura y cambios solo con customers.*.
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000084', 'aal2');
select is_empty($$select 1 from public.newsletter_subscribers$$,
  'un usuario sin personal no lee suscriptores');
select throws_ok(
  $$insert into public.newsletter_subscribers (email, locale, consent_version)
    values ('d@example.com', 'es', 'x')$$,
  '42501', null, 'authenticated no inserta directamente');
select pg_temp.act_as('00000000-0000-4000-8000-000000000083', 'aal2');
select is_empty($$select 1 from public.newsletter_subscribers$$,
  'el encargado no lee suscriptores');
select pg_temp.act_as('00000000-0000-4000-8000-000000000082', 'aal1');
select isnt_empty($$select 1 from public.newsletter_subscribers$$,
  'la tienda lee suscriptores (customers.view)');
select is_empty(
  $$update public.newsletter_subscribers set unsubscribed_at = now() returning 1$$,
  'sin MFA no da de baja');
select pg_temp.act_as('00000000-0000-4000-8000-000000000082', 'aal2');
select isnt_empty(
  $$update public.newsletter_subscribers set unsubscribed_at = now(),
    sender_synced_at = now() returning 1$$,
  'con MFA da de baja (customers.manage)');
reset role;

-- Volver a suscribirse tras la baja: nuevo consentimiento y pendiente de Sender.
set local role anon;
select public.newsletter_subscribe('ana@example.com', 'en', 'promos-2026-11');
reset role;
select is(
  (select (unsubscribed_at is null and sender_synced_at is null
           and consent_version = 'promos-2026-11')
   from public.newsletter_subscribers where email = 'ana@example.com'),
  true, 'la nueva alta reactiva y queda pendiente de enviar a Sender');

set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000082', 'aal2');
select lives_ok($$delete from public.newsletter_subscribers$$,
  'con MFA borra suscriptores (derecho de supresión)');
reset role;
select is((select count(*)::int from public.newsletter_subscribers), 0,
  'no queda ningún suscriptor');

select * from finish();
rollback;
