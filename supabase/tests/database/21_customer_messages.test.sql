-- Bandeja de mensajes (PLAN_BANDEJA_MENSAJES, A6.1): solo el servidor registra
-- consultas y correos recibidos y toma la cola de respuestas; el personal lee
-- con messages.view (el contacto con customers.view) y responde, anota,
-- asigna y cambia el estado con messages.reply y MFA. Datos ficticios; la
-- transacción se revierte.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(89);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000201', 'tienda@test.invalid'),
  ('00000000-0000-4000-8000-000000000202', 'encargado@test.invalid'),
  ('00000000-0000-4000-8000-000000000203', 'sistemas@test.invalid');
insert into public.staff_members (user_id, role, display_name) values
  ('00000000-0000-4000-8000-000000000201', 'store_admin', 'Tienda'),
  ('00000000-0000-4000-8000-000000000202', 'viewer', 'Encargado'),
  ('00000000-0000-4000-8000-000000000203', 'system_admin', null);

insert into public.brands (id, slug, name) values
  ('00000000-0000-4000-8000-0000000020b1', 'marca-mensajes', 'Marca de mensajes');
insert into public.products (id, brand_id, slug, name) values
  ('00000000-0000-4000-8000-0000000020a1', '00000000-0000-4000-8000-0000000020b1',
   'perfume-mensajes', 'Perfume de mensajes');
insert into public.product_variants (id, product_id, size_ml, retail_price_cents) values
  ('00000000-0000-4000-8000-0000000020c1', '00000000-0000-4000-8000-0000000020a1', 100, 5000);
update public.products set status = 'published'
  where id = '00000000-0000-4000-8000-0000000020a1';
insert into public.inventory_levels (variant_id, location_id, on_hand)
select '00000000-0000-4000-8000-0000000020c1', id, 10
from public.stock_locations where code = 'castelldefels';

create function pg_temp.act_as(user_id text, aal text) returns void
language sql as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', user_id, 'aal', aal, 'role', 'authenticated')::text,
    true
  );
$$;
create function pg_temp.as_server() returns void
language sql as $$
  select set_config('request.jwt.claims', '{"role": "service_role"}', true);
$$;
create function pg_temp.submit(p_request text, p_email text, p_order bigint default null)
returns jsonb
language sql as $$
  select public.web_contact_submit(p_request::uuid, 'ca', 'order', 'Clienta <Prova>',
    p_email, 'On és la meva comanda?', 'Hola, encara no m''ha arribat.', p_order);
$$;
create function pg_temp.conv(p_number bigint) returns uuid
language sql as $$ select id from public.conversations where number = p_number; $$;
create function pg_temp.rev(p_number bigint) returns integer
language sql as $$ select revision from public.conversations where number = p_number; $$;
create function pg_temp.status(p_number bigint) returns text
language sql as $$ select status from public.conversations where number = p_number; $$;
grant execute on function pg_temp.act_as(text, text), pg_temp.as_server(),
  pg_temp.submit(text, text, bigint), pg_temp.conv(bigint), pg_temp.rev(bigint),
  pg_temp.status(bigint)
  to service_role, authenticated, anon;

-- ---------------------------------------------------------------------------
-- Superficie
-- ---------------------------------------------------------------------------

select is_empty(
  $$select p.proname from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('web_contact_submit', 'web_inbound_email_record',
                        'web_message_emails_claim', 'web_message_email_result')
      and (has_function_privilege('anon', p.oid, 'execute')
           or has_function_privilege('authenticated', p.oid, 'execute')
           or not has_function_privilege('service_role', p.oid, 'execute'))$$,
  'solo service_role registra consultas y correos y toma la cola');
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and (p.proname like 'web\_contact\_%' or p.proname like 'web\_inbound\_%'
          or p.proname like 'web\_message\_%')),
  4, 'hay cuatro funciones del servidor para los mensajes');
select is_empty(
  $$select p.proname from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname in ('message_status_after', 'message_status_transition', 'message_email',
                        'add_customer_message', 'open_conversation', 'require_message_reply',
                        'lock_conversation')
      and (has_function_privilege('authenticated', p.oid, 'execute')
           or has_function_privilege('service_role', p.oid, 'execute'))$$,
  'nadie llama directamente a los auxiliares privados');
