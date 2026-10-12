-- Pago con tarjeta por el TPV del banco (docs/PLAN_PEDIDOS_WEB.md, entrega P04;
-- DECISIONS §137). La ida al banco usa web_order_create y web_order_new_attempt
-- y el cobro se registra con web_order_record_payment, ya en P02. Aquí solo
-- falta lo que lee la página de vuelta del banco: el estado del pedido, sin
-- datos personales. La identifica una cookie httpOnly con el identificador del
-- pedido (uuid aleatorio) que solo tiene el navegador que lo hizo: nunca hay
-- búsqueda por número ni por email.

-- {order_id, number, status, fulfillment, locale, items_cents, shipping_cents,
--  total_cents, currency, reservation, reserved_until, paid_at, payable} o
-- null si no existe. payable: se puede volver a intentar el pago ahora.
create function public.web_order_status(p_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  if not private.is_service_role() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_order from public.orders o where o.id = p_order_id;
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'order_id', v_order.id,
    'number', v_order.number,
    'status', v_order.status,
    'fulfillment', v_order.fulfillment,
    'locale', v_order.locale,
    'items_cents', v_order.items_cents,
    'shipping_cents', v_order.shipping_cents,
    'total_cents', v_order.total_cents,
    'currency', v_order.currency,
    'reservation', v_order.reservation,
    'reserved_until', v_order.reserved_until,
    'paid_at', v_order.paid_at,
    'payable', v_order.status = 'pending_payment'
      and v_order.reservation = 'active'
      and v_order.reserved_until > now()
  );
end;
$$;

revoke execute on function public.web_order_status(uuid)
  from public, anon, authenticated;
grant execute on function public.web_order_status(uuid) to service_role;
