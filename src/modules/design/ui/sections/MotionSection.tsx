import {
  ANIMATION_TOKENS,
  DURATION_TOKENS,
  EASE_TOKENS,
  LAYER_TOKENS,
} from '../../domain/tokens';
import { MotionDemo } from '../MotionDemo';
import { Section, SubTitle, TokenList } from '../Section';

export function MotionSection() {
  return (
    <Section
      id="movimiento"
      title="Movimiento"
      intro="Lento y líquido (Fase 0 §13). Con «reducir movimiento» activado en el sistema, transiciones y animaciones se anulan (criterio 9)."
    >
      <SubTitle>Duraciones</SubTitle>
      <MotionDemo />
      <div className="mt-8">
        <TokenList tokens={DURATION_TOKENS} />
      </div>
      <SubTitle>Curva</SubTitle>
      <TokenList tokens={EASE_TOKENS} />
      <SubTitle>Animaciones</SubTitle>
      <TokenList tokens={ANIMATION_TOKENS} />
    </Section>
  );
}

export function LayerSection() {
  return (
    <Section
      id="capas"
      title="Capas"
      intro="Orden de apilamiento (z-index) de abajo arriba. Las pantallas los adoptan al migrar a las primitivas (DS-08, DS-10 y DS-11)."
    >
      <TokenList tokens={LAYER_TOKENS} />
    </Section>
  );
}
