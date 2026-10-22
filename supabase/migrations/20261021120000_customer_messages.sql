-- Bandeja de mensajes con clientes (docs/PLAN_BANDEJA_MENSAJES.md, fase A6.1
-- de ADMIN_PLAN; DECISIONS §153–157). Una conversación agrupa los mensajes de
-- una consulta: lo que escribe el cliente (formulario de la web o email), las
-- respuestas del personal, que salen por email, y sus notas internas.
--
-- Escrituras: el servidor con la clave privilegiada (web_contact_submit,
-- web_inbound_email_record y la cola web_message_emails_*; §154) y el panel
-- con funciones admin_* que comprueban permiso y MFA. Lectura del personal con
-- messages.view; el nombre y el email del cliente exigen además customers.view.
--
-- Estados y transiciones: mismo cuadro que src/modules/messaging/domain/
-- conversations.ts; tests/unit/messaging-sql.test.ts lo vigila y
-- supabase/tests/database/21_customer_messages.test.sql prueba los casos.

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  -- Número visible para el cliente (asunto del correo) y el personal.
  number bigint generated always as identity (start with 1001) unique,
  -- Idempotencia del formulario: repetir el envío no crea otra consulta.
  request_id uuid unique,
  channel text not null check (channel in ('web_form', 'email', 'whatsapp')),
  status text not null default 'open'
    check (status in ('open', 'waiting_customer', 'resolved', 'spam')),
  topic text not null default 'other' check (topic in ('order', 'product', 'other')),
  subject text not null check (char_length(subject) between 1 and 200),
  -- Idioma en el que escribe el cliente: el de las respuestas.
  locale text not null check (locale in ('es', 'ca', 'en')),
  order_id uuid references public.orders (id) on delete set null,
  assigned_to uuid references auth.users (id) on delete set null,
  -- Para el plazo de respuesta (isOverdue) y el orden de la bandeja.
  last_customer_message_at timestamptz,
  last_staff_message_at timestamptz,
  last_message_at timestamptz not null default now(),
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index conversations_inbox_idx on public.conversations (status, last_message_at desc);
create index conversations_order_idx on public.conversations (order_id);
create index conversations_assigned_idx on public.conversations (assigned_to);

create trigger conversations_updated_at
  before update on public.conversations
  for each row execute function private.set_updated_at();

-- Datos personales: solo con messages.view y customers.view.
create table public.conversation_contacts (
  conversation_id uuid primary key references public.conversations (id) on delete cascade,
  -- Un correo puede llegar sin nombre.
  full_name text check (char_length(full_name) between 1 and 120),
  email text not null check (
    char_length(email) <= 254
    and email = lower(email)
    and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ),
  created_at timestamptz not null default now()
);

create index conversation_contacts_email_idx on public.conversation_contacts (email);

-- customer: lo que escribe el cliente; reply: respuesta del personal, que sale
-- por email; note: nota interna, que el cliente nunca ve. Sin disparador de
-- solo inserción: nadie las cambia (no hay permisos ni funciones para ello),
-- pero borrar una conversación (spam o derecho de supresión) borra sus mensajes.
create table public.conversation_messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  kind text not null check (kind in ('customer', 'reply', 'note')),
  source text not null check (source in ('web_form', 'email', 'panel')),
  -- Texto plano: el panel nunca pinta HTML de un correo.
  body text not null check (char_length(body) between 1 and 10000),
  author_id uuid references auth.users (id) on delete set null,
  -- Correo recibido: su id en el proveedor (no se registra dos veces) y su
  -- Message-ID (para encadenar la respuesta en el programa de correo).
  inbound_email_id text unique check (char_length(inbound_email_id) between 1 and 200),
  email_message_id text check (char_length(email_message_id) between 1 and 300),
  -- Los adjuntos no se guardan: solo cuántos traía el correo.
  attachments integer not null default 0 check (attachments between 0 and 100),
  created_at timestamptz not null default clock_timestamp(),
  constraint customer_messages_come_from_outside
    check ((kind = 'customer') = (source <> 'panel')),
  constraint inbound_ids_only_on_customer_email
    check (inbound_email_id is null or (kind = 'customer' and source = 'email'))
);

