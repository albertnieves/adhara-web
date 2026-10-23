-- Liberar a mano la reserva de un pedido sin pagar (23/10/2026; DECISIONS
-- §164). Hasta ahora solo la caducidad (web_order_release_expired, cada 5
-- minutos) devolvía al stock las unidades de un pedido sin pagar. Desde la
-- ficha, quien tiene orders.fulfill con MFA puede hacerlo antes, por ejemplo
-- si el cliente avisa de que no lo quiere o la tienda necesita la unidad.
--
-- El efecto es el mismo que el de la caducidad: el pedido sigue en
-- pending_payment con la reserva released («Sin pagar» en el panel) y el
-- cliente ya no puede volver a pagarlo. No pasa a «Cancelado» a propósito: un
-- cobro que llegue después (el cliente estaba en la página del banco) entra
-- como incidencia (reservation_unavailable) por el camino ya probado de
-- web_order_record_payment, y desde ahí se da por pagado (vuelve a reservar si
-- hay stock) o se cancela y se devuelve. En un pedido cancelado, ese cobro no
-- se podría devolver desde el panel.

create function public.admin_release_order_reservation(
  p_order_id uuid,
  p_revision integer
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_actor uuid := (select auth.uid());
begin
  if not private.has_permission('orders.fulfill') or private.current_aal() <> 'aal2' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_order from public.orders o where o.id = p_order_id for update;
  if not found then
    raise exception 'unknown_order' using errcode = '22023';
  end if;
  if p_revision is null or v_order.revision <> p_revision then
    raise exception 'stale_revision' using errcode = '55000';
  end if;
  -- Pagado, en incidencia o ya liberado (por la caducidad o por otra persona).
  if v_order.status <> 'pending_payment' or v_order.reservation <> 'active' then
    raise exception 'not_releasable' using errcode = '55000';
  end if;

  perform private.apply_order_inventory(v_order, 'RESERVATION_RELEASE', v_actor);
  update public.orders
  set reservation = 'released', revision = revision + 1
  where id = v_order.id
  returning * into v_order;

  insert into public.order_events (order_id, kind, actor_id, detail)
  values (v_order.id, 'reservation_released', v_actor,
          jsonb_build_object('reason', 'staff'));
  insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
  values (v_actor, 'orders.release_reservation', 'order', v_order.id::text,
          jsonb_build_object('reservation', 'active'),
          jsonb_build_object('reservation', 'released', 'number', v_order.number));
  return v_order;
end;
$$;

revoke execute on function public.admin_release_order_reservation(uuid, integer)
  from public, anon;
grant execute on function public.admin_release_order_reservation(uuid, integer)
  to authenticated;
