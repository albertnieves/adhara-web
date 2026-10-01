#!/usr/bin/env bash
# Concurrencia del mostrador y de las recepciones contra un Postgres REAL con
# sesiones paralelas (pgTAP corre en una sola transacción y no puede probarlo).
#
#   DB_URL="<DB_URL que muestra supabase status>" \
#     supabase/tests/concurrency/counter_and_receipts.sh
#
# Solo contra una base local: deja datos de prueba en tablas de solo inserción
# (movimientos, auditoría, ventas), que no se pueden borrar. Se limpia con
# `supabase db reset`.
set -euo pipefail

DB_URL=${DB_URL:?Indica DB_URL: la URL de la base local que muestra supabase status}
case "$DB_URL" in
  *@127.0.0.1:* | *@localhost:*) ;;
  *) echo "Solo contra una base local (127.0.0.1 o localhost)." >&2; exit 2 ;;
esac
N=${N:-12}
RUN=$(date +%s%N | tail -c 9)
STAFF=00000000-0000-4000-8000-0000000000${RUN: -2}
q() { psql "$DB_URL" -v ON_ERROR_STOP=1 -qtAX "$@"; }

# Sesión de personal con MFA (misma forma que las pruebas pgTAP).
as_staff() {
  printf "set role authenticated; set request.jwt.claims to '{\"sub\":\"%s\",\"aal\":\"aal2\",\"role\":\"authenticated\"}';\n%s\n" "$STAFF" "$1"
}

LOCATION=$(q -c "select id from public.stock_locations where code = 'castelldefels'")
VARIANT=$(q <<SQL
insert into auth.users (id, email) values ('$STAFF', 'concurrencia-$RUN@test.invalid')
  on conflict do nothing;
insert into public.staff_members (user_id, role) values ('$STAFF', 'store_admin')
  on conflict (user_id) do update set role = 'store_admin', active = true;
with b as (
  insert into public.brands (slug, name) values ('concurrencia-$RUN', 'Concurrencia $RUN')
  returning id
), p as (
  insert into public.products (brand_id, slug, name)
  select id, 'concurrencia-$RUN', 'Última unidad $RUN' from b returning id
)
insert into public.product_variants (product_id, size_ml) select id, 100 from p returning id;
SQL
)
VARIANT=$(echo "$VARIANT" | tail -1)

fail=0
check() { if [ "$1" = "$2" ]; then echo "ok - $3"; else echo "not ok - $3 (esperado $2, obtenido $1)"; fail=1; fi; }

# 1. Una unidad y N ventas simultáneas: exactamente una tiene éxito.
q -c "$(as_staff "select public.admin_record_inventory_movement('$VARIANT', '$LOCATION', 'PURCHASE_RECEIPT', 1);")" >/dev/null
tmp=$(mktemp -d)
for i in $(seq 1 "$N"); do
  (psql "$DB_URL" -qtAX -c "$(as_staff "select id from public.admin_record_store_sale('$LOCATION', 'sale', '[{\"variant_id\": \"$VARIANT\", \"quantity\": 1}]'::jsonb, gen_random_uuid());")" \
    >"$tmp/$i.out" 2>"$tmp/$i.err" && echo ok >"$tmp/$i.status" || echo ko >"$tmp/$i.status") &
done
wait
ok_count=$(grep -l '^ok$' "$tmp"/*.status | wc -l)
stock_errors=$(grep -l 'insufficient_stock' "$tmp"/*.err | wc -l)
check "$ok_count" 1 "$N ventas simultáneas de la última unidad: una sola con éxito"
check "$stock_errors" $((N - 1)) "las demás fallan por falta de stock"
check "$(q -c "select on_hand from public.inventory_levels where variant_id = '$VARIANT' and location_id = '$LOCATION'")" 0 "el stock queda en 0, nunca negativo"

# 2. La misma venta enviada N veces a la vez (doble toque): una sola venta.
q -c "$(as_staff "select public.admin_record_inventory_movement('$VARIANT', '$LOCATION', 'PURCHASE_RECEIPT', 5);")" >/dev/null
REQUEST=$(q -c "select gen_random_uuid()")
for i in $(seq 1 "$N"); do
  (psql "$DB_URL" -qtAX -c "$(as_staff "select id from public.admin_record_store_sale('$LOCATION', 'sale', '[{\"variant_id\": \"$VARIANT\", \"quantity\": 1}]'::jsonb, '$REQUEST');")" \
    >"$tmp/r$i.out" 2>"$tmp/r$i.err" || true) &
done
wait
check "$(cat "$tmp"/r*.out | sort -u | grep -c .)" 1 "$N envíos de la misma venta devuelven la misma venta"
check "$(q -c "select on_hand from public.inventory_levels where variant_id = '$VARIANT' and location_id = '$LOCATION'")" 4 "y descuentan una sola unidad"

# 3. Recepciones simultáneas de un pedido de 3 uds (1 ud cada una, claves
#    distintas): nunca se recibe más de lo pedido.
SUPPLIER=$(q -c "$(as_staff "select public.admin_save_supplier(null, 'Proveedor concurrencia $RUN');")" | tail -1)
ORDER=$(q -c "$(as_staff "select public.admin_create_purchase_order('$SUPPLIER', '$LOCATION', '[{\"variant_id\": \"$VARIANT\", \"quantity\": 3}]'::jsonb);")" | tail -1)
q -c "$(as_staff "select public.admin_transition_purchase_order('$ORDER', 0, 'order');")" >/dev/null
LINE=$(q -c "select id from internal.purchase_order_lines where order_id = '$ORDER'")
for i in $(seq 1 "$N"); do
  (psql "$DB_URL" -qtAX -c "$(as_staff "select public.admin_receive_purchase_order('$ORDER', gen_random_uuid(), '[{\"line_id\": $LINE, \"quantity\": 1}]'::jsonb);")" \
    >"$tmp/p$i.out" 2>"$tmp/p$i.err" || true) &
done
wait
check "$(cat "$tmp"/p*.out | grep -c .)" 3 "$N recepciones simultáneas: solo 3 caben en el pedido"
check "$(grep -l -E 'over_receipt|invalid_status' "$tmp"/p*.err | wc -l)" $((N - 3)) "las demás fallan: recibirían de más o el pedido ya está recibido"
check "$(q -c "select quantity_received from internal.purchase_order_lines where id = $LINE")" 3 "la línea queda con 3 recibidas"
check "$(q -c "select status from internal.purchase_orders where id = '$ORDER'")" received "y el pedido, recibido"
check "$(q -c "select on_hand from public.inventory_levels where variant_id = '$VARIANT' and location_id = '$LOCATION'")" 7 "el stock suma exactamente 3"

# 4. El nivel cuadra con la suma de movimientos.
check "$(q -c "select on_hand - (select sum(delta_on_hand) from public.inventory_movements where variant_id = '$VARIANT' and location_id = '$LOCATION') from public.inventory_levels where variant_id = '$VARIANT' and location_id = '$LOCATION'")" 0 "on_hand coincide con la suma de movimientos"

rm -rf "$tmp"
exit $fail