create index conversation_messages_conversation_idx
  on public.conversation_messages (conversation_id, created_at);
create index conversation_messages_author_idx on public.conversation_messages (author_id);

-- Cola de las respuestas por email (como order_emails, §138): la respuesta se
-- encola en la misma transacción y el servidor la envía después.
create table public.message_emails (
  message_id bigint primary key references public.conversation_messages (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'sending', 'sent', 'failed')),
  attempts integer not null default 0 check (attempts between 0 and 10),
  locked_until timestamptz,
  -- Código del proveedor o del error, sin datos personales ni la respuesta.
  last_error text check (char_length(last_error) <= 200),
  provider_id text check (char_length(provider_id) <= 200),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index message_emails_pending_idx on public.message_emails (created_at)
  where status in ('pending', 'sending');

create table public.message_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 80),
  locale text not null check (locale in ('es', 'ca', 'en')),
  body text not null check (char_length(body) between 1 and 5000),
  active boolean not null default true,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (title, locale)
);

create trigger message_templates_updated_at
  before update on public.message_templates
  for each row execute function private.set_updated_at();

-- Clave de la dirección de respuesta (consulta-<clave>@subdominio). Sin ella
-- nadie puede añadir mensajes a una conversación, así que no la lee nadie más
-- que las funciones.
create table private.conversation_reply_tokens (
  conversation_id uuid primary key references public.conversations (id) on delete cascade,
  token text not null unique default replace(gen_random_uuid()::text, '-', '')
    check (token ~ '^[0-9a-f]{32}$')
);

-- ---------------------------------------------------------------------------
-- RLS: lectura del personal; nadie escribe directamente
-- ---------------------------------------------------------------------------

alter table public.conversations enable row level security;
alter table public.conversation_contacts enable row level security;
alter table public.conversation_messages enable row level security;
alter table public.message_emails enable row level security;
alter table public.message_templates enable row level security;
alter table private.conversation_reply_tokens enable row level security;

revoke all on public.conversations, public.conversation_contacts,
  public.conversation_messages, public.message_emails, public.message_templates
  from anon;
revoke insert, update, delete, truncate on public.conversations,
  public.conversation_contacts, public.conversation_messages,
  public.message_emails, public.message_templates
  from authenticated;
revoke all on private.conversation_reply_tokens from public, anon, authenticated;

create policy "messages.view lee las conversaciones" on public.conversations
  for select to authenticated using ((select private.has_permission('messages.view')));
create policy "messages.view lee los mensajes" on public.conversation_messages
  for select to authenticated using ((select private.has_permission('messages.view')));
create policy "messages.view lee la cola de respuestas" on public.message_emails
  for select to authenticated using ((select private.has_permission('messages.view')));
create policy "messages.view lee las plantillas" on public.message_templates
  for select to authenticated using ((select private.has_permission('messages.view')));
create policy "messages.view y customers.view leen el contacto" on public.conversation_contacts
  for select to authenticated
  using (
    (select private.has_permission('messages.view'))
    and (select private.has_permission('customers.view'))
  );

-- ---------------------------------------------------------------------------
-- Reglas (mismo cuadro que modules/messaging)
-- ---------------------------------------------------------------------------

