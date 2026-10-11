-- Visitas e interés de los productos: la tienda suma contadores anónimos por
-- perfume publicado, día de Madrid y tipo (track_product_event, con freno
-- global por minuto); nadie de la API lee internal y solo el titular con MFA
-- consulta los contadores. Datos ficticios; la transacción se revierte.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(55);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000111', 'titular@test.invalid'),
  ('00000000-0000-4000-8000-000000000112', 'tienda@test.invalid'),
  ('00000000-0000-4000-8000-000000000113', 'encargado@test.invalid'),
  ('00000000-0000-4000-8000-000000000114', 'otro-sistema@test.invalid'),
  ('00000000-0000-4000-8000-000000000115', 'cliente@test.invalid');

insert into public.staff_members (user_id, role) values
  ('00000000-0000-4000-8000-000000000111', 'system_admin'),
  ('00000000-0000-4000-8000-000000000112', 'store_admin'),
  ('00000000-0000-4000-8000-000000000113', 'viewer'),
  ('00000000-0000-4000-8000-000000000114', 'system_admin');

insert into internal.control_owners (user_id) values
  ('00000000-0000-4000-8000-000000000111');

-- Publicado, borrador y archivado (los dos últimos no cuentan).
insert into public.brands (id, slug, name) values
  ('00000000-0000-4000-8000-0000000011b1', 'marca-atencion', 'Marca de atención');
insert into public.products (id, brand_id, slug, name) values
  ('00000000-0000-4000-8000-0000000011a1', '00000000-0000-4000-8000-0000000011b1',
   'perfume-atencion', 'Perfume de atención'),
  ('00000000-0000-4000-8000-0000000011a2', '00000000-0000-4000-8000-0000000011b1',
   'borrador-atencion', 'Borrador de atención'),
  ('00000000-0000-4000-8000-0000000011a3', '00000000-0000-4000-8000-0000000011b1',
   'archivado-atencion', 'Archivado de atención');
insert into public.product_variants (id, product_id, size_ml, retail_price_cents, active) values
  ('00000000-0000-4000-8000-0000000011c1', '00000000-0000-4000-8000-0000000011a1', 100, 4990, true),
  ('00000000-0000-4000-8000-0000000011c3', '00000000-0000-4000-8000-0000000011a3', 100, 4990, true);
update public.products set status = 'published'
  where id in ('00000000-0000-4000-8000-0000000011a1', '00000000-0000-4000-8000-0000000011a3');
update public.products set status = 'archived'
  where id = '00000000-0000-4000-8000-0000000011a3';

create function pg_temp.act_as(user_id text, aal text) returns void
language sql as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', user_id, 'aal', aal, 'role', 'authenticated')::text,
    true
  );
$$;

-- Contador de hoy (Madrid) de un perfume y tipo; 0 si no hay fila.
create function pg_temp.hits(p_product uuid, p_kind text) returns integer
language sql as $$
  select coalesce(
    (select a.hits from internal.product_attention_daily a
     where a.product_id = p_product and a.kind = p_kind
       and a.day = (now() at time zone 'Europe/Madrid')::date),
    0);
$$;

-- Un minuto de hace dos horas (se borra con el primer evento del minuto) y
-- otro de hace media hora (se queda).
insert into internal.attention_rate (minute, hits) values
  (date_trunc('minute', now()) - interval '2 hours', 7),
  (date_trunc('minute', now()) - interval '30 minutes', 3);

-- Superficie
select ok(
  (select p.prosecdef and p.provolatile = 'v' and p.proconfig @> array['search_path=""']
   from pg_proc p
   where p.oid = 'public.track_product_event(text, text)'::regprocedure),
  'track_product_event es security definer, escribe y tiene search_path vacío');
select ok(
  (select p.prosecdef and p.provolatile = 's' and p.proconfig @> array['search_path=""']
   from pg_proc p
   where p.oid = 'public.admin_control_attention(date, date)'::regprocedure),
  'admin_control_attention es de lectura, security definer y con search_path vacío');
select ok(
  has_function_privilege('anon', 'public.track_product_event(text, text)', 'execute')
  and has_function_privilege('authenticated', 'public.track_product_event(text, text)',
    'execute'),
  'anon y authenticated pueden contar');
select ok(
  not has_function_privilege('anon', 'public.admin_control_attention(date, date)', 'execute'),
  'anon no ejecuta la lectura de la consola');
select is_empty(
  $$select r || ' ' || c.relname
    from unnest(array['anon', 'authenticated']) r
    cross join pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'internal'
      and c.relname in ('product_attention_daily', 'attention_rate')
      and has_table_privilege(r, c.oid, 'select,insert,update,delete,truncate')$$,
  'ni anon ni authenticated tienen privilegios en las tablas de atención');

