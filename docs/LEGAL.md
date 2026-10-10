# Textos legales — guía de revisión

Borrador del 09/10/2026 de los cinco textos legales de la tienda, en español, catalán e inglés y visibles en la web para revisarlos con el cliente. **No son asesoramiento jurídico:** antes de abrir la web al público (y siempre antes de activar la compra online) debe revisarlos la asesoría. Decisión en [DECISIONS.md](DECISIONS.md) §113.

## Dónde se ven

Enlazados en la barra inferior del pie de todas las páginas, en pequeño junto al ©, como en cualquier tienda, y la política de privacidad también desde el aviso de la suscripción.

**Aviso de entrada** (§115): la primera vez, un pop-up pide aceptar el aviso legal, la privacidad y las cookies antes de navegar. Se recuerda un año con la cookie técnica `atelier_aviso`; si cambia `LEGAL_UPDATED_AT`, se vuelve a pedir. No sale en las páginas legales.

| Texto                  | es                          | ca                             | en                         |
| ---------------------- | --------------------------- | ------------------------------ | -------------------------- |
| Aviso legal            | `/es/aviso-legal`           | `/ca/avis-legal`               | `/en/legal-notice`         |
| Condiciones de venta   | `/es/condiciones-de-venta`  | `/ca/condicions-de-venda`      | `/en/terms-of-sale`        |
| Política de privacidad | `/es/privacidad`            | `/ca/privacitat`               | `/en/privacy-policy`       |
| Política de cookies    | `/es/cookies`               | `/ca/galetes`                  | `/en/cookie-policy`        |
| Envíos y devoluciones  | `/es/envios-y-devoluciones` | `/ca/enviaments-i-devolucions` | `/en/shipping-and-returns` |

**Discretos, como en una perfumería que ya funciona** (§114): sin avisos de «borrador» ni de «compra online no disponible», sin nombres de proveedores (se citan por categorías, como permite el RGPD) y sin detalles internos (panel, cookies del equipo, Vercel, medidas concretas). Una prueba unitaria lo vigila.

## Cómo se modifican

- **Texto:** `src/modules/legal/content/es.ts` (referencia), `ca.ts` y `en.ts`, con las mismas secciones. Una prueba (`tests/unit/legal.test.ts`) falla si los idiomas no tienen las mismas secciones, marcadores y enlaces.
- **Datos que faltan:** `src/modules/legal/domain/entity.ts` (`LEGAL_ENTITY`). Mientras un dato vale `null`, **el párrafo o la línea que lo usa no se publica** (la página se lee completa, sin huecos). Para revisarlos con el cliente, entra en la tienda desde el panel con «Ver tienda con borradores»: en esa vista previa se ven como recuadros «Pendiente: …». Al rellenar el dato, la línea aparece en los tres idiomas.
- **Correo, teléfono y dirección de la tienda:** Panel → Configuración (los mismos que el pie). Hoy el correo y el teléfono están vacíos, así que esas líneas no se publican.
- **Fecha de la versión:** `LEGAL_UPDATED_AT` en el mismo archivo; se cambia con cada revisión de fondo.
- Marcadores: `{campo}` inserta un dato; `[texto](doc:privacy#derechos)` enlaza otro texto legal; `[texto](https://…)` enlaza fuera.

## Datos del titular (recibidos el 10/10/2026, §116)

- Titular: Patricia Adriana Pecora (autónoma; sin Registro Mercantil).
- NIF (NIE): X8044791N.
- Domicilio: Carrer de Pompeu Fabra, 1, 08860 Castelldefels (Barcelona).
- Email: latelierdudesert@gmail.com (`LEGAL_CONTACT_EMAIL`; conviene ponerlo también en Panel → Configuración).
- Dominio: www.latelierdudesert.com.

## Datos que faltan

| Dato                                                                          | Dónde aparece                      |
| ----------------------------------------------------------------------------- | ---------------------------------- |
| Teléfono de contacto (en el panel)                                            | Aviso legal, condiciones           |
| Zonas de envío                                                                | Condiciones, envíos                |
| Tarifa de envío e importe para envío gratis                                   | Envíos                             |
| Plazo de entrega y transportista                                              | Envíos, privacidad (destinatarios) |
| Medios de pago (tarjeta por TPV virtual, Bizum…)                              | Condiciones                        |
| Si se adhiere al arbitraje de consumo (Junta Arbitral de Consum de Catalunya) | Condiciones                        |

## Decisiones tomadas en el borrador (confirmar con el cliente)

1. **Perfumes desprecintados sin desistimiento** (art. 103.e TRLGDCU): si se retira el precinto o el celofán, no hay devolución por desistimiento. No afecta a la garantía.
2. **Gastos de devolución a cargo del cliente** en el desistimiento (art. 108.1); en productos dañados o equivocados, a cargo de la tienda.
3. **Recogida gratuita en la tienda** de Castelldefels como opción de entrega, y devoluciones a la misma dirección.
4. **Venta solo a mayores de edad**; Club L’Atelier desde 14 años (art. 7 LOPDGDD).
5. **Garantía legal de 3 años**, sin garantía comercial adicional.
6. **Sin aviso de cookies:** la web solo usa cookies técnicas, exentas por el art. 22.2 LSSI. La política lista solo la del idioma (`NEXT_LOCALE`), que es la que reciben los clientes; las de sesión y vista previa del equipo y la de Vercel mientras la web es privada no se citan. **Si se añade analítica, publicidad, un mapa incrustado o un píxel, hace falta un aviso con consentimiento previo y actualizar la política.**
7. **Proveedores en privacidad, por categorías:** alojamiento y base de datos en la UE (Vercel, París; Supabase, Fráncfort), email del Club (Sender, Lituania), y banco, transportista y email de pedidos. Las transferencias se explican sin nombrar a nadie. El asistente del panel (Anthropic) no se cita porque no trata datos de clientes; si llegan los mensajes con borradores de IA (A6.3), hay que añadirlo.
8. **Sin plataforma ODR europea:** dejó de existir el 20/07/2025, así que no se enlaza.
9. Los textos están en los tres idiomas sin cláusula de prevalencia (el Código de consumo de Cataluña exige la información también en catalán).

## Qué falta revisar con la asesoría

- Todo el texto, en especial condiciones de venta, desistimiento y privacidad.
- Si el registro de consentimientos del Club y su conservación tras la baja son suficientes.
- Contratos de encargo de tratamiento (DPA) con Vercel, Supabase y Sender, y más adelante con el banco, el transportista y el proveedor de email.
- Registro de actividades de tratamiento (documento interno, no se publica).
- Hojas oficiales de reclamación en la tienda y el cartel que las anuncia.
- Al activar la compra online: repasar condiciones, envíos y privacidad con los datos reales del checkout y enviar las condiciones en el email de confirmación (soporte duradero).
