# Bandeja de mensajes con clientes (A6.1)

Estado: **en la rama `claude/bandeja-mensajes`, apagada tras `CONTACT_FORM`** · 16/10/2026.

Fase A6.1 de [ADMIN_PLAN.md](ADMIN_PLAN.md) y primera entrega de H3 en [ROADMAP.md](ROADMAP.md). Decisiones en DECISIONS §153–157. Las reglas puras (`modules/messaging`) y los permisos `messages.view` y `messages.reply` existen desde A0.

## Decisiones del usuario (16/10)

- Esta es la siguiente fase, en una PR aparte de las abiertas (#37, #39, #40 y #41).
- Cuando un cliente contesta por email, **su respuesta vuelve al panel**: Resend Inbound en un subdominio (p. ej. `respuestas.latelierdudesert.com`, con un registro MX en Vercel).
- El formulario de contacto queda **apagado tras el interruptor `CONTACT_FORM`**, como el checkout y la cuenta, hasta revisar la privacidad con la asesoría y configurar Resend.

## Objetivo

Que una consulta de un cliente (formulario de la web o email) llegue al panel como una conversación, que el personal la conteste desde allí por email y que la contestación del cliente vuelva a la misma conversación, con plazo de respuesta, asignación, notas internas, plantillas y enlace al pedido.

## Alcance

| Pieza                 | Qué incluye                                                                                                                                                                                                                                                                                               |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base de datos         | Conversaciones, contacto (solo con `customers.view`), mensajes (del cliente, respuestas y notas), cola de respuestas por email, plantillas y la clave de respuesta de cada conversación en `private`. Funciones del servidor (`web_contact_*`, `web_inbound_*`, `web_message_*`) y del panel (`admin_*`). |
| Formulario (es/ca/en) | `/es/contacto`, `/ca/contacte`, `/en/contact`: nombre, email, tema (pedido, perfume u otra cosa), nº de pedido opcional, asunto opcional y mensaje. Campo trampa, límites por email y globales en la base, idempotencia por formulario. Enlace en el pie.                                                 |
| Panel                 | Web → Mensajes: lista con vistas (por responder, esperando al cliente, asignadas a mí, resueltas, spam, todas) y «fuera de plazo»; ficha con el hilo, respuesta con plantilla, nota interna, estado, asignación, pedido enlazado y borrado. Plantillas. Inicio.                                           |
| Correo saliente       | La respuesta se encola en la misma transacción y sale con Resend (después de responder y cada 5 minutos con la tarea de correos), con «Responder a» `consulta-<clave>@<subdominio>` y el mensaje del cliente citado.                                                                                      |
| Correo entrante       | `/api/correo/entrante`: evento `email.received` de Resend con firma Svix comprobada, lectura del correo por su API y alta en la conversación de la clave (o una nueva).                                                                                                                                   |
| Pruebas               | pgTAP `20_customer_messages`, unitarias (reglas, firma, recorte de citas, plantillas del correo, paridad SQL/TS), E2E del formulario y del panel, webhook firmado con la API de Resend simulada y auditoría de diseño y axe.                                                                              |

**Fuera:** WhatsApp (A6.2), borradores del asistente (A6.3), adjuntos (se cuentan, no se guardan), acuse automático al cliente, avisos al personal por email y fichas de cliente (A7).

## Datos

| Tabla                               | Contenido                                                                                                      | Lectura                            |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `conversations`                     | Número, canal, estado, tema, asunto, idioma, pedido, asignada, horas del último mensaje de cada lado, revisión | `messages.view`                    |
| `conversation_contacts`             | Nombre y email del cliente                                                                                     | `messages.view` y `customers.view` |
| `conversation_messages`             | Mensaje del cliente, respuesta o nota interna; id del correo recibido para no duplicarlo                       | `messages.view`                    |
| `message_emails`                    | Cola de las respuestas por email (estado, intentos, error sin datos personales)                                | `messages.view`                    |
| `message_templates`                 | Plantillas de respuesta por idioma                                                                             | `messages.view`                    |
| `private.conversation_reply_tokens` | Clave aleatoria de la dirección de respuesta                                                                   | Nadie: solo las funciones          |

Nadie escribe en las tablas directamente: el servidor (clave privilegiada, solo funciones `web_*`) y el panel (funciones `admin_*` con permiso y MFA).

## Reglas

- **Estados** (`modules/messaging`, misma tabla en SQL): un mensaje del cliente abre la conversación (salvo spam); una respuesta la deja «esperando al cliente»; a mano, abierta o esperando → resuelta o spam, y resuelta o spam → abierta.
- **Plazo:** 24 horas naturales desde el último mensaje del cliente sin respuesta (`RESPONSE_TARGET_MINUTES`).
- **Correo entrante:** se añade a una conversación solo si la clave de la dirección existe, el remitente es el email de la conversación y DMARC no falla. Si no, es una conversación nueva (en spam si DMARC falla).
- **Pedido enlazado:** desde el formulario, solo si el número y el email coinciden con el pedido (si no, se ignora sin decirlo); desde el panel, por número.

## Seguridad

- El formulario no llama a la base con la clave pública: el servidor lo valida y llama a `web_contact_submit` con la clave privilegiada (§154). Así el interruptor apaga también la base y no hay ninguna función nueva para `anon`.
- La firma del webhook se comprueba en tiempo constante, con 5 minutos de margen, antes de leer nada. El cuerpo del correo se guarda como texto plano y el panel lo pinta como texto: nunca HTML del correo.
- Ni la auditoría ni los registros guardan el texto de los mensajes ni el email del cliente.

## Variables (solo servidor)

| Variable                | Para qué                                        | Sin ella                                                        |
| ----------------------- | ----------------------------------------------- | --------------------------------------------------------------- |
| `CONTACT_FORM`          | `1` enseña el formulario                        | La página responde 404 y el pie no la enlaza                    |
| `RESEND_API_KEY`        | Enviar respuestas y leer los correos recibidos  | Las respuestas esperan en la cola                               |
| `EMAIL_FROM`            | Remitente                                       | Igual                                                           |
| `INBOUND_EMAIL_DOMAIN`  | Subdominio de Resend Inbound para «Responder a» | «Responder a» es el email de la tienda y la respuesta no vuelve |
| `RESEND_WEBHOOK_SECRET` | Comprobar la firma de `email.received`          | `/api/correo/entrante` responde 503 y no procesa nada           |

## Para encenderlo

1. Aplicar la migración `20261016120000_customer_messages.sql` en `adhara-dev`.
2. En Resend: verificar el dominio de envío, añadir el subdominio de recepción con su MX en Vercel y crear el webhook `email.received` hacia `https://latelierdudesert.com/api/correo/entrante`.
3. En Vercel (solo servidor): `INBOUND_EMAIL_DOMAIN`, `RESEND_WEBHOOK_SECRET` y, si no están, `RESEND_API_KEY` y `EMAIL_FROM`.
4. Revisión de la asesoría del texto informativo del formulario y de la privacidad; después, `CONTACT_FORM=1`.
