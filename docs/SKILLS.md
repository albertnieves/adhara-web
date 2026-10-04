# Habilidades seleccionadas para ADHARA

Selección consultada el 28/09/2026 en los repositorios de sus autores. Se prefieren habilidades específicas del stack. No hay una habilidad universalmente «mejor»; esta selección responde a Next.js, Supabase, accesibilidad, seguridad y operación.

| Habilidad                        | Autor / fuente                                                                                         | Cuándo usarla                                                           |
| -------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| vercel-react-best-practices      | [Vercel](https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices)            | Componentes React, Next.js, carga de datos y rendimiento                |
| web-design-guidelines            | [Vercel](https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines)           | Revisión de interfaz, teclado, accesibilidad y UX                       |
| supabase-postgres-best-practices | [Supabase](https://github.com/supabase/agent-skills/tree/main/skills/supabase-postgres-best-practices) | Esquema, SQL, migraciones, índices y RLS                                |
| security-best-practices          | [OpenAI](https://github.com/openai/skills/tree/main/skills/.curated/security-best-practices)           | Auditoría solicitada de seguridad, especialmente antes de admin y pagos |
| gh-fix-ci                        | [OpenAI](https://github.com/openai/skills/tree/main/skills/.curated/gh-fix-ci)                         | Investigar fallos de GitHub Actions; requiere GitHub CLI autenticada    |
| vercel-deploy                    | [OpenAI](https://github.com/openai/skills/tree/main/skills/.curated/vercel-deploy)                     | Despliegue solicitado de previews en Vercel                             |

Instalación en el directorio de habilidades del usuario (~/.codex/skills); disponibilidad desde el siguiente turno de Codex. No se versionan copias de estas habilidades dentro del repo. Leer sus instrucciones al activarlas, no todas en cada tarea.

## Capacidades ya disponibles

- PDF: extracción e inspección del catálogo cuando se aporte.
- Imagegen: media editorial cuando se defina la dirección visual; nunca sustituir evidencia del producto.
- Graphify: análisis del proyecto al pedir /graphify. El grafo versionado está en `graphify-out/` (§105).
- Navegador integrado: inspección y revisión visual. Playwright como dependencia del repo ejecuta pruebas reproducibles locales y CI.

Se revisó la habilidad Playwright CLI de OpenAI, pero no se añadió: el navegador integrado y los tests del proyecto cubren el arranque y evitan duplicar herramientas. Los constructores de sitios alojados en otros servicios no se seleccionan porque el proyecto tiene arquitectura propia Next.js + Supabase + Vercel.

## Fuentes técnicas

- [Next.js Proxy](https://nextjs.org/docs/app/getting-started/proxy)
- [next-intl routing](https://next-intl.dev/docs/routing/setup)
- [Catálogo oficial de habilidades de OpenAI](https://github.com/openai/skills/tree/main/skills/.curated)
