-- Códigos únicos por suscriptor (DECISIONS §185): solo promotions.manage con
-- MFA crea, ve, descarga y apaga lotes; uno para cada suscriptor activo exige
-- además customers.view. Cada código es un código normal de un solo uso, así
-- que la tienda lo comprueba como cualquier otro. A quién va cada código solo
-- lo ven quienes tienen los dos permisos, se borra con el suscriptor y entra
-- en la exportación del cliente. Datos ficticios; la transacción se revierte.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(42);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000261', 'tienda@test.invalid'),
  ('00000000-0000-4000-8000-000000000262', 'encargado@test.invalid');
insert into public.staff_members (user_id, role) values
  ('00000000-0000-4000-8000-000000000261', 'store_admin'),
  ('00000000-0000-4000-8000-000000000262', 'viewer');

insert into public.brands (id, slug, name) values
  ('00000000-0000-4000-8000-0000000026b1', 'marca-lotes', 'Marca de lotes');
insert into public.products (id, brand_id, slug, name) values
  ('00000000-0000-4000-8000-0000000026a1', '00000000-0000-4000-8000-0000000026b1',
   'perfume-lotes', 'Perfume de lotes');
insert into public.product_variants (id, product_id, size_ml, retail_price_cents) values
  ('00000000-0000-4000-8000-0000000026c1', '00000000-0000-4000-8000-0000000026a1', 100, 5000);
update public.products set status = 'published'
  where id = '00000000-0000-4000-8000-0000000026a1';
insert into public.inventory_levels (variant_id, location_id, on_hand)
select '00000000-0000-4000-8000-0000000026c1', id, 10
from public.stock_locations where code = 'castelldefels';

-- Club: tres activos y una baja. Solo cuentan los de esta prueba (el resto de
-- la base, si lo hay, se da de baja dentro de la transacción).
update public.newsletter_subscribers set unsubscribed_at = now() where unsubscribed_at is null;
insert into public.newsletter_subscribers (email, locale, consent_version, consented_at,
  unsubscribed_at) values
  ('ana@lotes.invalid', 'es', 'club-1', now() - interval '3 days', null),
  ('bea@lotes.invalid', 'ca', 'club-1', now() - interval '2 days', null),
  ('carla@lotes.invalid', 'en', 'club-1', now() - interval '1 day', null),
  ('baja@lotes.invalid', 'es', 'club-1', now() - interval '9 days', now() - interval '4 days');

create function pg_temp.act_as(user_id text, aal text) returns void
language sql as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', user_id, 'aal', aal, 'role', 'authenticated')::text,
    true
  );
$$;
-- Lote de prueba: 10 % para el Club o un número fijo.
create function pg_temp.batch(
  p_audience text, p_count integer default null, p_prefix text default 'CLUB',
  p_value integer default 1000, p_name text default 'Bienvenida al Club'
) returns public.discount_batches
language sql as $$
  select public.admin_create_discount_batch(
    p_name, p_prefix, 'percent', p_value, null, null, null, null, false,
    p_audience, p_count);
$$;
create function pg_temp.quote(p_code text) returns jsonb
language sql as $$
  select public.web_order_discount_quote(p_code,
    '[{"variant_id": "00000000-0000-4000-8000-0000000026c1", "quantity": 1}]'::jsonb);
$$;
grant execute on function pg_temp.act_as(text, text),
  pg_temp.batch(text, integer, text, integer, text), pg_temp.quote(text)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Superficie
-- ---------------------------------------------------------------------------

select is_empty(
  $$select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname in ('discount_batch_code', 'forget_discount_recipient')
      and (has_function_privilege('anon', p.oid, 'execute')
           or has_function_privilege('authenticated', p.oid, 'execute'))$$,
  'las ayudas de los lotes no se llaman desde fuera');
select is_empty(
  $$select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('admin_create_discount_batch', 'admin_list_discount_batches',
                        'admin_discount_batch_codes', 'admin_set_discount_batch_active')
      and (has_function_privilege('anon', p.oid, 'execute')
           or not has_function_privilege('authenticated', p.oid, 'execute'))$$,
  'solo el personal autenticado llama a los lotes (y cada función comprueba el permiso)');
select is_empty(
  $$select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('discount_batches', 'discount_code_recipients')
      and (not c.relrowsecurity
           or has_table_privilege('anon', c.oid, 'select,insert,update,delete,truncate')
           or has_table_privilege('authenticated', c.oid, 'insert,update,delete,truncate'))$$,
  'lotes y destinatarios con RLS, sin escritura directa y sin nada para anon');
select ok(
  (select array_agg(table_name::text order by sort_order)
   from private.control_export_tables()
   where table_name in ('discount_batches', 'discount_codes', 'discount_code_recipients'))
  = array['discount_batches', 'discount_codes', 'discount_code_recipients'],
  'la copia diaria incluye los lotes antes que sus códigos y los destinatarios después');

-- ---------------------------------------------------------------------------
-- Quién crea lotes
-- ---------------------------------------------------------------------------

set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000262', 'aal2');
select throws_ok($$select pg_temp.batch('count', 5)$$, '42501', 'forbidden',
  'el encargado no crea lotes');
