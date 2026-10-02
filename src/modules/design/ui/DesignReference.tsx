import { Section } from './Section';
import { ColorSection } from './sections/ColorSection';
import { LayerSection, MotionSection } from './sections/MotionSection';
import { SpaceSection } from './sections/SpaceSection';
import { ToneSection } from './sections/ToneSection';
import { TypeSection } from './sections/TypeSection';

const CONTENTS = [
  { id: 'color', label: 'Color' },
  { id: 'tonos', label: 'Tonos y contraste' },
  { id: 'tipografia', label: 'Tipografía' },
  { id: 'espacio', label: 'Espacio, radios y líneas' },
  { id: 'movimiento', label: 'Movimiento' },
  { id: 'capas', label: 'Capas' },
  { id: 'componentes', label: 'Componentes' },
];

/** Componentes que añade cada tarea siguiente del plan de la Fase 2. */
const UPCOMING = [
  { task: 'DS-04', name: 'Tipografía: Heading, Text y Eyebrow' },
  { task: 'DS-05', name: 'Iconos y marca: Icon, Star y uso del logotipo' },
  { task: 'DS-06', name: 'Acciones: Button, TextLink y SubmitButton' },
  {
    task: 'DS-07',
    name: 'Formularios: Field, Input, Textarea, Select, Checkbox, Radio y SearchField',
  },
  { task: 'DS-08', name: 'Superposiciones y avisos: Dialog, Sheet y Toast' },
  {
    task: 'DS-09',
    name: 'Datos y comercio: Tag, Badge, Price, Table, Card, EmptyState y Skeleton',
  },
];

/**
 * Página de referencia del sistema de diseño (Fase 2, DS-03): los tokens de
 * globals.css con sus valores y su contraste calculados en el navegador.
 */
export function DesignReference() {
  return (
    <>
      <p className="max-w-3xl text-sm">
        Fuente única de los tokens de la tienda y el panel. Cada tarea de la
        Fase 2 añade aquí sus componentes con todos sus estados.
      </p>
      <nav aria-label="Secciones de la referencia" className="mt-6">
        <ul className="flex flex-wrap gap-x-6">
          {CONTENTS.map((item) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className="link-underline inline-flex min-h-11 items-center text-sm"
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <ColorSection />
      <ToneSection />
      <TypeSection />
      <SpaceSection />
      <MotionSection />
      <LayerSection />
      <Section
        id="componentes"
        title="Componentes"
        intro="Las primitivas de src/components/ui llegan con las tareas siguientes, cada una con su sección aquí."
      >
        <ul className="divide-border border-border divide-y border-y">
          {UPCOMING.map((item) => (
            <li
              key={item.task}
              className="flex flex-col gap-1 py-4 sm:flex-row sm:gap-6"
            >
              <span className="text-fg-muted w-16 shrink-0 text-sm">
                {item.task}
              </span>
              <span className="text-sm">{item.name}</span>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