select ok(
  not has_table_privilege('anon', 'private.conversation_reply_tokens', 'select')
  and not has_table_privilege('authenticated', 'private.conversation_reply_tokens', 'select'),
  'nadie lee las claves de respuesta');
select is_empty(
  $$select c.relname from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('conversations', 'conversation_contacts', 'conversation_messages',
                        'message_emails', 'message_templates')
      and (has_table_privilege('authenticated', c.oid, 'insert,update,delete,truncate')
           or has_table_privilege('anon', c.oid, 'select,insert,update,delete,truncate'))$$,
  'nadie escribe directamente y anon no lee nada');
select ok(
  (select array_agg(table_name::text order by sort_order)
   from private.control_export_tables()
   where table_name in ('conversations', 'conversation_contacts', 'conversation_messages',
                        'message_emails', 'message_templates', 'conversation_reply_tokens'))
  = array['conversations', 'conversation_contacts', 'conversation_messages',
          'message_emails', 'message_templates', 'conversation_reply_tokens'],
  'la copia diaria incluye las conversaciones y sus claves');

set local role anon;
select pg_temp.as_server();
select throws_ok(
  $$select pg_temp.submit('00000000-0000-4000-8000-0000000020d0', 'anon@test.invalid')$$,
  '42501', null, 'anon no registra consultas aunque diga ser el servidor');
reset role;

set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000203', 'aal2');
select throws_ok(
  $$select pg_temp.submit('00000000-0000-4000-8000-0000000020d0', 'staff@test.invalid')$$,
  '42501', null, 'ni el administrador del sistema registra consultas desde la API');
select throws_ok(
  $$select public.web_message_emails_claim(5)$$,
  '42501', null, 'el personal no toma la cola de respuestas');
select throws_ok(
  $$insert into public.conversations (channel, subject, locale) values ('web_form', 'x', 'es')$$,
  '42501', null, 'el personal no crea conversaciones directamente');
reset role;

-- ---------------------------------------------------------------------------
-- Formulario (servidor)
-- ---------------------------------------------------------------------------

set local role service_role;
select pg_temp.as_server();
select public.web_order_create('00000000-0000-4000-8000-0000000020e1', 'es', 'click_collect',
  null, '[{"variant_id": "00000000-0000-4000-8000-0000000020c1", "quantity": 1}]',
  '{"full_name": "Clienta", "email": "Clienta@Test.invalid"}', 'redsys', 30);
reset role;
create temporary table ids on commit drop as
  select (select number from public.orders
          where request_id = '00000000-0000-4000-8000-0000000020e1') as order_number;
grant select on ids to service_role, authenticated;

set local role service_role;
select pg_temp.as_server();
select is(
  (pg_temp.submit('00000000-0000-4000-8000-0000000020d1', '  Clienta@Test.INVALID ',
    (select order_number from ids)) ->> 'duplicate'),
  'false', 'el servidor registra la consulta');
select is(
  (pg_temp.submit('00000000-0000-4000-8000-0000000020d1', 'clienta@test.invalid') ->> 'number')::bigint,
  (select number from public.conversations where request_id = '00000000-0000-4000-8000-0000000020d1'),
  'el mismo formulario otra vez devuelve la misma consulta');
select is(
  (select count(*)::int from public.conversations), 1, 'y no crea otra');
reset role;

create temporary table c1 on commit drop as
  select number from public.conversations where request_id = '00000000-0000-4000-8000-0000000020d1';
grant select on c1 to service_role, authenticated;

select results_eq(
  $$select channel, status, topic, locale, order_id is not null,
           last_customer_message_at is not null, last_staff_message_at is null
    from public.conversations where number = (select number from c1)$$,
  $$values ('web_form', 'open', 'order', 'ca', true, true, true)$$,
  'consulta abierta, en catalán y enlazada al pedido del mismo email');