-- anon
set local role anon;
select is(public.track_product_event('perfume-atencion', 'view'), true,
  'anon cuenta la visita a un perfume publicado');
select is(public.track_product_event('perfume-atencion', 'view'), true,
  'y otra más');
select is(public.track_product_event('perfume-atencion', 'scent_view'), true,
  'cuenta la ficha del catálogo olfativo');
select is(public.track_product_event('perfume-atencion', 'unboxing'), true,
  'cuenta la escena 3D');
select is(public.track_product_event('perfume-atencion', 'add_to_cart'), true,
  'acepta add_to_cart para cuando exista el carrito');
select is(public.track_product_event('borrador-atencion', 'view'), false,
  'no cuenta un borrador');
select is(public.track_product_event('archivado-atencion', 'view'), false,
  'ni un archivado');
select is(public.track_product_event('no-existe-atencion', 'view'), false,
  'ni un slug desconocido (igual que un borrador: no revela nada)');
select is(public.track_product_event('perfume-atencion', 'click'), false,
  'ni un tipo que no existe');
select is(public.track_product_event('perfume-atencion', null), false,
  'ni un tipo vacío');
select is(public.track_product_event(null, 'view'), false, 'ni un slug vacío');
select is(public.track_product_event('Perfume-Atencion', 'view'), false,
  'ni un slug con mayúsculas');
select is(public.track_product_event('perfume-atencion''; drop table x; --', 'view'), false,
  'ni un slug con otros caracteres');
select is(public.track_product_event(repeat('a', 161), 'view'), false,
  'ni un slug de más de 160 caracteres');
select is(public.track_product_event('', 'view'), false, 'ni un slug en blanco');
select throws_ok('select * from internal.product_attention_daily', '42501', null,
  'anon no lee los contadores');
select throws_ok('select * from internal.attention_rate', '42501', null,
  'ni el freno');
select throws_ok(
  $$insert into internal.product_attention_daily (product_id, day, kind, hits)
    values ('00000000-0000-4000-8000-0000000011a1', current_date, 'view', 1000)$$,
  '42501', null, 'ni escribe contadores directamente');
select throws_ok(
  $$select * from public.admin_control_attention('2026-09-01', '2026-10-01')$$,
  '42501', null, 'ni llama a la lectura de la consola');
reset role;

select is(pg_temp.hits('00000000-0000-4000-8000-0000000011a1', 'view'), 2,
  'dos visitas a la ficha, en el día de Madrid');
select is(pg_temp.hits('00000000-0000-4000-8000-0000000011a1', 'scent_view'), 1,
  'una del catálogo olfativo');
select is(pg_temp.hits('00000000-0000-4000-8000-0000000011a1', 'unboxing'), 1,
  'una de la escena 3D');
select is(pg_temp.hits('00000000-0000-4000-8000-0000000011a1', 'add_to_cart'), 1,
  'una de añadir al carrito');
select is_empty(
  $$select 1 from internal.product_attention_daily
    where product_id in ('00000000-0000-4000-8000-0000000011a2',
                         '00000000-0000-4000-8000-0000000011a3')$$,
  'nada del borrador ni del archivado');
select is(
  (select hits from internal.attention_rate where minute = date_trunc('minute', now())),
  5, 'el freno lleva la cuenta de los eventos contados en el minuto');
select is(
  (select array_agg(hits order by minute) from internal.attention_rate),
  array[3, 5], 'el primer evento del minuto borra los minutos de hace más de una hora');

-- authenticated sin personal (un cliente) también cuenta, pero no lee nada.
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000115', 'aal1');
select is(public.track_product_event('perfume-atencion', 'view'), true,
  'un cliente con sesión cuenta la visita');
select throws_ok('select * from internal.product_attention_daily', '42501', null,
  'pero no lee los contadores');
select throws_ok(
  $$select * from public.admin_control_attention('2026-09-01', '2026-10-01')$$,
  '42501', 'forbidden', 'ni la lectura de la consola');
reset role;
select is(pg_temp.hits('00000000-0000-4000-8000-0000000011a1', 'view'), 3,
  'tres visitas a la ficha');

-- Freno: con el minuto lleno no cuenta, no suma ni da error.
update internal.attention_rate set hits = 1200 where minute = date_trunc('minute', now());
set local role anon;
select is(public.track_product_event('perfume-atencion', 'view'), false,
  'pasado el freno no cuenta');
select lives_ok($$select public.track_product_event('perfume-atencion', 'scent_view')$$,
  'ni lanza errores');
reset role;
select is(pg_temp.hits('00000000-0000-4000-8000-0000000011a1', 'view'), 3,
  'el contador de visitas no suma');
