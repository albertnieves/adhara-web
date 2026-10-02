import { ColorSection } from './sections/ColorSection';
import { ComponentsSection } from './sections/ComponentsSection';
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
      <ComponentsSection />
    </>
  );
}