select throws_ok($$select * from public.admin_list_discount_batches()$$, '42501', 'forbidden',
  'ni los ve');
select pg_temp.act_as('00000000-0000-4000-8000-000000000261', 'aal1');
select throws_ok($$select pg_temp.batch('count', 5)$$, '42501', 'forbidden',
  'sin MFA el administrador de la tienda no crea lotes');

-- ---------------------------------------------------------------------------
-- Un código para cada suscriptor activo
-- ---------------------------------------------------------------------------

select pg_temp.act_as('00000000-0000-4000-8000-000000000261', 'aal2');
create temp table club as select * from pg_temp.batch('subscribers');
grant select on club to authenticated, service_role;
select is((select count(*)::int from public.discount_codes d join club b on d.batch_id = b.id),
  3, 'un código por cada suscriptor activo; la baja no recibe');
select is_empty(
  $$select d.code from public.discount_codes d join club b on d.batch_id = b.id
    where d.code !~ '^CLUB-[A-HJ-NP-Z2-9]{8}$'$$,
  'PREFIJO-XXXXXXXX sin 0, O, 1 ni I');
select is(
  (select count(distinct d.code)::int from public.discount_codes d join club b on d.batch_id = b.id),
  3, 'todos distintos');
select is_empty(
  $$select d.code from public.discount_codes d join club b on d.batch_id = b.id
    where not (d.max_uses = 1 and d.once_per_email and d.active and d.kind = 'percent'
               and d.percent_bp = 1000 and d.description = 'Bienvenida al Club')$$,
  'cada código: un uso, uno por email, encendido y con las condiciones del lote');
select results_eq(
  $$select r.email from public.discount_code_recipients r
    join public.discount_codes d on d.id = r.code_id join club b on d.batch_id = b.id
    order by r.email$$,
  $$values ('ana@lotes.invalid'), ('bea@lotes.invalid'), ('carla@lotes.invalid')$$,
  'quien tiene los dos permisos ve a quién va cada código');
select is(
  (select count(*)::int from public.discount_codes d join club b on d.batch_id = b.id
   where d.id in (select code_id from public.discount_code_recipients)),
  3, 'cada código del Club tiene su destinatario');

create temp table suelto as select * from pg_temp.batch('count', 5, 'TIENDA');
grant select on suelto to authenticated, service_role;
select is((select count(*)::int from public.discount_codes d join suelto b on d.batch_id = b.id),
  5, 'un número fijo de códigos');
select is_empty(
  $$select 1 from public.discount_code_recipients r
    join public.discount_codes d on d.id = r.code_id join suelto b on d.batch_id = b.id$$,
  'sin destinatario');

select throws_ok($$select pg_temp.batch('count', 0)$$, '22023', 'invalid_batch_size',
  'al menos un código');
select throws_ok($$select pg_temp.batch('count', 5001)$$, '22023', 'invalid_batch_size',
  'como mucho 5.000');
select throws_ok($$select pg_temp.batch('count', 2, 'C')$$, '22023', 'invalid_batch',
  'el prefijo tiene de 2 a 10 letras o números');
select throws_ok($$select pg_temp.batch('count', 2, 'CLUB', 9500)$$, '22023', 'invalid_discount',
  'el descuento sigue las reglas de los códigos (hasta el 90 %)');
select throws_ok($$select pg_temp.batch('todos', 2)$$, '22023', 'invalid_batch',
  'solo suscriptores o un número');

-- Sin nadie en el Club, no hay a quién dar códigos.
reset role;
savepoint sin_club;
update public.newsletter_subscribers set unsubscribed_at = now() where unsubscribed_at is null;
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000261', 'aal2');
select throws_ok($$select pg_temp.batch('subscribers')$$, '22023', 'no_recipients',
  'sin suscriptores activos, no hay lote');
reset role;
rollback to savepoint sin_club;

-- ---------------------------------------------------------------------------
-- Lista del panel, CSV y auditoría
-- ---------------------------------------------------------------------------

set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000261', 'aal2');
select is(
  (select count(*)::int from public.admin_list_discount_codes() l
   join public.discount_codes d on d.id = l.id where d.batch_id is not null),
  0, 'la lista de códigos deja fuera los de los lotes');
select is(
  (select row(l.codes, l.active_codes, l.used_codes, l.kind, l.percent_bp, l.audience)::text
   from public.admin_list_discount_batches() l join club b on l.id = b.id),
  row(3, 3, 0, 'percent', 1000, 'subscribers')::text,
  'el lote, con sus códigos, sus condiciones y nadie que lo haya usado');
select is(
  (select count(*)::int from public.admin_discount_batch_codes((select id from club))
   where email is not null and not used and active),
  3, 'el CSV trae cada código con su destinatario');

-- ---------------------------------------------------------------------------
-- En la tienda, un código de lote es un código normal de un solo uso
-- ---------------------------------------------------------------------------

reset role;
create temp table one as
  select d.id, d.code from public.discount_codes d join club b on d.batch_id = b.id
  order by d.code limit 1;