select is(pg_temp.hits('00000000-0000-4000-8000-0000000011a1', 'scent_view'), 1,
  'ni el del catálogo olfativo');
select is(
  (select hits from internal.attention_rate where minute = date_trunc('minute', now())),
  1200, 'y el freno no sigue escribiendo');
-- Límite exacto: el evento 1200 del minuto cuenta; el 1201, no.
update internal.attention_rate set hits = 1199 where minute = date_trunc('minute', now());
set local role anon;
select is(public.track_product_event('perfume-atencion', 'view'), true,
  'el evento 1200 del minuto todavía cuenta');
select is(public.track_product_event('perfume-atencion', 'view'), false,
  'el 1201, no');
reset role;
select is(pg_temp.hits('00000000-0000-4000-8000-0000000011a1', 'view'), 4,
  'solo suma el que entra en el límite');

-- Días anteriores para la lectura de la consola.
insert into internal.product_attention_daily (product_id, day, kind, hits) values
  ('00000000-0000-4000-8000-0000000011a1', '2026-09-01', 'view', 12),
  ('00000000-0000-4000-8000-0000000011a1', '2026-09-01', 'unboxing', 3),
  ('00000000-0000-4000-8000-0000000011a1', '2026-09-30', 'scent_view', 5),
  ('00000000-0000-4000-8000-0000000011a1', '2026-10-01', 'view', 9);

-- Matriz de acceso de admin_control_attention
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000113', 'aal2');
select throws_ok(
  $$select * from public.admin_control_attention('2026-09-01', '2026-10-01')$$,
  '42501', 'forbidden', 'el encargado no lee los contadores');
select pg_temp.act_as('00000000-0000-4000-8000-000000000112', 'aal2');
select throws_ok(
  $$select * from public.admin_control_attention('2026-09-01', '2026-10-01')$$,
  '42501', 'forbidden', 'el administrador de la tienda tampoco');
select pg_temp.act_as('00000000-0000-4000-8000-000000000114', 'aal2');
select throws_ok(
  $$select * from public.admin_control_attention('2026-09-01', '2026-10-01')$$,
  '42501', 'forbidden', 'ni otro administrador del sistema no titular');
select pg_temp.act_as('00000000-0000-4000-8000-000000000111', 'aal1');
select throws_ok(
  $$select * from public.admin_control_attention('2026-09-01', '2026-10-01')$$,
  '42501', 'forbidden', 'ni el titular sin MFA');

-- Titular con MFA
select pg_temp.act_as('00000000-0000-4000-8000-000000000111', 'aal2');
select results_eq(
  $$select day, kind, hits from public.admin_control_attention('2026-09-01', '2026-10-01')
    where product_id = '00000000-0000-4000-8000-0000000011a1'$$,
  $$values ('2026-09-01'::date, 'unboxing', 3), ('2026-09-01'::date, 'view', 12),
           ('2026-09-30'::date, 'scent_view', 5)$$,
  'el titular lee [desde, hasta) ordenado por día y tipo');
select results_eq(
  $$select kind, hits
    from public.admin_control_attention(
      (now() at time zone 'Europe/Madrid')::date,
      (now() at time zone 'Europe/Madrid')::date + 1)
    where product_id = '00000000-0000-4000-8000-0000000011a1'$$,
  $$values ('add_to_cart', 1), ('scent_view', 1), ('unboxing', 1), ('view', 4)$$,
  'y los contadores de hoy');
select lives_ok(
  $$select * from public.admin_control_attention('2025-09-01', '2026-10-06')$$,
  'hasta 400 días');
select throws_ok(
  $$select * from public.admin_control_attention('2025-09-01', '2026-10-07')$$,
  '22023', 'invalid_period', 'no más de 400 días');
select throws_ok(
  $$select * from public.admin_control_attention('2026-10-01', '2026-10-01')$$,
  '22023', 'invalid_period', 'un periodo vacío no vale');
select throws_ok(
  $$select * from public.admin_control_attention('2026-10-01', '2026-09-01')$$,
  '22023', 'invalid_period', 'ni uno al revés');
select throws_ok(
  $$select * from public.admin_control_attention(null, '2026-10-01')$$,
  '22023', 'invalid_period', 'ni uno sin inicio');
reset role;

-- Al borrar un perfume se van sus contadores.
insert into internal.product_attention_daily (product_id, day, kind, hits) values
  ('00000000-0000-4000-8000-0000000011a3', '2026-09-01', 'view', 1);
delete from public.products where id = '00000000-0000-4000-8000-0000000011a3';
select is_empty(
  $$select 1 from internal.product_attention_daily
    where product_id = '00000000-0000-4000-8000-0000000011a3'$$,
  'los contadores se borran con el perfume');

select * from finish();
rollback;
