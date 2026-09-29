# Estado real — 29/09/2026

**Arranque local y despliegue en Vercel verificados. Panel de administración: fases A0 y A1 implementadas. La Fase 1 completa sigue pendiente.**

## Preparado

- Base Next.js 16.3.6, React 19.3.0, TypeScript 6.0.3, Tailwind 4.3.3 y next-intl 4.14.7; lockfile y versiones fijadas.
- Home y catálogo técnicos en es/ca/en, negociación de idioma, robots de desarrollo y health check.
- Instrucciones para Codex, documentación de decisiones y copias intactas de los documentos aportados.
- Seis habilidades instaladas en Codex: React Best Practices, Web Design Guidelines, Supabase Postgres Best Practices, Security Best Practices, GH Fix CI y Vercel Deploy.
- Workflow de calidad preparado para GitHub Actions, todavía sin run remoto.
- Repositorio privado en https://github.com/albertnieves/adhara-web. Acceso de lectura y escritura confirmado mediante el conector de Codex. Publicación inicial mediante la API de GitHub; Git local sigue sin credenciales.
- Vercel: proyecto `adhara-web` en el equipo SOAPBRXND (plan Hobby) de la cuenta albertnieves, conectado a GitHub. Cada push a `main` despliega a producción en https://adhara-web.vercel.app; ramas y PR generan previews. Todos los despliegues, producción incluida, exigen iniciar sesión en Vercel (Vercel Authentication para todos los despliegues). Build con pnpm 11.19.0, Node 24.x y Webpack. Funciones en París (cdg1).

## Validación del arranque — 28/09/2026

| Comprobación                            | Resultado                                     |
| --------------------------------------- | --------------------------------------------- |
| Lint                                    | Correcto, sin warnings                        |
| Typecheck                               | Correcto                                      |
| Vitest                                  | 3 tests correctos                             |
| Build de producción con Webpack         | Correcto, 10 páginas generadas                |
| Playwright                              | 12 tests correctos, escritorio y móvil        |
| Formato                                 | Correcto                                      |
| Dependencias pares                      | Sin incompatibilidades                        |
| Auditoría de dependencias de producción | Sin vulnerabilidades conocidas en la consulta |
| Documentos originales                   | Copias idénticas a los aportados              |
| Despliegue Vercel (commit 5a444ce)      | Build correcto; rutas verificadas en la URL   |

Las pruebas de navegador cubren redirección inicial, preferencia por cookie, rutas traducidas, html lang, noindex y 404 para admin/no soportado. No son pruebas de ecommerce, auth ni base de datos.

En Vercel se comprobaron contra https://adhara-web.vercel.app, antes de hacerla privada, las aserciones de Playwright: redirección e idioma por cabecera y cookie, 404 de admin y locale no soportado, estado 200, noindex, html lang y h1 en las tres rutas del catálogo, y /api/health. Las tres pruebas de navegador no pudieron ejecutarse en Chromium desde el entorno cloud por el proxy TLS; sus aserciones se verificaron por HTTP.

## Panel de administración — 29/09/2026

Plan por fases en docs/ADMIN_PLAN.md. Implementada la fase A0, solo código de dominio sin I/O ni dependencias nuevas:

- `src/lib/money.ts`: céntimos, IVA en puntos básicos, redondeo half-even y lectura de importes.
- `modules/auth`: matriz rol → permiso y permisos que exigen aal2.
- `modules/pricing`: margen, referencia Ómnibus de 30 días, revisión de cambios de PVP y ajustes masivos.
- `modules/inventory`: movimientos, invariantes, recuentos y vigilante de stock (capa determinista del agente).
- `modules/orders`: estados del pedido con permiso y efecto de inventario por transición.
- `modules/messaging`: estados de conversación, plazo de respuesta y revisión de borradores del agente.

`/admin` sigue devolviendo 404. No hay tablas, sesiones, pantallas ni llamadas a modelos de IA.

| Comprobación (sesión Claude Code, Node 24.16.0) | Resultado                                                 |
| ----------------------------------------------- | --------------------------------------------------------- |
| Lint y typecheck                                | Correctos                                                 |
| Vitest                                          | 67 tests correctos (7 archivos)                           |
| Build de producción con Webpack                 | Correcto, 10 páginas generadas                            |
| Formato                                         | Correcto                                                  |
| Playwright                                      | 12 tests correctos con el Chromium del sistema (ver nota) |

Nota: el contenedor de la sesión trae Chromium 1194 y el repo fija Playwright 1.63 (Chromium 1243). Se ejecutó con una configuración temporal que apunta al ejecutable del sistema, sin cambiar la del repo. La CI instala el navegador correcto.

## Base de datos — 29/09/2026

Proyecto `adhara-dev` (Frankfurt) con tres migraciones: esquemas `internal`/`private`, personal, permisos por rol, auditoría de solo inserción y RLS. Pruebas pgTAP 22/22 en local y en `adhara-dev` (transacción revertida). Asesores de Supabase: solo el aviso intencionado sobre `record_audit_event` (docs/DECISIONS.md §20). Sin usuarios todavía; login y MFA pendientes (fase A1).

## Acceso al panel — 29/09/2026

Implementado: login con email y contraseña, alta y verificación obligatoria de MFA (TOTP), fijar contraseña desde invitación (`/auth/confirm`), cierre de sesión, guardas de servidor y estructura del panel con navegación. Auditoría de login, logout, MFA y contraseña. `/admin` y subrutas con `noindex` y `Cache-Control: private, no-store`.

Verificado: 76 tests unitarios, build y 22 pruebas E2E (sin sesión → acceso; enlaces inválidos rechazados; cabeceras). Contra `adhara-dev`: la API REST rechaza a anon en todas las tablas y la RPC de auditoría, `internal` no está expuesto, y un login con credenciales falsas muestra el error genérico.

Falta para cerrar A1: alta del primer administrador (`pnpm bootstrap:owner`, requiere la clave secreta en el entorno de la sesión), plantillas de email con `token_hash`, URL del despliegue (Preview de Vercel) y E2E con un usuario de prueba con MFA.

## Pendiente

Verificar CI remoto y configurar las protecciones de main disponibles en el plan; Docker/Supabase local; migraciones y RLS; admin/MFA; validación de variables de servicios; SEO editorial; pruebas de fuga de costes; entornos dev/prod separados y variables en Vercel cuando exista Supabase; pruebas E2E contra despliegues protegidos (requieren bypass de automatización). Servicios remotos creados: proyecto de Vercel (plan Hobby) y proyecto `adhara-dev` de Supabase, ambos sin cargos. No existe catálogo ni datos ficticios.

Ver docs/DEVELOPMENT.md para continuar. Los problemas de compatibilidad y el ajuste de servidor local están en docs/DECISIONS.md.