select results_eq(
  $$select full_name, email from public.conversation_contacts
    where conversation_id = pg_temp.conv((select number from c1))$$,
  $$values ('Clienta <Prova>', 'clienta@test.invalid')$$,
  'contacto con el email normalizado');
select results_eq(
  $$select kind, source, body, author_id is null from public.conversation_messages
    where conversation_id = pg_temp.conv((select number from c1))$$,
  $$values ('customer', 'web_form', 'Hola, encara no m''ha arribat.', true)$$,
  'primer mensaje del cliente');
select ok(
  (select token ~ '^[0-9a-f]{32}$' from private.conversation_reply_tokens
   where conversation_id = pg_temp.conv((select number from c1))),
  'cada conversación tiene su clave de respuesta');

set local role service_role;
select pg_temp.as_server();
select is(
  (select order_id from public.conversations
   where number = (pg_temp.submit('00000000-0000-4000-8000-0000000020d2', 'otra@test.invalid',
     (select order_number from ids)) ->> 'number')::bigint),
  null, 'con el número de un pedido de otro email no se enlaza (y no lo dice)');
select throws_ok(
  $$select pg_temp.submit('00000000-0000-4000-8000-0000000020d3', 'no-es-un-email')$$,
  '22023', 'invalid_email', 'rechaza un email sin forma de email');
select throws_ok(
  $$select public.web_contact_submit('00000000-0000-4000-8000-0000000020d3', 'fr', 'order',
    'A', 'a@test.invalid', 'S', 'B')$$,
  '22023', 'invalid_request', 'rechaza un idioma que la tienda no tiene');
select throws_ok(
  $$select public.web_contact_submit('00000000-0000-4000-8000-0000000020d3', 'es', 'other',
    'A', 'a@test.invalid', 'S', '   ')$$,
  '22023', 'invalid_message', 'rechaza un mensaje vacío');
select throws_ok(
  $$select public.web_contact_submit('00000000-0000-4000-8000-0000000020d3', 'es', 'other',
    'A', 'a@test.invalid', 'S', repeat('x', 5001))$$,
  '22023', 'invalid_message', 'rechaza un mensaje de más de 5000 caracteres');
select lives_ok(
  $$select pg_temp.submit('00000000-0000-4000-8000-0000000020d4', 'clienta@test.invalid'),
           pg_temp.submit('00000000-0000-4000-8000-0000000020d5', 'clienta@test.invalid')$$,
  'tres consultas en una hora del mismo email se aceptan');
select throws_ok(
  $$select pg_temp.submit('00000000-0000-4000-8000-0000000020d6', 'CLIENTA@test.invalid')$$,
  '54000', 'rate_limited', 'la cuarta, no (aunque cambie mayúsculas)');
select lives_ok(
  $$select public.web_contact_submit(
      ('00000000-0000-4000-8000-' || lpad(to_hex(4096 + g), 12, '0'))::uuid,
      'es', 'other', 'Persona', 'p' || g || '@test.invalid', 'Asunto', 'Mensaje')
    from generate_series(1, 26) g$$,
  'muchas personas distintas pueden escribir');
select throws_ok(
  $$select pg_temp.submit('00000000-0000-4000-8000-0000000020d7', 'una-mas@test.invalid')$$,
  '54000', 'rate_limited', 'hasta 30 consultas cada 10 minutos en total');
reset role;
delete from public.conversations where request_id::text like '00000000-0000-4000-8000-00000000%'
  and number not in (select number from c1)
  and request_id <> '00000000-0000-4000-8000-0000000020d2';

-- ---------------------------------------------------------------------------
-- Lectura del personal
-- ---------------------------------------------------------------------------

set local role authenticated;
-- Sin MFA, nada: todo permiso del personal la exige, también leer (§159).
select pg_temp.act_as('00000000-0000-4000-8000-000000000201', 'aal1');
select is((select count(*)::int from public.conversations), 0,
  'sin MFA, el personal no ve las conversaciones');
select throws_ok(
  $$select public.admin_reply_conversation(pg_temp.conv((select number from c1)), 'Hola', 1)$$,
  '42501', null, 'responder exige MFA');
