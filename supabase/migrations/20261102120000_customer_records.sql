-- Ficha de cliente del panel (A7, DECISIONS §184).
--
-- Todo lo que la tienda sabe de un email: pedidos, mensajes, el Club
-- L’Atelier y la cuenta de cliente. Sin tablas nuevas: lee las que ya
-- existen. Solo para el personal con customers.view (con MFA, §159); la
-- exportación para el derecho de acceso exige customers.manage y queda en la
-- auditoría sin el email.
--
-- El cliente es su email en minúsculas. El panel lo nombra por una clave
-- opaca (sha256 del email) para no poner el email en las URL ni en los
-- registros de la plataforma.

-- ---------------------------------------------------------------------------
-- Clave y emails conocidos
-- ---------------------------------------------------------------------------

create function private.customer_key(p_email text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(sha256(convert_to(lower(btrim(p_email)), 'UTF8')), 'hex');
$$;

-- Emails de los que hay algo, con su origen. Las conversaciones marcadas como
-- spam no hacen a nadie cliente (en la ficha de un cliente sí se ven).
create function private.customer_emails(p_include_spam boolean)
returns table (email text)
language sql
stable
security definer
set search_path = ''
as $$
  select lower(btrim(c.email)) from public.order_contacts c
  union
  select cc.email
  from public.conversation_contacts cc
  join public.conversations cv on cv.id = cc.conversation_id
  where p_include_spam or cv.status <> 'spam'
  union
  select n.email from public.newsletter_subscribers n
  union
  select lower(u.email::text)
  from public.customer_accounts a
  join auth.users u on u.id = a.user_id
  where u.email is not null;
$$;

revoke all on function private.customer_key(text) from public, anon, authenticated;
revoke all on function private.customer_emails(boolean) from public, anon, authenticated;

-- El email de una clave, o null.
create function private.customer_email_for_key(p_key text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_email text;
begin
  if p_key is null or p_key !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_customer' using errcode = '22023';
  end if;
  select e.email into v_email
  from private.customer_emails(true) e
  where private.customer_key(e.email) = p_key
  limit 1;
  return v_email;
end;
$$;

revoke all on function private.customer_email_for_key(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Lista de clientes
-- ---------------------------------------------------------------------------

-- Una fila por email, la actividad más reciente primero. `p_search` busca en
-- el email y el nombre. paid_cents suma los pedidos cobrados; refunded_cents,
-- las devoluciones que el banco aceptó.
create function public.admin_customers(
  p_search text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  customer_key text,
  email text,
  full_name text,
  orders integer,
  paid_orders integer,
  paid_cents bigint,
  refunded_cents bigint,
  conversations integer,
  open_conversations integer,
  newsletter text,
  has_account boolean,
  first_seen_at timestamptz,
  last_activity_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_search text := lower(nullif(btrim(coalesce(p_search, '')), ''));
begin
  if not private.has_permission('customers.view') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_limit is null or p_limit not between 1 and 200
     or p_offset is null or p_offset < 0
     or char_length(coalesce(v_search, '')) > 120 then
    raise exception 'invalid_page' using errcode = '22023';
  end if;
  return query
  with order_rows as (
    select lower(btrim(c.email)) as email, c.full_name as name, o.id,
           o.total_cents, o.paid_at, o.created_at
    from public.order_contacts c
    join public.orders o on o.id = c.order_id
  ),
  refunds as (
    select r.order_id, sum(r.amount_cents)::bigint as cents
    from public.order_refunds r
    where r.status = 'succeeded'
    group by r.order_id
  ),
  by_orders as (
    select o.email,
           count(*)::integer as orders,
           (count(*) filter (where o.paid_at is not null))::integer as paid_orders,
           coalesce(sum(o.total_cents) filter (where o.paid_at is not null), 0)::bigint
             as paid_cents,
           coalesce(sum(r.cents), 0)::bigint as refunded_cents,
           min(o.created_at) as first_at,
           max(greatest(o.created_at, o.paid_at)) as last_at,
           (array_agg(o.name order by o.created_at desc))[1] as name
    from order_rows o
    left join refunds r on r.order_id = o.id
    group by o.email
  ),
  by_conversations as (
    select cc.email,
           count(*)::integer as conversations,
           (count(*) filter (where cv.status in ('open', 'waiting_customer')))::integer
             as open_conversations,
           min(cv.created_at) as first_at,
           max(cv.last_message_at) as last_at,
           (array_agg(cc.full_name order by cv.created_at desc)
              filter (where cc.full_name is not null))[1] as name
    from public.conversation_contacts cc
    join public.conversations cv on cv.id = cc.conversation_id
    where cv.status <> 'spam'
    group by cc.email
  ),
  accounts as (
    select lower(u.email::text) as email, a.full_name as name, a.created_at
    from public.customer_accounts a
    join auth.users u on u.id = a.user_id
    where u.email is not null
  ),
  everyone as (
    select
      e.email,
      coalesce(ac.name, bo.name, bc.name) as name,
      coalesce(bo.orders, 0) as orders,
      coalesce(bo.paid_orders, 0) as paid_orders,
      coalesce(bo.paid_cents, 0::bigint) as paid_cents,
      coalesce(bo.refunded_cents, 0::bigint) as refunded_cents,
      coalesce(bc.conversations, 0) as conversations,
      coalesce(bc.open_conversations, 0) as open_conversations,
      case
        when n.id is null then null
        when n.unsubscribed_at is null then 'subscribed'
        else 'unsubscribed'
      end as newsletter,
      ac.email is not null as has_account,
      least(bo.first_at, bc.first_at, n.consented_at, ac.created_at) as first_at,
      greatest(bo.last_at, bc.last_at, n.consented_at, n.unsubscribed_at, ac.created_at)
        as last_at
    from private.customer_emails(false) e
    left join by_orders bo on bo.email = e.email
    left join by_conversations bc on bc.email = e.email
    left join public.newsletter_subscribers n on n.email = e.email
    left join accounts ac on ac.email = e.email
  )
  select private.customer_key(x.email), x.email, x.name, x.orders, x.paid_orders,
         x.paid_cents, x.refunded_cents, x.conversations, x.open_conversations,
         x.newsletter, x.has_account, x.first_at, x.last_at,
         count(*) over ()
  from everyone x
  where v_search is null
     or strpos(x.email, v_search) > 0
     or strpos(lower(coalesce(x.name, '')), v_search) > 0
  order by x.last_at desc nulls last, x.email
  limit p_limit offset p_offset;
end;
$$;

revoke all on function public.admin_customers(text, integer, integer) from public, anon;
grant execute on function public.admin_customers(text, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Ficha
-- ---------------------------------------------------------------------------

-- Lo que el panel enseña de un cliente; null si la clave no es de nadie.
-- Los mensajes se cuentan, no se copian: se leen en la bandeja.
create function public.admin_customer(p_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_email text;
begin
  if not private.has_permission('customers.view') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  v_email := private.customer_email_for_key(p_key);
  if v_email is null then
    return null;
  end if;
  return jsonb_build_object(
    'key', p_key,
    'email', v_email,
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
        'last_sign_in_at', u.last_sign_in_at
      )
      from public.customer_accounts a
      join auth.users u on u.id = a.user_id
      where lower(u.email::text) = v_email
      limit 1
    ),
    'newsletter', (
      select jsonb_build_object(
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
        'id', o.id,
        'number', o.number,
        'status', o.status,
        'reservation', o.reservation,
        'fulfillment', o.fulfillment,
        'total_cents', o.total_cents,
        'refunded_cents', coalesce((
          select sum(r.amount_cents) from public.order_refunds r
          where r.order_id = o.id and r.status = 'succeeded'
        ), 0),
        'created_at', o.created_at,
        'paid_at', o.paid_at,
        'with_account', o.customer_id is not null,
        'full_name', c.full_name,
        'phone', c.phone,
        'address_line1', c.address_line1,
        'address_line2', c.address_line2,
        'postal_code', c.postal_code,
        'city', c.city,
        'province', c.province,
        'country', c.country
      ) order by o.created_at desc)
      from public.order_contacts c
      join public.orders o on o.id = c.order_id
      where lower(btrim(c.email)) = v_email
    ), '[]'::jsonb),
    'conversations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', cv.id,
        'number', cv.number,
        'status', cv.status,
        'channel', cv.channel,
        'subject', cv.subject,
        'created_at', cv.created_at,
        'last_message_at', cv.last_message_at,
        'full_name', cc.full_name,
        'order_number', o.number
      ) order by cv.last_message_at desc)
      from public.conversation_contacts cc
      join public.conversations cv on cv.id = cc.conversation_id
      left join public.orders o on o.id = cv.order_id
      where cc.email = v_email
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.admin_customer(text) from public, anon;
grant execute on function public.admin_customer(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Exportación (derecho de acceso)
-- ---------------------------------------------------------------------------

-- Todos los datos de un cliente, para entregárselos si los pide. Campos
-- elegidos uno a uno: nada interno (ids, costes, reservas, notas del banco).
-- Las notas internas de la bandeja se incluyen marcadas (`note`): quien la
-- prepara revisa el archivo antes de enviarlo. Deja constancia en la
-- auditoría con la clave, sin el email.
create function public.admin_customer_export(p_key text)
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

revoke all on function public.admin_customer_export(text) from public, anon;
grant execute on function public.admin_customer_export(text) to authenticated;
