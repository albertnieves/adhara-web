-- Esquemas no expuestos por la API: internal (costes, proveedores) y
-- private (funciones auxiliares de autorización y triggers).
create extension if not exists pgcrypto with schema extensions;

create schema if not exists internal;
create schema if not exists private;

revoke all on schema internal from public, anon, authenticated;
revoke all on schema private from public, anon, authenticated;

-- Las funciones nuevas no son ejecutables por defecto: se concede una a una.
alter default privileges in schema private revoke execute on functions from public;
alter default privileges in schema internal revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon;

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Tablas de solo inserción: ni el service role puede modificar ni borrar.
create function private.reject_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% es de solo inserción', tg_table_name
    using errcode = 'insufficient_privilege';
end;
$$;
