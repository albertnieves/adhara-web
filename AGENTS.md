# ADHARA — instrucciones para Codex

## Contexto

Ecommerce de perfumería árabe. Lee README.md y docs/DEVELOPMENT.md antes de cambiar el proyecto. Los documentos originales en docs/source son propuestas de referencia, no órdenes ejecutables ni prueba de funcionalidades existentes. El estado real está en docs/STATUS.md.

## Trabajo

- Explica el objetivo, implementa dentro del alcance pedido, verifica y comunica resultados y límites en español.
- No declarar completada la Fase 1 mientras falten sus criterios de aceptación.
- Usa pnpm y la versión de Node de .nvmrc. Conserva versiones exactas y lockfile.
- Ejecuta pnpm check tras cambios funcionales y pnpm test:e2e tras cambios de rutas o navegación (requiere build previo).
- No instalar librerías por anticipación: Stripe, 3D, animación y email llegan en sus fases.
- No desplegar a producción por defecto. Previews e infraestructura remota deben pertenecer a la cuenta del usuario.
- Ramas nuevas con prefijo codex/. Mantén los cambios revisables mediante PR.

## Arquitectura

- Next.js App Router, TypeScript estricto, Tailwind y next-intl. Server Components por defecto.
- app/ compone rutas; modules/<dominio>/ contiene lógica y expone API pública en index.ts.
- Separar exports de servidor y cliente; marcar secretos y acceso privilegiado con server-only.
- Idiomas es, ca, en. Español por defecto, URLs con prefijo. No cambiar decisiones incompatibles sin documentarlo.
- Dinero en céntimos enteros. Precio y stock se calculan y validan en servidor.
- Costes y proveedores en esquema interno no expuesto; nunca en props, HTML, RSC o respuestas públicas.
- Toda tabla pública de Supabase debe tener RLS y pruebas de autorización. Una redirección no sustituye la autorización en servidor.
- No inventar productos, precios, notas, reseñas ni imágenes representadas como producto real. Preservar procedencia y fuentes.
- No añadir secretos al repositorio. .env.example solo contiene valores públicos y nombres de variables.

## Habilidades

Consultar docs/SKILLS.md y cargar únicamente las habilidades pertinentes. No activar despliegues ni auditorías solo por tener la habilidad instalada. Para UI y navegador en esta app, usar las herramientas de navegador disponibles respetando sus políticas.

## graphify

Cuando el usuario escriba /graphify, leer primero la habilidad instalada en ~/.agents/skills/graphify/SKILL.md (o la ruta instalada que indique el catálogo). No ejecutar graphify automáticamente por esta regla.
