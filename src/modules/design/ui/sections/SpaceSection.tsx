import { LAYOUT_TOKENS, RADIUS_TOKENS } from '../../domain/tokens';
import { Section, SubTitle, TokenList } from '../Section';
import { TokenValue } from '../TokenValue';

/** Pasos de la unidad de Tailwind que usan la tienda y el panel. */
const STEPS = [1, 2, 3, 4, 6, 8, 10, 12, 16, 20, 24];

const LINES = [
  {
    name: 'border',
    detail: '1 px. Separadores y bordes de tarjetas.',
    className: 'border-border border-t',
  },
  {
    name: 'border-strong',
    detail: '1 px. Bordes de controles (3:1).',
    className: 'border-border-strong border-t',
  },
  {
    name: 'focus',
    detail: '2 px con 3 px de separación (:focus-visible).',
    className: 'outline-focus outline-2 outline-offset-3',
  },
];

export function SpaceSection() {
  return (
    <Section
      id="espacio"
      title="Espacio, radios y líneas"
      intro="Los espaciados son múltiplos de la unidad de Tailwind. Las esquinas son rectas, con 2 px como único radio, y las líneas son de 1 px salvo el foco."
    >
      <SubTitle>Espaciado</SubTitle>
      <p className="mb-5 flex flex-wrap items-baseline gap-2 text-sm">
        Unidad <code className="text-sm">--spacing</code>
        <TokenValue variable="--spacing" />
      </p>
      <ul className="flex flex-col gap-2">
        {STEPS.map((step) => (
          <li
            key={step}
            className="grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-4"
          >
            <code className="text-xs">× {step}</code>
            <span
              aria-hidden="true"
              className="bg-accent block h-3"
              style={{ width: `calc(var(--spacing) * ${step})` }}
            />
          </li>
        ))}
      </ul>
      <SubTitle>Retícula</SubTitle>
      <TokenList tokens={LAYOUT_TOKENS} />
      <SubTitle>Radios</SubTitle>
      <TokenList
        tokens={RADIUS_TOKENS}
        sample={(token) => (
          <span className="flex gap-6">
            <span
              aria-hidden="true"
              className="bg-surface-sunken border-border-strong block size-16 border"
            />
            <span
              aria-hidden="true"
              className="bg-surface-sunken border-border-strong block size-16 border"
              style={{ borderRadius: `var(${token.variable})` }}
            />
          </span>
        )}
      />
      <SubTitle>Líneas</SubTitle>
      <dl className="divide-border border-border divide-y border-y">
        {LINES.map((line) => (
          <div
            key={line.name}
            className="grid gap-3 py-5 md:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] md:items-center md:gap-8"
          >
            <dt className="flex flex-col gap-1">
              <code className="text-sm">{line.name}</code>
              <span className="text-fg-muted text-xs">{line.detail}</span>
            </dt>
            <dd>
              <span
                aria-hidden="true"
                className={`block h-6 max-w-sm ${line.className}`}
              />
            </dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}
