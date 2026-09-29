# Estado real — 29/09/2026

**Arranque local verificado. La Fase 1 completa sigue pendiente. Panel de administración: fase A0 (reglas de dominio) implementada; sin pantallas ni base de datos.**

## Preparado

- Base Next.js 16.3.6, React 19.3.0, TypeScript 6.0.3, Tailwind 4.3.3 y next-intl 4.14.7; lockfile y versiones fijadas.
- Home y catálogo técnicos en es/ca/en, negociación de idioma, robots de desarrollo y health check.
- Instrucciones para Codex, documentación de decisiones y copias intactas de los documentos aportados.
- Seis habilidades instaladas en Codex: React Best Practices, Web Design Guidelines, Supabase Postgres Best Practices, Security Best Practices, GH Fix CI y Vercel Deploy.
- Workflow de calidad preparado para GitHub Actions, todavía sin run remoto.
- Repositorio privado en https://github.com/albertnieves/adhara-web. Acceso de lectura y escritura confirmado mediante el conector de Codex. Publicación inicial mediante la API de GitHub; Git local sigue sin credenciales.

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

Las pruebas de navegador cubren redirección inicial, preferencia por cookie, rutas traducidas, html lang, noindex y 404 para admin/no soportado. No son pruebas de ecommerce, auth ni base de datos.

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

## Pendiente

Verificar CI remoto y configurar las protecciones de main disponibles en el plan; Docker/Supabase local; migraciones y RLS; admin/MFA; validación de variables de servicios; SEO editorial; pruebas de fuga de costes; proyectos dev/prod y Vercel Preview. No se ha creado ni cobrado ningún servicio remoto. No existe catálogo ni datos ficticios.

Ver docs/DEVELOPMENT.md para continuar. Los problemas de compatibilidad y el ajuste de servidor local están en docs/DECISIONS.md.