select pg_temp.act_as('00000000-0000-4000-8000-000000000202', 'aal2');
select is((select count(*)::int from public.conversations), 2, 'el encargado ve las conversaciones');
select is((select count(*)::int from public.conversation_messages), 2, 'y sus mensajes');
select is((select count(*)::int from public.conversation_contacts), 0,
  'pero no el nombre ni el email del cliente');
select pg_temp.act_as('00000000-0000-4000-8000-000000000201', 'aal2');
select is((select count(*)::int from public.conversation_contacts), 2,
  'la tienda (con customers.view) ve el contacto');
select pg_temp.act_as('00000000-0000-4000-8000-000000000202', 'aal2');
select throws_ok(
  $$select public.admin_reply_conversation(pg_temp.conv((select number from c1)), 'Hola', 1)$$,
  '42501', null, 'el encargado no responde');
select throws_ok(
  $$select public.admin_add_conversation_note(pg_temp.conv((select number from c1)), 'Nota')$$,
  '42501', null, 'ni anota');
select results_eq(
  $$select user_id from public.admin_message_assignees()
    where user_id::text like '00000000-0000-4000-8000-00000000020_' order by user_id$$,
  $$values ('00000000-0000-4000-8000-000000000201'::uuid), ('00000000-0000-4000-8000-000000000203'::uuid)$$,
  'se puede asignar a quien responde, no al encargado');
select results_eq(
  $$select name from public.admin_message_assignees()
    where user_id = '00000000-0000-4000-8000-000000000203'$$,
  $$values ('sistemas')$$,
  'sin nombre visible, la parte local del email');

-- ---------------------------------------------------------------------------
-- Respuesta, cola y notas
-- ---------------------------------------------------------------------------

select pg_temp.act_as('00000000-0000-4000-8000-000000000201', 'aal2');
select throws_ok(
  $$select public.admin_reply_conversation(pg_temp.conv((select number from c1)), 'Hola', 99)$$,
  '55000', 'stale_revision', 'responder sobre una versión vieja no hace nada');
select throws_ok(
  $$select public.admin_reply_conversation(pg_temp.conv((select number from c1)), '  ',
    pg_temp.rev((select number from c1)))$$,
  '22023', 'invalid_message', 'una respuesta vacía no sale');
select is(
  (public.admin_reply_conversation(pg_temp.conv((select number from c1)),
    E'  Bon dia,\nja l''hem enviat.  ', pg_temp.rev((select number from c1)))).status,
  'waiting_customer', 'responder deja la conversación esperando al cliente');
select results_eq(
  $$select m.kind, m.source, m.body, m.author_id, e.status
    from public.conversation_messages m
    join public.message_emails e on e.message_id = m.id
    where m.conversation_id = pg_temp.conv((select number from c1))$$,
  $$values ('reply', 'panel', E'Bon dia,\nja l''hem enviat.',
            '00000000-0000-4000-8000-000000000201'::uuid, 'pending')$$,
  'la respuesta queda guardada y su correo en la cola');
select ok(
  (select last_staff_message_at >= last_customer_message_at
   from public.conversations where number = (select number from c1)),
  'y cuenta como respondida para el plazo');
reset role;
select is(
  (select count(*)::int from public.audit_log
   where action = 'messages.reply' and after ? 'number'
     and not (after::text like '%enviat%') and not (after::text like '%clienta%')),
  1, 'la auditoría registra la respuesta sin el texto ni el email');
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000201', 'aal2');
select throws_ok(
  $$select public.admin_reply_conversation(pg_temp.conv((select number from c1)), 'Otra', 1)$$,
  '55000', 'stale_revision', 'un doble clic con la revisión anterior no responde dos veces');

create temporary table r1 on commit drop as select pg_temp.rev((select number from c1)) as revision;
select ok(
  public.admin_add_conversation_note(pg_temp.conv((select number from c1)), 'Llamar mañana') > 0,
  'la tienda añade una nota interna');
select is(pg_temp.rev((select number from c1)), (select revision from r1),
  'la nota no cambia la revisión');
