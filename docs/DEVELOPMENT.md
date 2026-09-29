# Desarrollo con Codex

## Bloques siguientes

1. Repositorio privado conectado. Verificar CI real. Configurar protección de main cuando exista un primer run válido.
2. Consolidar arquitectura y decisiones de la Fase 1: idiomas, cuatro tipos de precio, costes internos y permisos. Los originales no se sobrescriben.
3. Preparar Supabase local con Docker y CLI versionada. Crear dev en región UE tras elegir organización. Escribir migraciones, seed solo de referencia, pgTAP y tipos generados. Probar denegación por defecto y aislamiento de costes.
4. Implementar sesión, invitación, roles y MFA del admin. Hace falta el email del primer owner. No pedir secretos por chat: configurar variables de entorno local o del proveedor.
5. Vercel ya está conectado al repositorio (producción desde `main`, previews por rama). Falta conectarlo al entorno dev para previews y separar producción cuando proceda. Verificar CI, base de datos y E2E completos.
6. Completar criterios de Fase 1; después Design System e importación del catálogo real.

## Servicios y acceso que faltan

- GitHub: repositorio privado albertnieves/adhara-web conectado a Codex con lectura y escritura. Git local continúa sin autenticar; GitHub CLI no instalada. Las operaciones remotas se realizan mediante el conector.
- Docker: no encontrado; necesario para Supabase local y pgTAP.
- Supabase: organización, proyecto dev en región UE y configuración. No hay conector Supabase disponible en las herramientas de esta sesión, aunque el documento original lo afirma.
- Vercel: proyecto `adhara-web` conectado a GitHub. Funciones en París (cdg1) y todos los despliegues protegidos con Vercel Authentication. Falta configurar variables por entorno cuando exista Supabase.
- Catálogo PDF y logo: mencionados por la arquitectura, pero no recibidos en esta carpeta. Necesarios en las fases correspondientes.

## Flujo de trabajo

Una tarea concreta por rama codex/<tema>. Describir comportamiento y criterios antes de implementar. Hacer pruebas proporcionadas al cambio y reportar las ejecutadas. La CI inicial solo valida el arranque técnico; ampliar a auth, RLS, costes y migraciones al implementarlos. No marcar controles futuros como aprobados.
