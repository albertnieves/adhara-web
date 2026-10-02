import { TONES } from '../../domain/tokens';
import { Section } from '../Section';
import { ToneContrast } from '../ToneContrast';

/** Los semánticos de un tono en uso: texto, controles, foco y estados. */
function ToneSample() {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-4">
      <p className="font-display text-3xl font-light">Ámbar y oud</p>
      <p className="text-fg-muted text-sm">Texto secundario</p>
      <p className="text-accent-fg text-sm">Texto dorado</p>
      <span className="border-border-strong inline-flex min-h-11 items-center border px-4 text-sm">
        Borde de control
      </span>
      <span className="outline-focus inline-flex min-h-11 items-center px-4 text-sm outline-2 outline-offset-3">
        Foco
      </span>
      <p className="flex flex-wrap gap-x-4 text-sm">
        <span className="text-danger">Error</span>
        <span className="text-success">Confirmación</span>
        <span className="text-warning">Aviso</span>
      </p>
      <span aria-hidden="true" className="bg-accent block h-px w-16" />
    </div>
  );
}

export function ToneSection() {
  return (
    <Section
      id="tonos"
      title="Tonos y contraste"
      intro="Cada tono oscuro redefine los semánticos con data-tone. El contraste se calcula en el navegador con los colores de cada tono: texto 4,5:1; bordes de controles, foco y acento 3:1 (WCAG 2.2 AA). Es la misma matriz que comprueba la prueba unitaria."
    >
      <div className="flex flex-col gap-10">
        {TONES.map((tone) => (
          <section
            key={tone.id}
            aria-labelledby={`tono-${tone.id}`}
            data-tone={tone.id === 'light' ? undefined : tone.id}
            className="bg-surface text-fg border-border border p-5 sm:p-8"
          >
            <h3 id={`tono-${tone.id}`} className="text-3xl font-light">
              {tone.label}
            </h3>
            <p className="text-fg-muted mt-2 text-sm">{tone.use}</p>
            <ToneSample />
            <div className="mt-10">
              <ToneContrast tone={tone.id} />
            </div>
          </section>
        ))}
      </div>
    </Section>
  );
}
