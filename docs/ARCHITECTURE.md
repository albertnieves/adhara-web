# Arquitectura

Partes técnicas de la Fase 0 consolidadas con lo implementado hasta el cierre de la Fase 1 (02/10/2026). Las decisiones y sus cambios están en [DECISIONS.md](DECISIONS.md); la base de datos, en [DATABASE.md](DATABASE.md); la seguridad, en [SECURITY.md](SECURITY.md).

## Visión general

Monolito Next.js con módulos de dominio (ADR-001), desplegado en Vercel, con Supabase como base de datos, autenticación y almacenamiento.

| Pieza          | Versión instalada (exacta)                                                        |
| -------------- | --------------------------------------------------------------------------------- |
| Node / pnpm    | 24.16.0 (`.nvmrc`) / 11.19.0                                                      |
| Next.js        | 16.3.8, App Router, compilado con webpack (DECISIONS §11)                         |
| React          | 19.3.0                                                                            |
| TypeScript     | 6.0.3, estricto                                                                   |
| Tailwind CSS   | 4.3.3                                                                             |
| next-intl      | 4.14.7                                                                            |
| Supabase       | `@supabase/supabase-js` 2.117.2, `@supabase/ssr` 0.12.7, CLI 2.118.0, Postgres 17 |
| zod            | 4.6.5                                                                             |
| 3D y animación | three 0.186.1, @react-three/fiber 9.8.1, @react-three/drei 10.7.9, motion 13.4.4  |
| Asistente      | `@anthropic-ai/sdk` 0.130.0                                                       |
| Pruebas        | Vitest 5.0.2, Playwright 1.63.0, pgTAP                                            |

```mermaid
flowchart LR
  B[Navegador] --> P["proxy.ts<br/>idioma y sesión"]
  P --> S["Tienda<br/>app/[locale]"]
  P --> A["Panel<br/>app/admin"]
  S -->|cliente anónimo, ISR| DB[("Supabase<br/>public + RLS")]
  A -->|requireStaff / requirePermission| DB
  A -->|funciones admin_*| I[(internal / private)]
  C[Vercel Cron] -->|CRON_SECRET| J[api/cron/*]
  J -->|clave privilegiada| DB
  A -->|herramientas de solo lectura| L[Claude API]
  S -->|formulario firmado| R[Redsys]
  R -->|notificación firmada| N[api/pagos/redsys]
  N -->|web_order_*| DB
  J -->|correos| M[Resend]
  J -->|resumen| L
```

## Capas y módulos

- `src/app/` solo compone rutas: páginas, layouts, Server Actions finas y Route Handlers.
- `src/modules/<dominio>/` contiene la lógica:
  - `domain/`: reglas puras y probadas, sin E/S;
  - `server/`: acceso a datos y casos de uso, con `import 'server-only'`;
  - `ui/`: componentes del dominio;
  - `index.ts`: API pública segura para el cliente; `server.ts`: API de servidor.
- `src/lib/`: infraestructura compartida (clientes de Supabase, dinero, CSV, identificadores de petición).
- `src/components/ui/`: primitivas del sistema de diseño (Fase 2), las mismas para la tienda y el panel, sin datos ni lógica de dominio. Su referencia está en `/admin/diseno`.

| Módulo       | Qué hace                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------- |
| `auth`       | Matriz de permisos, decisión de acceso al panel, sesión, MFA, invitaciones                  |
| `admin`      | Piezas comunes del panel: `useAdminAction`, `Sheet`, avisos, búsqueda                       |
| `catalog`    | Perfumes, formatos, imágenes, importación CSV, lecturas de la tienda                        |
| `pricing`    | Margen, Ómnibus, revisión de cambios de PVP y cambios masivos (dominio puro)                |
| `inventory`  | Movimientos, recuentos, niveles y vigilante de stock                                        |
| `purchasing` | Proveedores, pedidos de compra, recepciones y propuestas de reposición                      |
| `reports`    | Existencias y cierre, rotación, márgenes, compras y auditoría                               |
| `control`    | Consola del titular: negocio, métricas por perfume, visitas, copias, estado                 |
| `assistant`  | Informe diario, resumen y chat con herramientas de solo lectura                             |
| `content`    | Portada y datos de la tienda con borrador, revisiones y publicación                         |
| `storefront` | Componentes y lecturas de la tienda pública                                                 |
| `i18n`       | Rutas por idioma, carga de mensajes, metadatos y `buildAlternates`                          |
| `unboxing`   | Escena 3D bajo demanda de la ficha                                                          |
| `brand`      | Logotipo y nombre de la marca                                                               |
| `design`     | Catálogo de tokens, matriz de contraste y página de referencia `/admin/diseno`              |
| `orders`     | Pedidos web: estados, transiciones, cobros, incidencias y panel (P05)                       |
| `checkout`   | Cesta en cookie, zonas y tarifas de envío, checkout y caducidad (P03)                       |
| `payments`   | Redsys por redirección: firma, formulario de pago, notificación y devoluciones (P04, P06)   |
| `mail`       | Correos de los pedidos: plantillas es/ca/en, cola y envío con Resend (P06)                  |
| `messaging`  | Bandeja de mensajes (A6.1): formulario de contacto, panel, respuestas y correo entrante     |
| `account`    | Cuenta de cliente (F14): acceso con email o Google, pedidos, datos y baja; apagada          |
| `tracking`   | Analítica y publicidad con consentimiento (§179): proveedores, elección, etiquetas, eventos |

Reglas de importación: los componentes de cliente solo importan `index.ts`; los secretos y el acceso privilegiado solo existen en módulos `server-only`; `@typescript-eslint/no-explicit-any` y `consistent-type-imports` son errores.

## Renderizado y datos