select is(
  (select count(*)::int from public.message_emails), 1, 'ni manda correo');
reset role;

set local role service_role;
select pg_temp.as_server();
create temporary table jobs on commit drop as
  select public.web_message_emails_claim(5) as data;
reset role;
select results_eq(
  $$select j ->> 'email', j ->> 'locale', j ->> 'subject', j ->> 'quoted',
           j ->> 'in_reply_to', j ->> 'token' ~ '^[0-9a-f]{32}$'
    from jobs, jsonb_array_elements(data) j$$,
  $$values ('clienta@test.invalid', 'ca', 'On és la meva comanda?',
            'Hola, encara no m''ha arribat.', null::text, true)$$,
  'el servidor toma la respuesta con lo que necesita el correo');
set local role service_role;
select pg_temp.as_server();
select is(public.web_message_emails_claim(5), '[]'::jsonb,
  'mientras se envía, nadie más la toma');
select public.web_message_email_result(
  ((select data from jobs) -> 0 ->> 'id')::bigint, true, 'resend-1');
reset role;
select results_eq(
  'select status, provider_id, attempts from public.message_emails',
  $$values ('sent', 'resend-1', 1)$$, 'enviada a la primera');

-- ---------------------------------------------------------------------------
-- Correo entrante (servidor)
-- ---------------------------------------------------------------------------

create temporary table tok on commit drop as
  select t.token from private.conversation_reply_tokens t
  where t.conversation_id = pg_temp.conv((select number from c1));
grant select on tok to service_role;

set local role service_role;
select pg_temp.as_server();
select is(
  public.web_inbound_email_record('in-1', (select token from tok), 'CLIENTA@test.invalid',
    'Clienta', 'Re: On és la meva comanda?', 'Gràcies!', '<msg-1@test>', 2, true) ->> 'action',
  'appended', 'la contestación del cliente vuelve a su conversación');
select is(pg_temp.status((select number from c1)), 'open', 'y la vuelve a abrir');
select is(
  public.web_inbound_email_record('in-1', (select token from tok), 'clienta@test.invalid',
    'Clienta', 'Re', 'Gràcies!', '<msg-1@test>', 2, true) ->> 'action',
  'duplicate', 'el mismo correo dos veces se registra una');
select is(
  public.web_inbound_email_record('in-2', (select token from tok), 'otra@test.invalid',
    'Otra', 'Re: On és la meva comanda?', 'Soc una altra persona', null, 0, true) ->> 'action',
  'created', 'con la clave pero desde otro email abre otra conversación');
select is(
  public.web_inbound_email_record('in-3', (select token from tok), 'clienta@test.invalid',
    'Clienta', 'Suplantació', 'Text', null, 0, false) ->> 'action',
  'created', 'si DMARC falla tampoco entra en la conversación');
select is(
  public.web_inbound_email_record('in-4', null, 'nou@test.invalid', null, '  ', '', null, 0, true)
    ->> 'action',
  'created', 'un correo sin clave abre una conversación nueva');
select throws_ok(
  $$select public.web_inbound_email_record('in-5', null, 'sin-forma', null, 'S', 'B')$$,
  '22023', 'invalid_email', 'rechaza un remitente sin forma de email');
reset role;

select results_eq(
  $$select kind, source, body, attachments, email_message_id from public.conversation_messages
    where inbound_email_id = 'in-1'$$,
  $$values ('customer', 'email', 'Gràcies!', 2, '<msg-1@test>')$$,
  'el correo se guarda como texto, con sus adjuntos contados y su Message-ID');
select results_eq(
  $$select c.channel, c.status, c.locale, k.email from public.conversations c
    join public.conversation_contacts k on k.conversation_id = c.id
    join public.conversation_messages m on m.conversation_id = c.id
    where m.inbound_email_id in ('in-2', 'in-3') order by m.inbound_email_id$$,
  $$values ('email', 'open', 'ca', 'otra@test.invalid'), ('email', 'spam', 'ca', 'clienta@test.invalid')$$,
  'las nuevas conservan el idioma; la que no pasó DMARC va a spam');
