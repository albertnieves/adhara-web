# Revisión de seguridad — 03/11/2026

A petición del usuario: «securiza la página, protégeme las consultas y del XSS, cualquier mejora de seguridad que podamos implantar para no tener ningún intruso o que puedan coger datos». Decisión en [DECISIONS.md](DECISIONS.md) §187; reglas vigentes en [SECURITY.md](SECURITY.md). Sigue a la [revisión del 17/10](SECURITY_REVIEW_2026-10.md).

## Alcance y método

- **Código:** cada consulta a la base hecha desde la aplicación (filtros de supabase-js con texto, `like`, `or`, RPC), toda salida HTML que no pasa por el escapado de React, los accesos (panel, cuenta de cliente, enlaces de Auth, Google), las subidas, las rutas públicas, las cookies, las cabeceras y las dependencias. Sobre lo que ya comprobó la revisión del 17/10 y lo añadido después (mensajes, envíos, medición, búsqueda, fichas de cliente, lotes y promociones).
- **`pnpm audit`** de las dependencias de producción y de desarrollo.
- **Asesor de seguridad de Supabase** (`atelier-dev`, solo lectura, 03/11): solo los avisos intencionados de SECURITY.md (tablas de `internal` y `private` sin políticas, funciones públicas por diseño y funciones `admin_*` que comprueban permiso y MFA dentro). La protección de contraseñas filtradas ya no aparece (activada el 23/10).

## Arreglado en esta entrega

| Gravedad   | Hallazgo                                                                                                                                                                                       | Arreglo                                                                          |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Crítica    | Next.js 16.3.8: ejecución remota de código sin sesión en la optimización de imágenes (SVG) y en `use cache`, y denegación de servicio con las Server Actions                                   | Next.js 16.4.4                                                                   |
| Alta       | zod 4.6.5: una entrada con colecciones enormes podía agotar la memoria del servidor al validarla                                                                                               | zod 4.6.7                                                                        |
| Media      | Sin freno por visitante en el acceso al panel, el segundo factor, la recuperación de contraseña, la cuenta de cliente y el Club: Supabase ve la IP de Vercel y el Club solo tenía freno global | Freno por cliente antes de Supabase en las siete acciones                        |
| Media      | Las cookies de la sesión se podían leer desde JavaScript: un XSS habría podido llevarse la sesión (también la del personal)                                                                    | Cookies `httpOnly` (no hay cliente de Supabase en el navegador)                  |
| Media      | Abrir el enlace de un correo de Auth abría sesión con un GET: inicio de sesión forzado y enlaces gastados por los antivirus del correo                                                         | Página con botón y POST solo desde la tienda                                     |
| Baja–media | La CSP no limitaba los scripts ni los formularios                                                                                                                                              | `script-src` con orígenes conocidos y sin `eval`; `form-action` a tienda y banco |
| Baja       | Las subidas del panel se aceptaban por el tipo que declara el navegador                                                                                                                        | Comprobación de los primeros bytes (JPG, PNG, WebP, AVIF)                        |
| Baja       | Sin `Cross-Origin-Opener-Policy`; `Permissions-Policy` corta                                                                                                                                   | `same-origin-allow-popups` y más APIs del navegador apagadas                     |
| Baja (dev) | Vitest 5.0.2 y Vite 8.3.1 con avisos (solo en las pruebas, nunca en la web)                                                                                                                    | Vitest 5.0.5 y Vite 8.3.5                                                        |

## Comprobado y correcto

- **Consultas:** todas pasan por supabase-js (parámetros, nunca SQL montado con texto) o por funciones con argumentos tipados. El único filtro `or` con texto (tablero de envíos) usa una fecha calculada en el servidor; el `like` de la auditoría solo lo puede usar quien tiene `staff.manage` y solo ve lo que ya puede leer. Las búsquedas del panel van por funciones con parámetros. El SQL dinámico de la copia diaria usa `%I` y una lista blanca. Todas las tablas públicas con RLS.
- **XSS:** React escapa toda la salida; el único `dangerouslySetInnerHTML` es el JSON-LD, que escapa `<`. Los enlaces que vienen de la base solo admiten https, mailto y tel. Los IDs de medición se validan con un formato cerrado antes de insertarlos. Los correos escapan el HTML y el panel nunca pinta HTML de un correo recibido. La nueva página de `/auth/confirm` escapa todo lo que viene de la dirección (prueba E2E con un `next` que intenta meter un script).
- **Panel:** cada página, Server Action y Route Handler autoriza por sí mismo (`requireStaff` / `requirePermission`) y la base vuelve a comprobar permiso y MFA. Las Server Actions comprueban el origen (Next).
- **Rutas públicas:** el TPV, el correo entrante y los avisos de Sendcloud comprueban su firma en tiempo constante antes de leer nada; `/api/eventos` descarta otros orígenes y cuerpos grandes; las tareas programadas exigen `CRON_SECRET`.
- **Secretos:** solo en módulos `server-only`; `scan:secrets` en la CI.

## Pendiente (decide o hace el titular)

- **Firewall de Vercel** antes de abrir la venta: límite por IP a los `POST` con la cabecera `Next-Action` y a `/api/pagos/redsys`, `/contacto` y `/api/correo/entrante` (ya en SECURITY.md). Complementa los frenos de la aplicación ante muchas IP.
- **Proteger `main` en GitHub** (PR obligatoria y CI en verde) y el **MFA del administrador de la tienda**: siguen pendientes del titular.
- **Proyecto `atelier-prod`** separado antes de abrir al público (DECISIONS §43).
- **Captcha (Turnstile)** en el alta, el acceso y el pedido si aparecen abusos desde muchas IP.
- **CSP con nonce** (sin `'unsafe-inline'`): obligaría a renderizar cada página de la tienda en cada visita; valorarlo cuando se mida el coste.
- **Auditoría:** `record_audit_event` deja a cualquier persona del equipo con MFA escribir entradas con cualquier acción (del informe del 17/10, menor); propuesta de lista de acciones permitidas con migración.
- **ESLint 9** trae `minimatch` 3 con un aviso moderado de denegación de servicio; solo afecta a los patrones de la configuración del lint, nunca a datos de fuera. Se irá con ESLint 10.

## Verificación

Ver el estado del 03/11 en [STATUS.md](STATUS.md).
