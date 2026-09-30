# Desarrollo con Codex

## Bloques siguientes

1. Repositorio privado conectado. Verificar CI real. Configurar protección de main cuando exista un primer run válido.
2. Consolidar arquitectura y decisiones de la Fase 1: idiomas, cuatro tipos de precio, costes internos y permisos. Los originales no se sobrescriben.
3. Preparar Supabase local con Docker y CLI versionada. Crear dev en región UE tras elegir organización. Escribir migraciones, seed solo de referencia, pgTAP y tipos generados. Probar denegación por defecto y aislamiento de costes.
4. Implementar sesión, invitación, roles y MFA del admin (fase A1 de docs/ADMIN_PLAN.md). La matriz de `src/modules/auth/domain/permissions.ts` es la fuente del seed de `role_permissions` y de la tabla de verdad pgTAP. Hace falta el email del primer owner. No pedir secretos por chat: configurar variables de entorno local o del proveedor.
5. Vercel ya está conectado al repositorio (producción desde `main`, previews por rama). Falta conectarlo al entorno dev para previews y separar producción cuando proceda. Verificar CI, base de datos y E2E completos.
6. Importar el catálogo real «CATALOGO global 2026» cuando esté en el repositorio o en el chat (pasarlo a CSV y usar Catálogo → Importar, con revisión previa): perfumes, formatos y PVP con su página como procedencia; imágenes del PDF como provisionales. Después, publicar.
7. Completar criterios de Fase 1 (docs/STATUS.md, «Pendiente técnico»); el sistema visual provisional ya existe (PR #6) y la Fase 2 lo formalizará.
8. Panel de administración: A0–A1 hechas; A2 (catálogo, PVP, costes y margen) y A3 (inventario, sin compras ni TPV) en versión base. Siguiente: proveedores y cambios masivos de precio, luego A4 (agente), A6 (mensajes) y A5 (pedidos) según docs/ADMIN_PLAN.md §7.

## Servicios y acceso que faltan

- GitHub: repositorio privado albertnieves/adhara-web conectado a Codex con lectura y escritura. Git local continúa sin autenticar; GitHub CLI no instalada. Las operaciones remotas se realizan mediante el conector.
- Docker: no encontrado; necesario para Supabase local y pgTAP en CI. Mientras tanto, pgTAP se ejecuta contra `adhara-dev` con `supabase/tests/tap_remote.py` (revierte todo).
- Supabase: proyecto `adhara-dev` (Frankfurt) accesible con el conector de Supabase de Claude Code. Faltan las cuentas del personal, la configuración de URLs y plantillas de Auth y el proyecto `adhara-prod`.
- Vercel: proyecto `adhara-web` conectado a GitHub. Funciones en París (cdg1), todos los despliegues protegidos con Vercel Authentication y variables públicas de `adhara-dev` configuradas. Separar producción cuando exista `adhara-prod`.
- Catálogo PDF: pendiente de subir (el usuario lo tiene en su equipo). Logotipo: provisional hasta la identidad definitiva.

## Flujo de trabajo

Una tarea concreta por rama codex/<tema>. Describir comportamiento y criterios antes de implementar. Hacer pruebas proporcionadas al cambio y reportar las ejecutadas. La CI inicial solo valida el arranque técnico; ampliar a auth, RLS, costes y migraciones al implementarlos. No marcar controles futuros como aprobados.