select results_eq(
  $$select c.subject, m.body, k.full_name from public.conversations c
    join public.conversation_contacts k on k.conversation_id = c.id
    join public.conversation_messages m on m.conversation_id = c.id
    where m.inbound_email_id = 'in-4'$$,
  $$values ('(sin asunto)', '(sin texto)', null::text)$$,
  'sin asunto, texto ni nombre, con marcas en lugar de vacíos');

set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000201', 'aal2');
select public.admin_reply_conversation(pg_temp.conv((select number from c1)), 'De res!',
  pg_temp.rev((select number from c1)));
reset role;
set local role service_role;
select pg_temp.as_server();
select results_eq(
  $$select j ->> 'quoted', j ->> 'in_reply_to' from jsonb_array_elements(public.web_message_emails_claim(5)) j$$,
  $$values ('Gràcies!', '<msg-1@test>')$$,
  'la segunda respuesta cita el correo del cliente y se encadena a él');
reset role;

-- ---------------------------------------------------------------------------
-- Estado, asignación, pedido y plantillas
-- ---------------------------------------------------------------------------

set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000201', 'aal2');
select is(
  (public.admin_set_conversation_status(pg_temp.conv((select number from c1)), 'resolved',
    pg_temp.rev((select number from c1)))).status,
  'resolved', 'se da por resuelta');
select throws_ok(
  $$select public.admin_set_conversation_status(pg_temp.conv((select number from c1)), 'spam',
    pg_temp.rev((select number from c1)))$$,
  '22023', 'invalid_transition', 'una resuelta solo se reabre');
select is(
  (public.admin_set_conversation_status(pg_temp.conv((select number from c1)), 'open',
    pg_temp.rev((select number from c1)))).status,
  'open', 'se reabre');
select is(
  (public.admin_set_conversation_status(pg_temp.conv((select number from c1)), 'spam',
    pg_temp.rev((select number from c1)))).status,
  'spam', 'se marca como spam');
select throws_ok(
  $$select public.admin_reply_conversation(pg_temp.conv((select number from c1)), 'Hola',
    pg_temp.rev((select number from c1)))$$,
  '55000', 'conversation_spam', 'no se responde a spam');
reset role;
set local role service_role;
select pg_temp.as_server();
select public.web_inbound_email_record('in-6', (select token from tok), 'clienta@test.invalid',
  'Clienta', 'Re', 'Altra vegada', null, 0, true);
reset role;
select is(pg_temp.status((select number from c1)), 'spam',
  'un mensaje nuevo en spam no la saca de spam');

set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000201', 'aal2');
select public.admin_set_conversation_status(pg_temp.conv((select number from c1)), 'open',
  pg_temp.rev((select number from c1)));
select is(
  (public.admin_assign_conversation(pg_temp.conv((select number from c1)),
    '00000000-0000-4000-8000-000000000203', pg_temp.rev((select number from c1)))).assigned_to,
  '00000000-0000-4000-8000-000000000203'::uuid, 'se asigna a otra persona que responde');
select throws_ok(
  $$select public.admin_assign_conversation(pg_temp.conv((select number from c1)),
    '00000000-0000-4000-8000-000000000202', pg_temp.rev((select number from c1)))$$,
  '22023', 'invalid_assignee', 'no al encargado, que no responde');
select is(
  (public.admin_assign_conversation(pg_temp.conv((select number from c1)), null,
    pg_temp.rev((select number from c1)))).assigned_to,
  null, 'y se quita la asignación');
select is(
  (public.admin_link_conversation_order(pg_temp.conv((select number from c1)), null,
    pg_temp.rev((select number from c1)))).order_id,
  null, 'se quita el pedido enlazado');
select is(
  (public.admin_link_conversation_order(pg_temp.conv((select number from c1)),
    (select order_number from ids), pg_temp.rev((select number from c1)))).order_id,
  (select id from public.orders where request_id = '00000000-0000-4000-8000-0000000020e1'),
  'y se enlaza por su número');