grant select on one to authenticated, service_role;
set local role service_role;
select set_config('request.jwt.claims', '{"role": "service_role"}', true);
select is(pg_temp.quote(lower((select code from one))) ->> 'discount_cents', '500',
  'el 10 % de 50 € sobre un código del lote, sin distinguir mayúsculas');
reset role;
-- Un pedido cobrado con ese código gasta su único uso.
insert into public.orders (request_id, locale, status, fulfillment, location_id,
  items_cents, total_cents, discount_code_id, discount_code, discount_cents,
  reservation, reserved_until, paid_at)
select gen_random_uuid(), 'es', 'paid', 'click_collect', l.id, 5000, 4500,
  (select id from one), (select code from one), 500, 'committed', now(), now()
from public.stock_locations l where l.code = 'castelldefels';
set local role service_role;
select set_config('request.jwt.claims', '{"role": "service_role"}', true);
select throws_ok(format('select pg_temp.quote(%L)', (select code from one)), '22023',
  'discount_exhausted', 'usado una vez, ya no vale');
reset role;

set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000261', 'aal2');
select is(
  (select row(l.used_codes, l.paid_uses, l.paid_discount_cents)::text
   from public.admin_list_discount_batches() l join club b on l.id = b.id),
  row(1, 1, 500::bigint)::text, 'el lote cuenta el código usado y lo descontado');

-- ---------------------------------------------------------------------------
-- Apagar y encender el lote
-- ---------------------------------------------------------------------------

select is(public.admin_set_discount_batch_active((select id from club), false), 3,
  'apagar el lote apaga sus tres códigos');
select is(public.admin_set_discount_batch_active((select id from club), false), 0,
  'apagarlo otra vez no cambia nada');
reset role;
create temp table other as
  select d.code from public.discount_codes d join club b on d.batch_id = b.id
  where d.id <> (select id from one) order by d.code limit 1;
grant select on other to service_role;
set local role service_role;
select set_config('request.jwt.claims', '{"role": "service_role"}', true);
select throws_ok(format('select pg_temp.quote(%L)', (select code from other)), '22023',
  'discount_invalid', 'un código de un lote apagado no vale');
reset role;
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000261', 'aal2');
select is(public.admin_set_discount_batch_active((select id from club), true), 3,
  'encenderlo los vuelve a encender');
select throws_ok(
  $$select public.admin_set_discount_batch_active('00000000-0000-4000-8000-000000000000', true)$$,
  'P0002', 'not_found', 'un lote que no existe');
select pg_temp.act_as('00000000-0000-4000-8000-000000000262', 'aal2');
select throws_ok($$select public.admin_set_discount_batch_active((select id from club), false)$$,
  '42501', 'forbidden', 'el encargado no apaga lotes');
select is((select count(*)::int from public.discount_code_recipients), 0,
  'ni ve a quién va cada código');
reset role;

select is(
  (select count(*)::int from public.audit_log
   where action in ('promotions.batch_create', 'promotions.batch_export', 'promotions.batch_active')
     and actor_id = '00000000-0000-4000-8000-000000000261'),
  6, 'crear (2), descargar (1) y apagar o encender (3) quedan en la auditoría');
select ok(
  (select bool_and(strpos(coalesce(after::text, ''), '@') = 0) from public.audit_log
   where action like 'promotions.batch_%'),
  'la auditoría de los lotes no guarda emails');

-- ---------------------------------------------------------------------------
-- Sin customers.view: lotes sin destinatario y CSV sin emails
-- ---------------------------------------------------------------------------

savepoint sin_clientes;
delete from public.role_permissions where role = 'store_admin' and permission = 'customers.view';
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000261', 'aal2');
select throws_ok($$select pg_temp.batch('subscribers')$$, '42501', 'forbidden',
  'sin permiso de clientes no se leen los emails del Club');
select is(
  (select count(*)::int from public.admin_discount_batch_codes((select id from club))
   where email is null),
  3, 'el CSV sale sin destinatarios');
reset role;
rollback to savepoint sin_clientes;

-- ---------------------------------------------------------------------------
-- Derechos del cliente
-- ---------------------------------------------------------------------------

set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000261', 'aal2');
select is(
  jsonb_array_length(public.admin_customer_export(
    encode(sha256(convert_to('ana@lotes.invalid', 'UTF8')), 'hex')) -> 'discount_codes'),
  1, 'la exportación del cliente incluye el código que se le dio');
select is(
  public.admin_customer_export(
    encode(sha256(convert_to('ana@lotes.invalid', 'UTF8')), 'hex')) #>> '{discount_codes,0,campaign}',
  'Bienvenida al Club', 'con su campaña');
reset role;
delete from public.newsletter_subscribers where email = 'bea@lotes.invalid';
select is(
  (select count(*)::int from public.discount_code_recipients where email = 'bea@lotes.invalid'),
  0, 'borrar al suscriptor borra a quién se dio su código');
select is((select count(*)::int from public.discount_codes d join club b on d.batch_id = b.id),
  3, 'el código sigue existiendo, sin destinatario');

select * from finish();
rollback;
