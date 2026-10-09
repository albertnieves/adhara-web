-- Suscriptores a las promociones (sección antes del pie de la tienda). Datos
-- personales: el público solo da de alta mediante newsletter_subscribe(), sin
-- poder leer ni saber si el email ya estaba; el personal los consulta con
-- customers.view y los da de baja o borra con customers.manage (MFA). El envío
-- de correos se hace desde Sender (sender.net); sender_synced_at marca los que
-- el panel ya ha enviado a su lista.

create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (
    char_length(email) <= 254
    and email = lower(email)
    and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ),
  locale text not null check (locale in ('es', 'ca', 'en')),
  source text not null default 'web' check (source ~ '^[a-z0-9_-]{1,40}$'),
  consent_version text not null check (char_length(consent_version) between 1 and 40),
  consented_at timestamptz not null default now(),
  unsubscribed_at timestamptz,
  sender_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index newsletter_subscribers_consented_idx on public.newsletter_subscribers (consented_at desc);

create trigger newsletter_subscribers_updated_at
  before update on public.newsletter_subscribers
  for each row execute function private.set_updated_at();

alter table public.newsletter_subscribers enable row level security;

revoke all on public.newsletter_subscribers from anon;
revoke insert, truncate on public.newsletter_subscribers from authenticated;

create policy "customers.view lee suscriptores" on public.newsletter_subscribers
  for select to authenticated
  using ((select private.has_permission('customers.view')));
create policy "customers.manage cambia suscriptores" on public.newsletter_subscribers
  for update to authenticated
  using ((select private.has_permission('customers.manage')))
  with check ((select private.has_permission('customers.manage')));
create policy "customers.manage borra suscriptores" on public.newsletter_subscribers
  for delete to authenticated
  using ((select private.has_permission('customers.manage')));

-- Alta pública: normaliza el email, no revela si ya existía y reactiva a quien
-- se dio de baja con un consentimiento nuevo. Un freno global evita altas en
-- masa desde la API pública.
create function public.newsletter_subscribe(
  p_email text,
  p_locale text,
  p_consent_version text,
  p_source text default 'web'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if char_length(v_email) > 254
     or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'invalid_email' using errcode = '22023';
  end if;
  if p_locale is null or p_locale not in ('es', 'ca', 'en') then
    raise exception 'invalid_locale' using errcode = '22023';
  end if;
  if (select count(*) from public.newsletter_subscribers
      where consented_at > now() - interval '1 minute') >= 60 then
    raise exception 'rate_limited' using errcode = '54000';
  end if;
  insert into public.newsletter_subscribers (email, locale, consent_version, source)
  values (v_email, p_locale, p_consent_version, coalesce(p_source, 'web'))
  on conflict (email) do update
    set locale = excluded.locale,
        consent_version = excluded.consent_version,
        consented_at = now(),
        unsubscribed_at = null,
        sender_synced_at = case
          when public.newsletter_subscribers.unsubscribed_at is null
            then public.newsletter_subscribers.sender_synced_at
        end;
end;
$$;

revoke all on function public.newsletter_subscribe(text, text, text, text) from public;
grant execute on function public.newsletter_subscribe(text, text, text, text) to anon, authenticated;
