-- Visitas e interés de los productos (consola del titular,
-- /admin/control/atencion). Medición anónima y agregada: solo un contador por
-- perfume, día de Europe/Madrid y tipo de evento. Sin cookies ni
-- almacenamiento en el navegador, y sin guardar IP, agente de usuario ni
-- ningún identificador de quien visita.
--
-- La tienda suma con track_product_event() desde POST /api/eventos (que ya
-- descarta bots y peticiones de otro origen). La función también es
-- ejecutable directamente por la API pública con la clave publicable: por eso
-- solo cuenta perfumes publicados, no revela nada (true o false) y tiene un
-- freno global por minuto. El titular lee los contadores con
-- admin_control_attention().
--
-- Tipos: view (ficha de perfume), scent_view (ficha del catálogo olfativo),
-- unboxing (la escena 3D se ve de verdad) y add_to_cart, que se acepta para
-- cuando exista el carrito pero hoy no se emite desde ningún sitio.

create table internal.product_attention_daily (
  product_id uuid not null references public.products (id) on delete cascade,
  day date not null,
  kind text not null check (kind in ('view', 'scent_view', 'unboxing', 'add_to_cart')),
  hits integer not null default 0 check (hits >= 0),
  primary key (product_id, day, kind)
);

-- La consola lee por periodo en todo el catálogo.
create index product_attention_daily_day_idx on internal.product_attention_daily (day);

-- Freno global: eventos contados por minuto. Solo guarda la hora y el
-- recuento; las filas de más de una hora se borran desde la propia función.
create table internal.attention_rate (
  minute timestamptz primary key,
  hits integer not null check (hits >= 0)
);

-- Suma 1 al contador del día (Madrid) de un perfume publicado. Devuelve true
-- si contó; false si el tipo o el slug no son válidos, si el perfume no existe
-- o no está publicado (sin distinguir un caso de otro) o si se ha superado el
-- freno de 1200 eventos por minuto. Nunca lanza errores por la entrada.
create function public.track_product_event(p_slug text, p_kind text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product uuid;
  v_minute timestamptz := date_trunc('minute', now());
  v_hits integer;
begin
  if p_kind is null
     or p_kind not in ('view', 'scent_view', 'unboxing', 'add_to_cart')
     or p_slug is null
     or p_slug !~ '^[a-z0-9-]{1,160}$' then
    return false;
  end if;

  select p.id into v_product
  from public.products p
  where p.slug = p_slug and p.status = 'published';
  if v_product is null then
    return false;
  end if;

  -- Freno: pasado el límite no se escribe nada más en este minuto. La
  -- comprobación previa evita escrituras; la del recuento devuelto cubre las
  -- peticiones simultáneas.
  if coalesce(
       (select r.hits from internal.attention_rate r where r.minute = v_minute), 0
     ) >= 1200 then
    return false;
  end if;
  insert into internal.attention_rate as r (minute, hits)
  values (v_minute, 1)
  on conflict (minute) do update set hits = r.hits + 1
  returning r.hits into v_hits;
  if v_hits > 1200 then
    return false;
  end if;
  -- Primer evento del minuto: limpieza de los minutos de hace más de una hora.
  if v_hits = 1 then
    delete from internal.attention_rate r where r.minute < v_minute - interval '1 hour';
  end if;

  insert into internal.product_attention_daily as a (product_id, day, kind, hits)
  values (v_product, (now() at time zone 'Europe/Madrid')::date, p_kind, 1)
  on conflict (product_id, day, kind) do update set hits = a.hits + 1;
  return true;
end;
$$;

revoke all on function public.track_product_event(text, text) from public;
grant execute on function public.track_product_event(text, text) to anon, authenticated;

-- Contadores de [p_from, p_to) en días de Madrid, como mucho 400 días. Solo
-- el titular con MFA.
create function public.admin_control_attention(p_from date, p_to date)
returns table (product_id uuid, day date, kind text, hits integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_business_control();
  if p_from is null or p_to is null or p_from >= p_to or p_to - p_from > 400 then
    raise exception 'invalid_period' using errcode = '22023';
  end if;
  return query
    select a.product_id, a.day, a.kind, a.hits
    from internal.product_attention_daily a
    where a.day >= p_from and a.day < p_to
    order by a.day, a.product_id, a.kind;
end;
$$;

revoke execute on function public.admin_control_attention(date, date) from public, anon;
grant execute on function public.admin_control_attention(date, date) to authenticated;
