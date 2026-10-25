# Envíos multitransportista — 25/10/2026

A petición del usuario (25/10): «Para empezar, plataforma multitransportista, en lo que contestan para poder tener contrato con ellos. El cliente paga el envío según el precio por kg soportado por el transportista elegido. Que aparezca en el panel con los costes reales y la opción de solicitar la recogida en nuestra tienda o la posibilidad de dejarlo en su punto de entrega.» Rama `claude/envios-multitransportista`, sobre `claude/cierre-apertura` (PR #47). Decisiones en [DECISIONS.md](DECISIONS.md) §171–176; guía de uso en [ADMIN_OPERATIONS.md](ADMIN_OPERATIONS.md#envíos-y-transportistas).

## Qué hace

1. **El cliente elige transportista y paga según el peso.** En «Finalizar compra», con el código postal, salen los servicios activos que llevan ese peso a esa zona, con su precio y su plazo (es/ca/en). El peso es el de los formatos de la cesta más el embalaje. El precio es el coste real del transportista sin IVA para ese tramo de peso, más el IVA del envío y el recargo del servicio. El envío gratis de la zona solo vale en los servicios marcados. La base calcula peso y precio al enseñarlo (`web_shipping_quote`) y otra vez al crear el pedido (`web_order_create`): el navegador no fija ningún importe.
2. **El panel trae los costes reales.** Configuración → Envíos sincroniza los servicios de la plataforma con sus tramos de coste. En la ficha del pedido, «Ver tarifas reales» cotiza ese paquete a esa dirección con todos los servicios y enseña lo cobrado frente al coste.
3. **Etiqueta, recogida o punto de entrega.** «Crear etiqueta» la compra en la plataforma y guarda su coste; se descarga en PDF (A6 o A4). Después, **recogida en la tienda** (por la API si el transportista la admite o por teléfono, apuntada) o **punto de entrega** (lista de puntos cercanos del transportista; al dejarlo, el pedido sale).
4. **Seguimiento automático.** El aviso firmado de la plataforma pasa el pedido a «Enviado» al primer escaneo (con el correo y el enlace de seguimiento) y a «Completado» al entregarse. Las incidencias quedan en la cronología y en Web → Envíos.
5. **Contratos propios sin API.** Un servicio «manual» con sus tramos escritos en el panel funciona igual en el checkout; la etiqueta se hace en la web del transportista y se apunta el número de seguimiento. Sirve para abrir antes de tener la plataforma y para los contratos directos que lleguen.

## Plataforma: Sendcloud (API v3)

- Una integración para varios transportistas españoles (Correos, Correos Express, SEUR, GLS, DHL, UPS…), activables sin contrato propio y con los contratos directos conectados después en la misma cuenta.
- La API da lo necesario: opciones con cotización por peso y dirección (`POST /shipping-options`), crear y anunciar el envío con la etiqueta (`POST /shipments/announce`), cancelarlo, la etiqueta en PDF (`GET /parcels/{id}/documents/label`), recogidas puntuales (`POST /pickups`), puntos del transportista (`GET /service-points`) y avisos de estado firmados con HMAC-SHA256.
- **Recogidas por API** solo con algunos transportistas (en España, Correos, Correos Express, DHL Parcel Iberia, UPS y FedEx; no SEUR ni GLS, según su documentación del 25/10). Con los demás, teléfono de recogidas del servicio y recogida apuntada a mano.
- Sin SDK: `fetch` con autenticación básica y respuestas leídas con zod (`src/modules/shipping/server/sendcloud/`).

## Datos (migración `20261025120000_shipping_carriers.sql`)

| Objeto                                             | Qué guarda                                                                                                                  | Quién lo ve                                                                                          |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `product_variants.shipping_weight_g`               | Gramos de una unidad con su caja; null = no se envía                                                                        | Público (es dato de cálculo, no reservado)                                                           |
| `shipping_settings`                                | Remitente, embalaje, peso máximo, caja, franja de recogida, IVA del envío                                                   | Personal con `orders.view`; escribe `settings.manage`                                                |
| `shipping_rates`                                   | Por zona: «Ofrecer el envío» y gratis desde. `price_cents` queda sin uso (null)                                             | Público solo las activas                                                                             |
| `shipping_services`                                | Servicio de la plataforma o manual: nombre, plazo, recargo, zonas, envío gratis, teléfono de recogidas, plantilla de enlace | Personal con `orders.view`; la tienda, por `web_shipping_quote`                                      |
| `internal.shipping_service_rates`                  | Tramos de peso por zona con el **coste sin IVA**                                                                            | Nadie por la API; `admin_shipping_services` con `settings.manage` (importes con `pricing.view_cost`) |
| `orders.shipping_service_id/label/weight_g/zone`   | Lo que eligió el cliente y el peso calculado                                                                                | Como el pedido                                                                                       |
| `shipments`, `shipment_events`, `shipment_pickups` | Etiqueta, seguimiento (solo inserción, sin repetir avisos) y recogidas                                                      | Personal con `orders.view`                                                                           |
| `internal.shipment_costs`                          | Lo que costó cada etiqueta                                                                                                  | `admin_shipment_costs` con `pricing.view_cost`                                                       |

## Para encenderlo (usuario)

1. **Pesar los formatos** que se publiquen (Catálogo → Pesos de envío) y el embalaje. Sin peso no hay envío para esa cesta.
2. **Configuración → Envíos → Remitente, embalaje y recogidas:** código postal de la tienda, teléfono, email, gramos del embalaje y franja de recogida.
3. **Con contrato propio sin plataforma** (para abrir ya): «Añadir un servicio manual» (p. ej. Correos Paq Estándar), sus tramos en la península (y Baleares si se envía), enlace de seguimiento con `{tracking}`, teléfono de recogidas y «Ofrecer este servicio en la tienda».
4. **Con Sendcloud:** crear la cuenta y activar los transportistas; Settings → Integrations → «Sendcloud API» → claves; en Vercel → `atelier-web` → Environment Variables (Production, «Sensitive»): `SENDCLOUD_PUBLIC_KEY` y `SENDCLOUD_SECRET_KEY` (y `SENDCLOUD_WEBHOOK_SECRET` solo si la integración firma con una «Webhook Signature Key» propia). En la integración, «Webhook feedback enabled» con la URL `https://latelierdudesert.com/api/envios/sendcloud`. Redesplegar, «Actualizar tarifas desde Sendcloud», revisar y activar los servicios.
5. **Confirmar con cada transportista que acepta perfumes** (llevan alcohol: UN1266, clase 3, cantidades limitadas) y en qué servicios; a Baleares, por barco. Activar solo esos.
6. **Zonas:** «Ofrecer el envío» en península (y Baleares) y el envío gratis si se quiere.
7. **Comprobar la primera factura de la plataforma:** el precio al cliente suma el 21 % al coste que da la API; si la plataforma ya lo diera con IVA, poner 0 % en «IVA del envío».
8. **Migración y despliegue, juntos:** aplicar la migración en `atelier-dev` (con autorización, como §164 y §168) y fusionar la PR enseguida. El código de esta rama necesita la migración. Con el código anterior y la migración ya aplicada, la recogida en la tienda sigue funcionando, pero un pedido con envío falla (falta el servicio elegido) y el formulario antiguo de tarifas planas no guarda: mejor sin la venta con envío encendida entre los dos pasos.

## Límites y siguiente paso

- **Probado con la API simulada**, no con una cuenta real de Sendcloud (no hay cuenta ni claves). Los campos salen de sus especificaciones OpenAPI v3 del 25/10; la primera sincronización y la primera etiqueta reales hay que mirarlas con calma.
- **Tramos por referencia:** Baleares se cotiza con Palma, Maó y Eivissa y la península con Madrid, Sevilla y A Coruña, con el coste más alto. Si un transportista cobra distinto en otra parte, la cotización en vivo de la ficha lo enseña antes de comprar la etiqueta.
- **Volumen:** las tarifas se sincronizan por peso; con cajas grandes y ligeras puede cobrar el peso volumétrico (la ficha cotiza con las medidas de la caja si se guardan).
- **Fuera:** entrega del cliente en un punto o taquilla (el checkout es a domicilio), devoluciones con etiqueta, varios bultos por pedido, recogidas periódicas, el coste de envío en los informes de margen y Canarias.