-- Estado tras un mensaje; null si el mensaje no procede (responder a spam).
create function private.message_status_after(p_status text, p_kind text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_kind
    when 'customer' then case when p_status = 'spam' then 'spam' else 'open' end
    when 'reply' then case when p_status = 'spam' then null else 'waiting_customer' end
    else p_status
  end;
$$;

-- Cambios de estado a mano (MANUAL en TS, mismo orden).
create function private.message_status_transition(p_from text, p_to text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select (p_from, p_to) in (
    ('open', 'resolved'),
    ('open', 'spam'),
    ('waiting_customer', 'resolved'),
    ('waiting_customer', 'spam'),
    ('resolved', 'open'),
    ('spam', 'open')
  );
$$;

-- Normaliza un email como el formulario (minúsculas y sin espacios); null si
-- no tiene forma de email.
create function private.message_email(p_email text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when char_length(v) <= 254 and v ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
      then v
  end
  from (select lower(btrim(coalesce(p_email, ''))) as v) s;
$$;

-- Añade un mensaje del cliente y aplica su efecto en la conversación.
create function private.add_customer_message(
  p_conversation_id uuid,
  p_source text,
  p_body text,
  p_inbound_email_id text default null,
  p_email_message_id text default null,
  p_attachments integer default 0
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_at timestamptz := clock_timestamp();
begin
  insert into public.conversation_messages (
    conversation_id, kind, source, body, inbound_email_id, email_message_id,
    attachments, created_at)
  values (p_conversation_id, 'customer', p_source, p_body, p_inbound_email_id,
          p_email_message_id, coalesce(p_attachments, 0), v_at);
  update public.conversations c
  set status = private.message_status_after(c.status, 'customer'),
      last_customer_message_at = v_at,
      last_message_at = v_at,
      revision = c.revision + 1
  where c.id = p_conversation_id;
end;
$$;

-- Crea una conversación con su contacto, su clave y el primer mensaje.
create function private.open_conversation(
  p_channel text,
  p_status text,
  p_topic text,
  p_subject text,
  p_locale text,
  p_full_name text,
  p_email text,
  p_order_id uuid,
  p_request_id uuid,
  p_body text,
  p_inbound_email_id text default null,
  p_email_message_id text default null,
  p_attachments integer default 0
)
returns public.conversations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conversation public.conversations;
begin
  insert into public.conversations (request_id, channel, status, topic, subject, locale, order_id)
  values (p_request_id, p_channel, p_status, p_topic, p_subject, p_locale, p_order_id)
  returning * into v_conversation;
  insert into public.conversation_contacts (conversation_id, full_name, email)
  values (v_conversation.id, p_full_name, p_email);
  insert into private.conversation_reply_tokens (conversation_id)
  values (v_conversation.id);
  perform private.add_customer_message(
    v_conversation.id, case when p_channel = 'web_form' then 'web_form' else 'email' end,
    p_body, p_inbound_email_id, p_email_message_id, p_attachments);
  select * into v_conversation from public.conversations where id = v_conversation.id;
  return v_conversation;
end;
$$;

-- ---------------------------------------------------------------------------
-- Formulario de contacto (solo el servidor, tras CONTACT_FORM; §154)
-- ---------------------------------------------------------------------------

-- Valida y registra una consulta. Idempotente por p_request_id. Con número de
-- pedido, la enlaza solo si el email es el del pedido; si no, lo ignora sin
-- decirlo (no confirma qué pedidos existen). Límites: 3 consultas por email y
-- hora y 30 en total cada 10 minutos (54000, «inténtalo más tarde»).
create function public.web_contact_submit(
  p_request_id uuid,
  p_locale text,
  p_topic text,
  p_full_name text,
  p_email text,
  p_subject text,
  p_body text,
  p_order_number bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := private.message_email(p_email);
  v_name text := btrim(coalesce(p_full_name, ''));
  v_subject text := btrim(coalesce(p_subject, ''));
  v_body text := btrim(coalesce(p_body, ''));
  v_existing bigint;
  v_order_id uuid;
  v_conversation public.conversations;
begin
  if not private.is_service_role() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_request_id is null or p_locale is null or p_locale not in ('es', 'ca', 'en')
     or p_topic is null or p_topic not in ('order', 'product', 'other') then
    raise exception 'invalid_request' using errcode = '22023';
  end if;
  if v_email is null then
    raise exception 'invalid_email' using errcode = '22023';
  end if;
  if char_length(v_name) not between 1 and 120
     or char_length(v_subject) not between 1 and 200
     or char_length(v_body) not between 1 and 5000 then
    raise exception 'invalid_message' using errcode = '22023';
  end if;

  select c.number into v_existing from public.conversations c where c.request_id = p_request_id;
  if found then
    return jsonb_build_object('number', v_existing, 'duplicate', true);
  end if;

  -- Los envíos del mismo email van de uno en uno: el límite es exacto.
  perform pg_advisory_xact_lock(hashtext('web_contact:' || v_email));
  select c.number into v_existing from public.conversations c where c.request_id = p_request_id;
  if found then
    return jsonb_build_object('number', v_existing, 'duplicate', true);
  end if;
  if (select count(*) from public.conversations c
      join public.conversation_contacts k on k.conversation_id = c.id
      where c.channel = 'web_form' and k.email = v_email
        and c.created_at > now() - interval '1 hour') >= 3
     or (select count(*) from public.conversations c
         where c.channel = 'web_form' and c.created_at > now() - interval '10 minutes') >= 30 then
    raise exception 'rate_limited' using errcode = '54000';
  end if;

  if p_order_number is not null then
    select o.id into v_order_id
    from public.orders o
    join public.order_contacts oc on oc.order_id = o.id
    where o.number = p_order_number and lower(oc.email) = v_email;
  end if;

  v_conversation := private.open_conversation(
    'web_form', 'open', p_topic, v_subject, p_locale, v_name, v_email,
    v_order_id, p_request_id, v_body);
  return jsonb_build_object('number', v_conversation.number, 'duplicate', false);
end;
$$;

-- ---------------------------------------------------------------------------
-- Correo entrante (solo el servidor, tras comprobar la firma del proveedor)
-- ---------------------------------------------------------------------------

-- Registra un correo recibido. Va a la conversación de la clave solo si el
-- remitente es su email y el correo pasó DMARC (p_trusted); si no, abre una
-- conversación nueva, en spam si no es de fiar. Idempotente por el id del
-- proveedor. Más de 60 conversaciones nuevas por correo en una hora: 54000,
-- y el proveedor lo reintenta más tarde.
create function public.web_inbound_email_record(
  p_inbound_id text,
  p_token text,
  p_from_email text,
  p_from_name text,
  p_subject text,
  p_body text,
  p_message_id text default null,
  p_attachments integer default 0,
  p_trusted boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := private.message_email(p_from_email);
  v_name text := nullif(left(btrim(coalesce(p_from_name, '')), 120), '');
  v_subject text := coalesce(nullif(left(btrim(coalesce(p_subject, '')), 200), ''), '(sin asunto)');
  v_body text := left(btrim(coalesce(p_body, '')), 10000);
  v_message_id text := nullif(left(btrim(coalesce(p_message_id, '')), 300), '');
  v_attachments integer := least(greatest(coalesce(p_attachments, 0), 0), 100);
  v_target public.conversations;
  v_contact text;
  v_number bigint;
begin
  if not private.is_service_role() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_inbound_id is null or char_length(p_inbound_id) not between 1 and 200 then
    raise exception 'invalid_request' using errcode = '22023';
  end if;
  if v_email is null then
    raise exception 'invalid_email' using errcode = '22023';
  end if;
  if v_body = '' then
    v_body := '(sin texto)';
  end if;

  select c.number into v_number
  from public.conversation_messages m
  join public.conversations c on c.id = m.conversation_id
  where m.inbound_email_id = p_inbound_id;
  if found then
    return jsonb_build_object('action', 'duplicate', 'number', v_number);
  end if;

  if p_token ~ '^[0-9a-f]{32}$' then
    select c.* into v_target
    from private.conversation_reply_tokens t
    join public.conversations c on c.id = t.conversation_id
    where t.token = p_token
    for update of c;
    if found then
      select k.email into v_contact from public.conversation_contacts k
      where k.conversation_id = v_target.id;
    end if;
  end if;

  if v_target.id is not null and v_contact = v_email and coalesce(p_trusted, false) then
    perform private.add_customer_message(
      v_target.id, 'email', v_body, p_inbound_id, v_message_id, v_attachments);
    return jsonb_build_object('action', 'appended', 'number', v_target.number);
  end if;

  if (select count(*) from public.conversations c
      where c.channel = 'email' and c.created_at > now() - interval '1 hour') >= 60 then
    raise exception 'rate_limited' using errcode = '54000';
  end if;
  v_target := private.open_conversation(
    'email', case when coalesce(p_trusted, false) then 'open' else 'spam' end,
    'other', v_subject, coalesce(v_target.locale, 'es'), v_name, v_email,
    null, null, v_body, p_inbound_id, v_message_id, v_attachments);
  return jsonb_build_object('action', 'created', 'number', v_target.number);
end;
$$;

-- ---------------------------------------------------------------------------
-- Envío de las respuestas (solo el servidor, como web_order_emails_*)
-- ---------------------------------------------------------------------------

-- Toma hasta p_limit respuestas pendientes (o con un envío anterior que se
-- quedó a medias) y las marca en curso durante 5 minutos. Devuelve lo que
-- necesita el correo: destinatario, idioma, número, asunto, la respuesta, la
-- clave de «Responder a», el último mensaje del cliente para citarlo y el
-- Message-ID del último correo recibido para encadenar la respuesta.
create function public.web_message_emails_claim(p_limit integer default 10)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids bigint[];
begin
  if not private.is_service_role() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_limit is null or p_limit not between 1 and 50 then
    raise exception 'invalid_limit' using errcode = '22023';
  end if;
  with picked as (
    select e.message_id from public.message_emails e
    where (e.status = 'pending' or (e.status = 'sending' and e.locked_until < now()))
      and e.attempts < 5
    order by e.created_at
    limit p_limit
    for update skip locked
  ), claimed as (
    update public.message_emails e
    set status = 'sending', attempts = e.attempts + 1,
        locked_until = now() + interval '5 minutes'
    from picked where e.message_id = picked.message_id
    returning e.message_id
  )
  select array_agg(claimed.message_id) into v_ids from claimed;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', m.id,
      'number', c.number,
      'locale', c.locale,
      'subject', c.subject,
      'body', m.body,
      'full_name', k.full_name,
      'email', k.email,
      'token', t.token,
      'quoted', (
        select left(q.body, 2000) from public.conversation_messages q
        where q.conversation_id = c.id and q.kind = 'customer' and q.id < m.id
        order by q.id desc limit 1),
      'in_reply_to', (
        select q.email_message_id from public.conversation_messages q
        where q.conversation_id = c.id and q.kind = 'customer'
          and q.email_message_id is not null and q.id < m.id
        order by q.id desc limit 1)
    ) order by e.created_at)
    from public.message_emails e
    join public.conversation_messages m on m.id = e.message_id
    join public.conversations c on c.id = m.conversation_id
    join public.conversation_contacts k on k.conversation_id = c.id
    join private.conversation_reply_tokens t on t.conversation_id = c.id
    where e.message_id = any(v_ids)
  ), '[]'::jsonb);
end;
$$;

-- Resultado de un envío. Sin éxito vuelve a la cola hasta 5 intentos.
create function public.web_message_email_result(
  p_message_id bigint,
  p_ok boolean,
  p_provider_id text default null,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_service_role() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.message_emails e
  set status = case when p_ok then 'sent'
                    when e.attempts >= 5 then 'failed'
                    else 'pending' end,
      sent_at = case when p_ok then now() end,
      provider_id = case when p_ok then left(p_provider_id, 200) end,
      last_error = case when p_ok then null else left(coalesce(p_error, 'error'), 200) end,
      locked_until = null
  where e.message_id = p_message_id and e.status = 'sending';
end;
$$;

-- ---------------------------------------------------------------------------
-- Panel (permiso y MFA comprobados dentro; auditoría sin el texto ni el email)
-- ---------------------------------------------------------------------------

create function private.require_message_reply()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('messages.reply') or private.current_aal() <> 'aal2' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return (select auth.uid());
end;
$$;

-- Bloquea la conversación y comprueba la revisión que vio el panel.
create function private.lock_conversation(p_id uuid, p_revision integer)
returns public.conversations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conversation public.conversations;
begin
  select * into v_conversation from public.conversations c where c.id = p_id for update;
  if not found then
    raise exception 'unknown_conversation' using errcode = '22023';
  end if;
  if p_revision is null or v_conversation.revision <> p_revision then
    raise exception 'stale_revision' using errcode = '55000';
  end if;
  return v_conversation;
end;
$$;

-- Respuesta al cliente: se guarda, se encola su correo y la conversación pasa
-- a «esperando al cliente». La revisión evita responder dos veces con un
-- doble clic o sobre una conversación que cambió mientras se escribía.
create function public.admin_reply_conversation(
  p_conversation_id uuid,
  p_body text,
  p_revision integer
)
returns public.conversations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.require_message_reply();
  v_conversation public.conversations;
  v_body text := btrim(coalesce(p_body, ''));
  v_status text;
  v_message_id bigint;
  v_at timestamptz := clock_timestamp();
begin
  if char_length(v_body) not between 1 and 5000 then
    raise exception 'invalid_message' using errcode = '22023';
  end if;
  v_conversation := private.lock_conversation(p_conversation_id, p_revision);
  v_status := private.message_status_after(v_conversation.status, 'reply');
  if v_status is null then
    raise exception 'conversation_spam' using errcode = '55000';
  end if;
  insert into public.conversation_messages (conversation_id, kind, source, body, author_id, created_at)
  values (v_conversation.id, 'reply', 'panel', v_body, v_actor, v_at)
  returning id into v_message_id;
  insert into public.message_emails (message_id) values (v_message_id);
  update public.conversations
  set status = v_status,
      last_staff_message_at = v_at,
      last_message_at = v_at,
      revision = revision + 1
  where id = v_conversation.id
  returning * into v_conversation;
  insert into public.audit_log (actor_id, action, entity, entity_id, after)
  values (v_actor, 'messages.reply', 'conversation', v_conversation.id::text,
          jsonb_build_object('number', v_conversation.number, 'message_id', v_message_id));
  return v_conversation;
end;
$$;

-- Nota interna: no cambia el estado, el plazo ni la revisión.
create function public.admin_add_conversation_note(p_conversation_id uuid, p_body text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.require_message_reply();
  v_body text := btrim(coalesce(p_body, ''));
  v_number bigint;
  v_id bigint;
begin
  if char_length(v_body) not between 1 and 5000 then
    raise exception 'invalid_message' using errcode = '22023';
  end if;
  select c.number into v_number from public.conversations c where c.id = p_conversation_id;
  if not found then
    raise exception 'unknown_conversation' using errcode = '22023';
  end if;
  insert into public.conversation_messages (conversation_id, kind, source, body, author_id)
  values (p_conversation_id, 'note', 'panel', v_body, v_actor)
  returning id into v_id;
  insert into public.audit_log (actor_id, action, entity, entity_id, after)
  values (v_actor, 'messages.note', 'conversation', p_conversation_id::text,
          jsonb_build_object('number', v_number, 'message_id', v_id));
  return v_id;
end;
$$;

create function public.admin_set_conversation_status(
  p_conversation_id uuid,
  p_status text,
  p_revision integer
)
returns public.conversations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.require_message_reply();
  v_conversation public.conversations;
  v_from text;
begin
  v_conversation := private.lock_conversation(p_conversation_id, p_revision);
  v_from := v_conversation.status;
  if not private.message_status_transition(v_from, p_status) then
    raise exception 'invalid_transition' using errcode = '22023';
  end if;
  update public.conversations
  set status = p_status, revision = revision + 1
  where id = v_conversation.id
  returning * into v_conversation;
  insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
  values (v_actor, 'messages.status', 'conversation', v_conversation.id::text,
          jsonb_build_object('status', v_from),
          jsonb_build_object('status', p_status, 'number', v_conversation.number));
  return v_conversation;
end;
$$;

-- Asigna a una persona del personal activa que pueda leer los mensajes, o a nadie.
create function public.admin_assign_conversation(
  p_conversation_id uuid,
  p_assignee uuid,
  p_revision integer
)
returns public.conversations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.require_message_reply();
  v_conversation public.conversations;
  v_before uuid;
begin
  if p_assignee is not null and not exists (
    select 1 from public.staff_members s
    join public.role_permissions rp on rp.role = s.role
    where s.user_id = p_assignee and s.active and rp.permission = 'messages.reply'
  ) then
    raise exception 'invalid_assignee' using errcode = '22023';
  end if;
  v_conversation := private.lock_conversation(p_conversation_id, p_revision);
  v_before := v_conversation.assigned_to;
  update public.conversations
  set assigned_to = p_assignee, revision = revision + 1
  where id = v_conversation.id
  returning * into v_conversation;
  insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
  values (v_actor, 'messages.assign', 'conversation', v_conversation.id::text,
          jsonb_build_object('assigned_to', v_before),
          jsonb_build_object('assigned_to', p_assignee, 'number', v_conversation.number));
  return v_conversation;
end;
$$;

-- Enlaza un pedido por su número (null lo quita). Exige además orders.view.
create function public.admin_link_conversation_order(
  p_conversation_id uuid,
  p_order_number bigint,
  p_revision integer
)
returns public.conversations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.require_message_reply();
  v_conversation public.conversations;
  v_order_id uuid;
begin
  if not private.has_permission('orders.view') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_order_number is not null then
    select o.id into v_order_id from public.orders o where o.number = p_order_number;
    if not found then
      raise exception 'unknown_order' using errcode = '22023';
    end if;
  end if;
  v_conversation := private.lock_conversation(p_conversation_id, p_revision);
  update public.conversations
  set order_id = v_order_id, revision = revision + 1
  where id = v_conversation.id
  returning * into v_conversation;
  insert into public.audit_log (actor_id, action, entity, entity_id, after)
  values (v_actor, 'messages.link_order', 'conversation', v_conversation.id::text,
          jsonb_build_object('order_number', p_order_number, 'number', v_conversation.number));
  return v_conversation;
end;
$$;

-- Borra una conversación entera (spam o derecho de supresión). Exige
-- customers.manage con MFA; la auditoría guarda solo el número.
create function public.admin_delete_conversation(p_conversation_id uuid, p_revision integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_conversation public.conversations;
begin
  if not private.has_permission('customers.manage') or private.current_aal() <> 'aal2' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  v_conversation := private.lock_conversation(p_conversation_id, p_revision);
  delete from public.conversations where id = v_conversation.id;
  insert into public.audit_log (actor_id, action, entity, entity_id, before)
  values (v_actor, 'messages.delete', 'conversation', v_conversation.id::text,
          jsonb_build_object('number', v_conversation.number, 'channel', v_conversation.channel,
                             'status', v_conversation.status));
end;
$$;

-- Alta (p_id null) o cambio de una plantilla de respuesta.
create function public.admin_save_message_template(
  p_id uuid,
  p_title text,
  p_locale text,
  p_body text,
  p_active boolean,
  p_revision integer default null
)
returns public.message_templates
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.require_message_reply();
  v_title text := btrim(coalesce(p_title, ''));
  v_body text := btrim(coalesce(p_body, ''));
  v_template public.message_templates;
begin
  if char_length(v_title) not between 1 and 80 or char_length(v_body) not between 1 and 5000
     or p_locale is null or p_locale not in ('es', 'ca', 'en') or p_active is null then
    raise exception 'invalid_template' using errcode = '22023';
  end if;
  begin
    if p_id is null then
      insert into public.message_templates (title, locale, body, active)
      values (v_title, p_locale, v_body, p_active)
      returning * into v_template;
    else
      select * into v_template from public.message_templates t where t.id = p_id for update;
      if not found then
        raise exception 'unknown_template' using errcode = '22023';
      end if;
      if p_revision is null or v_template.revision <> p_revision then
        raise exception 'stale_revision' using errcode = '55000';
      end if;
      update public.message_templates
      set title = v_title, locale = p_locale, body = v_body, active = p_active,
          revision = revision + 1
      where id = p_id
      returning * into v_template;
    end if;
  exception when unique_violation then
    raise exception 'duplicate_template' using errcode = '23505';
  end;
  insert into public.audit_log (actor_id, action, entity, entity_id, after)
  values (v_actor, 'messages.template', 'message_template', v_template.id::text,
          jsonb_build_object('title', v_template.title, 'locale', v_template.locale,
                             'active', v_template.active));
  return v_template;
end;
$$;

-- Personal al que se puede asignar una conversación (activo y con
-- messages.reply), con su nombre visible.
create function public.admin_message_assignees()
returns table (user_id uuid, name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('messages.view') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select s.user_id,
           coalesce(nullif(btrim(s.display_name), ''), split_part(u.email::text, '@', 1))
    from public.staff_members s
    join public.role_permissions rp on rp.role = s.role and rp.permission = 'messages.reply'
    join auth.users u on u.id = s.user_id
    where s.active
    order by 2;
end;
$$;

-- ---------------------------------------------------------------------------
-- Copia diaria: las conversaciones entran en la lista blanca (tras los
-- pedidos, que enlazan). Parte de la lista de 20261017120000_security_review,
-- con product_sources (§157, §158).
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

-- ---------------------------------------------------------------------------
-- Permisos de ejecución
-- ---------------------------------------------------------------------------

-- Auxiliares de las funciones security definer: nadie las llama directamente.
revoke execute on function
  private.message_status_after(text, text),
  private.message_status_transition(text, text),
  private.message_email(text),
  private.add_customer_message(uuid, text, text, text, text, integer),
  private.open_conversation(text, text, text, text, text, text, text, uuid, uuid, text, text, text, integer),
  private.require_message_reply(),
  private.lock_conversation(uuid, integer)
  from public, anon, authenticated, service_role;

-- Solo el servidor con la clave privilegiada.
revoke execute on function
  public.web_contact_submit(uuid, text, text, text, text, text, text, bigint),
  public.web_inbound_email_record(text, text, text, text, text, text, text, integer, boolean),
  public.web_message_emails_claim(integer),
  public.web_message_email_result(bigint, boolean, text, text)
  from public, anon, authenticated;
grant execute on function
  public.web_contact_submit(uuid, text, text, text, text, text, text, bigint),
  public.web_inbound_email_record(text, text, text, text, text, text, text, integer, boolean),
  public.web_message_emails_claim(integer),
  public.web_message_email_result(bigint, boolean, text, text)
  to service_role;

-- El panel: permiso y MFA se comprueban dentro.
revoke execute on function
  public.admin_reply_conversation(uuid, text, integer),
  public.admin_add_conversation_note(uuid, text),
  public.admin_set_conversation_status(uuid, text, integer),
  public.admin_assign_conversation(uuid, uuid, integer),
  public.admin_link_conversation_order(uuid, bigint, integer),
  public.admin_delete_conversation(uuid, integer),
  public.admin_save_message_template(uuid, text, text, text, boolean, integer),
  public.admin_message_assignees()
  from public, anon;
grant execute on function
  public.admin_reply_conversation(uuid, text, integer),
  public.admin_add_conversation_note(uuid, text),
  public.admin_set_conversation_status(uuid, text, integer),
  public.admin_assign_conversation(uuid, uuid, integer),
  public.admin_link_conversation_order(uuid, bigint, integer),
  public.admin_delete_conversation(uuid, integer),
  public.admin_save_message_template(uuid, text, text, text, boolean, integer),
  public.admin_message_assignees()
  to authenticated;
