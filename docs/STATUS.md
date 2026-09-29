# Estado real — 29/09/2026

**Arranque local y despliegue en Vercel verificados. La Fase 1 completa sigue pendiente.**

## Preparado

- Base Next.js 16.3.6, React 19.3.0, TypeScript 6.0.3, Tailwind 4.3.3 y next-intl 4.14.7; lockfile y versiones fijadas.
- Home y catálogo técnicos en es/ca/en, negociación de idioma, robots de desarrollo y health check.
- Instrucciones para Codex, documentación de decisiones y copias intactas de los documentos aportados.
- Seis habilidades instaladas en Codex: React Best Practices, Web Design Guidelines, Supabase Postgres Best Practices, Security Best Practices, GH Fix CI y Vercel Deploy.
- Workflow de calidad preparado para GitHub Actions, todavía sin run remoto.
- Repositorio privado en https://github.com/albertnieves/adhara-web. Acceso de lectura y escritura confirmado mediante el conector de Codex. Publicación inicial mediante la API de GitHub; Git local sigue sin credenciales.
- Vercel: proyecto `adhara-web` en el equipo SOAPBRXND (plan Hobby) de la cuenta albertnieves, conectado a GitHub. Cada push a `main` despliega a producción en https://adhara-web.vercel.app; ramas y PR generan previews. Todos los despliegues, producción incluida, exigen iniciar sesión en Vercel (Vercel Authentication para todos los despliegues). Build con pnpm 11.19.0, Node 24.x y Webpack. Funciones en París (cdg1).

## Validación ejecutada

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

## Pendiente

Verificar CI remoto y configurar las protecciones de main disponibles en el plan; Docker/Supabase local; migraciones y RLS; admin/MFA; validación de variables de servicios; SEO editorial; pruebas de fuga de costes; entornos dev/prod separados y variables en Vercel cuando exista Supabase; pruebas E2E contra despliegues protegidos (requieren bypass de automatización). El único servicio remoto creado es el proyecto de Vercel en plan Hobby, sin cargos. No existe catálogo ni datos ficticios.

Ver docs/DEVELOPMENT.md para continuar. Los problemas de compatibilidad y el ajuste de servidor local están en docs/DECISIONS.md.
