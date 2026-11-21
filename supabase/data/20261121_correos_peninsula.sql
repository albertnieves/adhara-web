-- Carga de datos (no migración): enciende Correos Paq Estándar en la península
-- (DECISIONS §196). A petición del titular (21/11): «activemos el transportista de
-- correos en nuestra web». Lo mismo que harían en el panel «Encender» en
-- Envíos → Transportistas y tarifas y «Ofrecer el envío» en Envíos → Remitente y
-- zonas, con su rastro en audit_log (sin actor, como las demás cargas de datos).
--
-- - Servicio `correos:standard` de Sendcloud (sincronizado el 02/11): el cliente lo
--   ve como «Correos · Paq Estándar», solo en la península. Conserva sus tramos,
--   su plazo (2 días) y el recargo de 2 € que ya tenía. Una nueva sincronización
--   no cambia el nombre, las zonas ni el encendido.
-- - Zona península: «Ofrecer el envío», con el envío gratis desde 60 € que ya
--   estaba guardado. Baleares sigue apagada hasta que Correos confirme por escrito
--   que lleva perfumes allí.
--
-- No pone pesos: sin el peso de los formatos el checkout sigue ofreciendo solo la
-- recogida en la tienda. Los pesa la tienda (Envíos → Pesos de los formatos).
-- Idempotente: si ya está así, no cambia nada ni deja rastro.

do $$
declare
  v_before public.shipping_services;
  v_after public.shipping_services;
  v_zone_before public.shipping_rates;
  v_zone_after public.shipping_rates;
begin
  select * into v_before
  from public.shipping_services
  where provider = 'sendcloud' and code = 'correos:standard'
  for update;
  if not found then
    raise exception 'No está el servicio correos:standard: sincroniza Sendcloud antes.';
  end if;
  if not exists (
    select 1 from internal.shipping_service_rates r
    where r.service_id = v_before.id and r.zone = 'peninsula'
  ) then
    raise exception 'correos:standard no tiene tramos en la península.';
  end if;

  if v_before.name is distinct from 'Paq Estándar'
     or v_before.zones is distinct from array['peninsula']::text[]
     or not v_before.active then
    update public.shipping_services
    set name = 'Paq Estándar',
        zones = array['peninsula']::text[],
        active = true,
        updated_by = null
    where id = v_before.id
    returning * into v_after;

    insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
    values (null, 'settings.shipping_service', 'shipping_service', v_after.id::text,
            jsonb_build_object('name', v_before.name, 'active', v_before.active,
                               'zones', to_jsonb(v_before.zones),
                               'surcharge_cents', v_before.surcharge_cents),
            jsonb_build_object('name', v_after.name, 'active', v_after.active,
                               'zones', to_jsonb(v_after.zones),
                               'surcharge_cents', v_after.surcharge_cents));
  end if;

  select * into v_zone_before
  from public.shipping_rates
  where zone = 'peninsula'
  for update;
  if not found then
    raise exception 'No está la zona península en shipping_rates.';
  end if;

  if not v_zone_before.active then
    update public.shipping_rates
    set active = true,
        price_cents = null,
        updated_by = null,
        updated_at = now()
    where zone = 'peninsula'
    returning * into v_zone_after;

    insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
    values (null, 'settings.shipping_zone', 'shipping_rate', 'peninsula',
            jsonb_build_object('free_from_cents', v_zone_before.free_from_cents,
                               'active', v_zone_before.active),
            jsonb_build_object('free_from_cents', v_zone_after.free_from_cents,
                               'active', v_zone_after.active));
  end if;
end;
$$;
