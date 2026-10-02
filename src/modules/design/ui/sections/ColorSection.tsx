import { PALETTE_COLORS, SEMANTIC_COLORS } from '../../domain/tokens';
import type { ColorToken } from '../../domain/tokens';
import { Section, SubTitle } from '../Section';
import { TokenValue } from '../TokenValue';

function Swatches({ colors }: { colors: readonly ColorToken[] }) {
  return (
    <ul className="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {colors.map((color) => (
        <li key={color.name} className="flex min-w-0 flex-col gap-2">
          <span
            aria-hidden="true"
            className="border-border block h-16 border"
            style={{ background: `var(--color-${color.name})` }}
          />
          <code className="text-sm">--color-{color.name}</code>
          <TokenValue variable={`--color-${color.name}`} />
          <p className="text-fg-muted text-sm">{color.role}</p>
        </li>
      ))}
    </ul>
  );
}

export function ColorSection() {
  return (
    <Section
      id="color"
      title="Color"
      intro="Dos capas: la paleta de marca define los semánticos, y los componentes usan solo los semánticos (bg-surface, text-fg-muted, border-border-strong…). Los valores son los que aplica el navegador."
    >
      <SubTitle>Semánticos (tono claro)</SubTitle>
      <Swatches colors={SEMANTIC_COLORS} />
      <SubTitle>Paleta de marca</SubTitle>
      <Swatches colors={PALETTE_COLORS} />
    </Section>
  );
}
