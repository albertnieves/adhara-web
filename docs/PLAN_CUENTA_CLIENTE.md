# Cuenta de cliente (F14)

Plan de la fase 14 del roadmap (H3), pedido por el usuario el 13/10/2026. Decisiones en
[DECISIONS.md](DECISIONS.md) §142–146.

## Objetivo

Que quien compra en la web pueda crear una cuenta (con email y contraseña o con
Google) para ver sus pedidos y guardar sus datos y su dirección de envío. Comprar
como invitado sigue siendo posible (PLAN_PEDIDOS_WEB: «cuenta opcional, sin obligar
a registrarse»).

## Decisiones del usuario (13/10)

- **Se construye ya y queda apagado** tras el interruptor `CUSTOMER_ACCOUNTS`, como
  el checkout con `WEB_CHECKOUT`. Sin él, las páginas de la cuenta responden 404, la
  cabecera no enlaza la cuenta y el checkout no lee la sesión.
- **Google y email; Apple, más adelante** (necesita el Apple Developer Program).

## Alcance

| Entrega | Contenido                                                                                                                                             |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| C01     | Base de datos: `customer_accounts` (con la dirección de envío), `orders.customer_id`, funciones `customer_*`, RLS y pgTAP (un cliente no ve el panel) |
| C02     | Alta con email y contraseña y confirmación, acceso, recuperación y nueva contraseña, en es/ca/en                                                      |
| C03     | Acceso con Google (OAuth con PKCE y `/auth/callback`)                                                                                                 |
| C04     | Mi cuenta: pedidos y ficha de cada pedido, datos, dirección y borrar la cuenta; el checkout rellena los datos y vincula el pedido a la cuenta         |
| C05     | Privacidad, documentación, unitarias y E2E                                                                                                            |

Fuera de esta entrega: Apple, cambiar el email desde la tienda, varias direcciones,
lista de deseos, fidelización, captcha y la ficha de cliente del panel (A7).

**Estado (14/10):** C01–C05 hechas en una rama, apagadas. Verificado en local sin
Docker (§146): lint, tipos, unitarias, build, pgTAP con emulación y capturas; los E2E
de la cuenta corren en `e2e.yml`.

## Rutas

| es                            | ca                            | en                            | Qué                     |
| ----------------------------- | ----------------------------- | ----------------------------- | ----------------------- |
| `/es/cuenta`                  | `/ca/compte`                  | `/en/account`                 | Mis pedidos             |
| `/es/cuenta/pedidos/[n]`      | `/ca/compte/comandes/[n]`     | `/en/account/orders/[n]`      | Ficha de un pedido      |
| `/es/cuenta/datos`            | `/ca/compte/dades`            | `/en/account/details`         | Datos, dirección y baja |
| `/es/cuenta/acceso`           | `/ca/compte/acces`            | `/en/account/sign-in`         | Entrar (email o Google) |
| `/es/cuenta/registro`         | `/ca/compte/registre`         | `/en/account/register`        | Crear la cuenta         |
| `/es/cuenta/recuperar`        | `/ca/compte/recuperar`        | `/en/account/forgot-password` | Pedir el enlace         |
| `/es/cuenta/nueva-contrasena` | `/ca/compte/nova-contrasenya` | `/en/account/new-password`    | Elegir contraseña       |

Además, fuera del idioma: `/auth/callback` (vuelta de Google) y `/auth/confirm`
(enlaces de los correos de Auth, ya existente para el personal).

## Seguridad

- **Clientes y personal comparten Supabase Auth.** Abrir el alta hace que una sesión
  deje de significar «personal»: la base ya decide por `has_permission` / `is_staff`,
  y una prueba pgTAP lo demuestra con una cuenta de cliente frente a todas las tablas y
  funciones `admin_*`. El panel sigue exigiendo ficha de personal y MFA (`aal2`).
- **Pedidos de la cuenta:** los vinculados al hacerlos con la sesión iniciada y los de
  invitado con el mismo email, solo si la cuenta tiene el email verificado. Sin costes,
  sin intentos de pago ni cronología interna.
- **Escrituras solo con funciones** `customer_*` que validan cada campo; las tablas no
  admiten escritura directa.
- **Borrar la cuenta:** la clave privilegiada borra el usuario de Auth tras comprobar
  la sesión y que no es personal. Los pedidos se conservan (obligación contable) sin
  el vínculo con la cuenta; los datos del pedido siguen las reglas de conservación del
  pedido.
- **Personal en la tienda:** puede entrar con la misma cuenta, pero no borrarla desde
  la tienda ni cambiar su contraseña sin el segundo factor: la página de nueva
  contraseña lo manda al flujo del panel.
- **Antibots:** campo trampa, confirmación del email y límites de Supabase. Captcha
  (Turnstile) pendiente antes de encender: exige token también en el acceso del panel.

## Para encender (pendiente del usuario)

1. Correo de Auth con Resend como SMTP en Supabase (el de serie solo envía al equipo).
2. Supabase → Authentication: activar el alta pública y «Confirm email»; plantillas
   _Confirm signup_ y _Reset password_ como `supabase/templates/` (enlace a
   `/auth/confirm` con `next={{ .RedirectTo }}`); Redirect URLs con
   `https://latelierdudesert.com/**`; protección de contraseñas filtradas.
3. Google Cloud: cliente OAuth web con la pantalla de consentimiento de la marca y el
   dominio verificado; redirección `https://<proyecto>.supabase.co/auth/v1/callback`.
   Client ID y secreto en Supabase → Providers → Google (nunca por chat). Con la marca
   aprobada, la «G» oficial en el botón.
4. Captcha (Turnstile) en el alta y el acceso de la tienda y del panel.
5. Aplicar la migración `20261016120000_customer_accounts.sql` en el proyecto.
6. Textos legales revisados con la asesoría (privacidad con la cuenta y Google, cookies
   de la sesión), nueva `LEGAL_UPDATED_AT` y `CUSTOMER_ACCOUNTS=1` en Vercel.
7. Probar en el proyecto: alta con correo real, Google, recuperación y borrar la cuenta.