select throws_ok(
  $$select public.admin_link_conversation_order(pg_temp.conv((select number from c1)), 1,
    pg_temp.rev((select number from c1)))$$,
  '22023', 'unknown_order', 'un número de pedido que no existe');

create temporary table tpl on commit drop as
  select * from public.admin_save_message_template(null, ' Envío en camino ', 'es',
    'Tu pedido ya está en camino.', true);
select results_eq(
  'select title, locale, active, revision from tpl',
  $$values ('Envío en camino', 'es', true, 1)$$, 'se crea una plantilla');
select throws_ok(
  $$select public.admin_save_message_template(null, 'Envío en camino', 'es', 'Otro', true)$$,
  '23505', 'duplicate_template', 'no hay dos plantillas con el mismo título e idioma');
select lives_ok(
  $$select public.admin_save_message_template(null, 'Envío en camino', 'ca', 'Ja és en camí.', true)$$,
  'el mismo título en otro idioma, sí');
select is(
  (public.admin_save_message_template((select id from tpl), 'Envío en camino', 'es',
    'Tu pedido ya está en camino. ¡Gracias!', false, 1)).revision,
  2, 'se cambia con su revisión');
select throws_ok(
  $$select public.admin_save_message_template((select id from tpl), 'Envío', 'es', 'X', true, 1)$$,
  '55000', 'stale_revision', 'y no sobre una versión vieja');
select pg_temp.act_as('00000000-0000-4000-8000-000000000202', 'aal1');
select is((select count(*)::int from public.message_templates), 0, 'sin MFA, ni las plantillas');
select pg_temp.act_as('00000000-0000-4000-8000-000000000202', 'aal2');
select is((select count(*)::int from public.message_templates), 2, 'el encargado lee las plantillas');
select throws_ok(
  $$select public.admin_save_message_template(null, 'Mía', 'es', 'X', true)$$,
  '42501', null, 'pero no las cambia');

-- ---------------------------------------------------------------------------
-- Borrado
-- ---------------------------------------------------------------------------

select throws_ok(
  $$select public.admin_delete_conversation(pg_temp.conv((select number from c1)),
    pg_temp.rev((select number from c1)))$$,
  '42501', null, 'el encargado no borra conversaciones');
select pg_temp.act_as('00000000-0000-4000-8000-000000000201', 'aal1');
select throws_ok(
  $$select public.admin_delete_conversation(pg_temp.conv((select number from c1)),
    pg_temp.rev((select number from c1)))$$,
  '42501', null, 'borrar exige MFA');
select pg_temp.act_as('00000000-0000-4000-8000-000000000201', 'aal2');
select lives_ok(
  $$select public.admin_delete_conversation(pg_temp.conv((select number from c1)),
    pg_temp.rev((select number from c1)))$$,
  'la tienda borra una conversación (customers.manage)');
reset role;
select is(
  (select count(*)::int from public.conversation_messages m
   where not exists (select 1 from public.conversations c where c.id = m.conversation_id))
  + (select count(*)::int from public.conversation_contacts k
     where not exists (select 1 from public.conversations c where c.id = k.conversation_id))
  + (select count(*)::int from private.conversation_reply_tokens t
     where not exists (select 1 from public.conversations c where c.id = t.conversation_id)),
  0, 'con sus mensajes, contacto y clave');
select is(
  (select count(*)::int from public.message_emails), 0, 'y sus correos en la cola');
select is(
  (select count(*)::int from public.audit_log
   where action = 'messages.delete' and before ? 'number' and not (before::text like '%@%')),
  1, 'la auditoría guarda el borrado sin datos del cliente');
select is(
  (select count(*)::int from public.conversations where number = (select number from c1)), 0,
  'la conversación ya no existe');
select is(
  (select count(*)::int from public.orders where request_id = '00000000-0000-4000-8000-0000000020e1'),
  1, 'el pedido enlazado sigue ahí');
select is(
  (select count(*)::int from public.audit_log
   where action in ('messages.status', 'messages.assign', 'messages.link_order',
                    'messages.template', 'messages.note')),
  12, 'cada cambio del panel queda en la auditoría');

select * from finish();
rollback;
