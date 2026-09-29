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

12. Los servidores locales se ligan a localhost para mantener el mismo origen que las reescrituras de Next.js. La prueba con 127.0.0.1 producía bucles en rutas traducidas; con localhost pasan las 12 pruebas. Incidencia similar documentada en https://github.com/vercel/next.js/issues/94342. Verificar por separado el despliegue real. Verificado en Vercel el 29/09/2026: las rutas traducidas responden 200 sin bucles.
