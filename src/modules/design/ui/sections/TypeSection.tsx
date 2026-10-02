import {
  FONT_TOKENS,
  TEXT_SIZE_TOKENS,
  TRACKING_TOKENS,
  TYPE_SCALE,
} from '../../domain/tokens';
import { Section, SubTitle, TokenList } from '../Section';
import { TokenValue } from '../TokenValue';

export function TypeSection() {
  return (
    <Section
      id="tipografia"
      title="Tipografía"
      intro="Cormorant Garamond para titulares y Manrope para el resto (D1). Ningún texto baja de 11 px. La escala se cierra en DS-04 con los componentes Heading, Text y Eyebrow."
    >
      <SubTitle>Familias</SubTitle>
      <TokenList
        tokens={FONT_TOKENS}
        sample={(token) => (
          <p
            className="text-4xl font-light"
            style={{ fontFamily: `var(${token.variable})` }}
          >
            Ámbar y oud
          </p>
        )}
      />
      <SubTitle>Tamaño mínimo</SubTitle>
      <TokenList
        tokens={TEXT_SIZE_TOKENS}
        sample={() => (
          <p className="text-2xs tracking-caps font-semibold uppercase">
            Eau de parfum · 100 ml
          </p>
        )}
      />
      <SubTitle>Tamaños en uso</SubTitle>
      <ul className="divide-border border-border divide-y border-y">
        {TYPE_SCALE.map((step) => (
          <li
            key={step.className}
            className="grid gap-3 py-5 lg:grid-cols-[minmax(0,12rem)_minmax(0,1fr)] lg:gap-8"
          >
            <div className="flex flex-col gap-1">
              <code className="text-sm">{step.className}</code>
              <span className="text-fg-muted flex flex-wrap gap-x-1 text-xs">
                <TokenValue variable={step.variable} />
                <span aria-hidden="true">/</span>
                <TokenValue variable={`${step.variable}--line-height`} />
              </span>
            </div>
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-8 gap-y-2">
              <p className={`${step.className} font-display font-light`}>
                Ámbar y oud
              </p>
              <p className={step.className}>Ámbar y oud</p>
            </div>
          </li>
        ))}
      </ul>
      <SubTitle>Versalitas</SubTitle>
      <TokenList
        tokens={TRACKING_TOKENS}
        sample={(token) => (
          <p
            className="text-xs font-semibold uppercase"
            style={{ letterSpacing: `var(${token.variable})` }}
          >
            Eau de parfum
          </p>
        )}
      />
    </Section>
  );
}