- **Tienda:** páginas estáticas con ISR de 5 minutos, leídas con un cliente anónimo sin cookies (`createSupabasePublicClient`); el panel revalida al guardar (DECISIONS §36). Nunca ve costes ni unidades.
- **Vista previa del personal:** Draft Mode de Next, que se activa solo desde el panel con `catalog.edit` y MFA; en ese modo la tienda lee con la sesión y la RLS decide (DECISIONS §47).
- **Panel:** dinámico, `private, no-store`, con la sesión del usuario (`createSupabaseServerClient`). Escrituras sensibles mediante funciones `admin_*`.
- **Cesta y checkout (P03, tras `WEB_CHECKOUT=1`):** la cesta vive en la cookie técnica `atelier_cesta` (solo formatos y cantidades); `/cesta` y `/finalizar-compra` son dinámicas y leen precio y stock en cada visita con el cliente anónimo. El contador de la cabecera lee la cookie en el navegador, así que el resto de la tienda sigue siendo estática. El pedido lo crea `web_order_create`, que vuelve a calcular precio, envío y stock (DECISIONS §136). Con el TPV configurado, el navegador va al banco con un formulario firmado en el servidor y el pago lo confirma solo la notificación del banco (`/api/pagos/redsys`, §137); la vuelta lleva a `/pedido`.
- **Cuenta de cliente (F14, tras `CUSTOMER_ACCOUNTS=1`):** `/cuenta…` es dinámica y lee la sesión validada (`getUser()`); el proxy refresca las cookies de la sesión solo en esas rutas y en el checkout, que rellena los datos de la cuenta y vincula el pedido. El enlace «Cuenta» de la cabecera no lee la sesión, así que el resto de la tienda sigue estático. Google vuelve por `/auth/callback` (PKCE) y los correos de Auth por `/auth/confirm` ([PLAN_CUENTA_CLIENTE.md](PLAN_CUENTA_CLIENTE.md)).
- **Analítica y publicidad (§179, apagadas sin IDs):** el layout de la tienda lee los IDs al generar las páginas y los pasa al aviso de entrada y a `TrackingTags`, que carga en el navegador solo lo aceptado. El panel no las incluye nunca, ni la vista previa del personal. Feed de productos en `/feeds/productos.xml` (§180), solo con la venta encendida ([MEDICION_Y_PUBLICIDAD.md](MEDICION_Y_PUBLICIDAD.md)).
- **Dinero:** céntimos enteros; IVA y porcentajes en puntos básicos ([PRICING.md](PRICING.md)).

| Cliente de Supabase          | Clave                          | Uso                                                                                  |
| ---------------------------- | ------------------------------ | ------------------------------------------------------------------------------------ |
| `createSupabaseServerClient` | Publicable + cookies de sesión | Panel y vista previa                                                                 |
| `createSupabasePublicClient` | Publicable, sin cookies        | Tienda estática                                                                      |
| `createAuthAdminClient`      | Secreta                        | Invitaciones de Auth, tras `staff.manage`; borrar la cuenta de cliente propia (§145) |
| `createJobClient`            | Secreta                        | Informe diario y copia diaria (§128)                                                 |
| `createOrdersClient`         | Secreta                        | Solo funciones `web_order_*` (§131, §136)                                            |
| `createMessagesClient`       | Secreta                        | Solo funciones de mensajes `web_*` (§154)                                            |

## Tareas programadas y asistente

Vercel Cron (`vercel.json`) llama con `CRON_SECRET` a `/api/cron/informe-diario` (05:15 UTC; guarda el informe del día anterior y su resumen), `/api/cron/copia-diaria` (03:30 UTC) y, cada 5 minutos (plan Pro), `/api/cron/caducar-reservas`, que libera las reservas de pedidos web sin pagar (`web_order_release_expired`, DECISIONS §136), y `/api/cron/enviar-correos`, que envía los correos de los pedidos (§138) y las respuestas de la bandeja de mensajes (§155) que sigan en la cola. El correo entrante llega por el webhook firmado de Resend Inbound (`/api/correo/entrante`, §155). El chat del panel (`/admin/asistente/consulta`) usa el _tool runner_ del SDK de Anthropic con herramientas zod de solo lectura que leen con la sesión de quien pregunta (DECISIONS §77–81).

## Despliegue y entornos

| Entorno    | Dónde                                                                 | Base de datos                                 |
| ---------- | --------------------------------------------------------------------- | --------------------------------------------- |
| Local      | `pnpm dev` (webpack, `localhost`); Supabase local con Docker opcional | Local o `atelier-dev`                         |
| CI         | GitHub Actions: `ci.yml`, `db.yml`, `e2e.yml`                         | Supabase local efímero                        |
| Preview    | Vercel, una por rama y PR                                             | `atelier-dev`                                 |
| Production | Vercel desde `main`, funciones en París (cdg1)                        | `atelier-dev` hasta que exista `atelier-prod` |

Todos los despliegues de Vercel están protegidos con Vercel Authentication y responden `noindex`. No se despliega a producción por defecto (AGENTS.md).

## Diferencias con la Fase 0

- Español, catalán e inglés desde el principio, con prefijo (ADR-010 sustituye a ADR-008).
- Roles `system_admin`, `store_admin` y `viewer` en lugar de los cuatro de la Fase 0 (DECISIONS §14).
- Esquema de catálogo simplificado, sin taxonomía ni claims todavía (DECISIONS §30 y §86).
- Parte visual (tienda animada, 3D del piloto) adelantada por decisión del usuario (DECISIONS §27).
- Pagos: la Fase 0 suponía Stripe; el usuario cobrará con un TPV de tarjeta y el proveedor está pendiente (DECISIONS §82).
