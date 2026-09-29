# Decisiones del arranque — 28/09/2026

1. Repositorio: adhara-web, privado. Cuenta conectada observada: albertnieves. El usuario lo creó durante la sesión; posteriormente se verificó el acceso del conector y se cambió a privado.
2. Se conserva Git existente; no se crea otro repositorio anidado.
3. Se prepara una base ejecutable, no toda la Fase 1. No se crean cuentas, servicios de pago ni producción como consecuencia de los documentos adjuntos.
4. FASE_0_ARQUITECTURA.md recibido no es la «rev. 2» citada por FASE_1_PLAN.md: propone español sin prefijo y contiene costes en variantes. FASE_1 propone es/ca/en y costes internos separados. Se sigue el plan posterior para el arranque; consolidar el resto antes de migraciones. No inventar ADR-010 a ADR-016 ausentes del documento recibido.
5. Es/ca/en preparados; solo home y catálogo técnicos. Mapa completo de rutas y SEO por estado editorial pendientes.
6. Node 24.16.0 y pnpm 11.19.0, disponibles en esta máquina. Dependencias exactas en package.json y pnpm-lock.yaml.
7. ESLint 9 se mantiene temporalmente por incompatibilidad declarada de los plugins de Next con ESLint 10. Existe aviso de fin de soporte: revisar cuando los plugins admitan 10. TypeScript 6.0 se elige por compatibilidad con typescript-eslint (<6.1); no forzar TypeScript 7.
8. No se exige Supabase durante este arranque. Al implementar conexión se añadirá validación de entorno y se exigirán variables en build y ejecución según su ámbito.
9. No se crea un admin ficticiamente protegido: /admin devuelve 404 hasta implementar auth, roles, MFA y RLS juntos.
10. Sin fuentes externas, datos de producto ni media. La apariencia actual es únicamente técnica.

11. Se usan `next dev --webpack` y `next build --webpack`: Turbopack no puede abrir el puerto de su proceso CSS en este entorno, incluso al solicitar ejecución ampliada. Webpack compiló correctamente. Revisar Turbopack cuando cambie el entorno.

12. Los servidores locales se ligan a localhost para mantener el mismo origen que las reescrituras de Next.js. La prueba con 127.0.0.1 producía bucles en rutas traducidas; con localhost pasan las 12 pruebas. Incidencia similar documentada en https://github.com/vercel/next.js/issues/94342. Verificar por separado el despliegue real.

## Panel de administración — 29/09/2026

13. El panel se planifica en fases A0–A8 (docs/ADMIN_PLAN.md), enlazadas con el roadmap original. Se empieza por A0: reglas de dominio puras y probadas, sin servicios, dependencias nuevas ni pantallas. /admin sigue en 404 (decisión 9).
14. Roles del personal confirmados por el usuario: `system_admin` (administrador del sistema, todo), `store_admin` (administrador de la tienda in situ, toda la operación incluidos costes y reembolsos, sin usuarios ni configuración) y `viewer` (encargado, solo lectura sin clientes ni costes). Sustituyen a owner/manager/store_staff/content_editor de la Fase 0 §11. Los clientes no son rol de personal: acceso a sus propios datos por RLS.
15. Agente de inventario en dos capas: vigilante determinista (`watchStock`) y asistente conversacional. Solo lee y propone; una persona con permiso aprueba y la propuesta se ejecuta por el caso de uso normal. Para el asistente se propone Claude API con el tool runner del SDK de TypeScript en nuestro servidor; `@anthropic-ai/sdk` no se instala hasta A4.2.
16. El precio anterior tachado se valida con el criterio Ómnibus: no puede superar el PVP más bajo de los 30 días previos. Las excepciones legales (rebajas progresivas) quedan pendientes de asesoría.
17. Esta sesión de Claude Code trabaja en la rama `claude/wizardly-ride-5ul3ai`, asignada por el entorno, en lugar del prefijo `codex/` de AGENTS.md. El cambio se revisa igualmente mediante PR.
18. Vitest resuelve el alias `@/` para que los módulos se importen entre sí por su `index.ts`, igual que en Next.js.
19. Proyecto `adhara-dev` creado el 29/09/2026 en la organización del usuario, región `eu-central-1`, a petición explícita. Migraciones aplicadas con el conector de Supabase y guardadas con la misma versión en `supabase/migrations/`.
20. `public.record_audit_event` es `SECURITY DEFINER` ejecutable por `authenticated` de forma intencionada (aviso 0029 del asesor): es la única vía de escritura en `audit_log`, rechaza a quien no sea personal activo y fija el actor a `auth.uid()`.
21. Sin Docker en la sesión, las pruebas pgTAP se validaron en un Postgres 16 local con una emulación mínima de `auth` y, además, contra `adhara-dev` dentro de una transacción revertida (22/22, sin restos). La emulación no se versiona.
