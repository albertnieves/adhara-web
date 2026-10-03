import {
  BUTTON_SIZES,
  BUTTON_VARIANTS,
  Button,
  Eyebrow,
  Heading,
  ICON_NAMES,
  Icon,
  StarDivider,
  StarList,
  StarLoader,
  Text,
  TextLink,
} from '@/components/ui';
import type {
  ButtonSize,
  ButtonVariant,
  HeadingSize,
  IconSize,
  TextSize,
  TextTone,
} from '@/components/ui';
import { ButtonPlayground } from '../ButtonPlayground';
import { Example } from '../Example';
import { OverlayPlayground } from '../OverlayPlayground';
import { Section, SubTitle } from '../Section';
import { DataComponents } from './DataComponents';
import { FormComponents } from './FormComponents';

const HEADINGS: { size: HeadingSize; use: string }[] = [
  { size: 'display', use: 'Titular de la portada; crece con el ancho.' },
  { size: 'h1', use: 'Títulos de página de la tienda.' },
  {
    size: 'h2',
    use: 'Secciones de la tienda y títulos de página del panel.',
  },
  { size: 'h3', use: 'Secciones del panel y tarjetas.' },
  { size: 'h4', use: 'Subsecciones y títulos breves.' },
];

const TEXTS: { size: TextSize; use: string }[] = [
  { size: 'body', use: 'Párrafos de la tienda.' },
  { size: 'small', use: 'Texto del panel, formularios y tablas.' },
  { size: 'caption', use: 'Notas, ayudas y pies.' },
];

const TONES: TextTone[] = ['muted', 'accent', 'danger', 'success', 'warning'];

const ICON_SIZES: { size: IconSize; px: number }[] = [
  { size: 'sm', px: 16 },
  { size: 'md', px: 20 },
  { size: 'lg', px: 24 },
];

export function ComponentsSection() {
  return (
    <Section
      id="componentes"
      title="Componentes"
      intro="Primitivas de src/components/ui, las mismas para la tienda y el panel. Cada una con todos sus estados; su className solo coloca (márgenes), el aspecto lo fija el componente."
    >
      <SubTitle>Heading</SubTitle>
      <Text size="small" tone="muted" className="mb-4 max-w-3xl">
        El nivel (h1–h4) da la estructura y el tamaño, el aspecto: un título de
        página del panel es un h1 con tamaño h2. Sin nivel es un párrafo con
        aspecto de titular.
      </Text>
      <ul className="divide-border border-border divide-y border-y">
        {HEADINGS.map(({ size, use }) => (
          <Example
            key={size}
            code={`<Heading level={…} size="${size}">`}
            use={use}
          >
            <Heading size={size}>Ámbar y oud</Heading>
          </Example>
        ))}
      </ul>
      <SubTitle>Text</SubTitle>
      <ul className="divide-border border-border divide-y border-y">
        {TEXTS.map(({ size, use }) => (
          <Example key={size} code={`<Text size="${size}">`} use={use}>
            <Text size={size}>
              Texto de muestra para ver la medida, el interlineado y el
              contraste de cada tamaño.
            </Text>
          </Example>
        ))}
        <Example
          code={'<Text numeric>'}
          use="Cifras alineadas para precios, existencias y tablas."
        >
          <Text numeric>0123456789</Text>
          <Text numeric>1111111111</Text>
        </Example>
        <Example
          code={'<Text tone="muted | accent | danger | success | warning">'}
          use="Tonos semánticos: cumplen AA en el tono claro y en los oscuros."
        >
          <span className="flex flex-wrap gap-x-6 gap-y-2">
            {TONES.map((tone) => (
              <Text key={tone} as="span" size="small" tone={tone}>
                {tone}
              </Text>
            ))}
          </span>
        </Example>
      </ul>
      <SubTitle>Eyebrow</SubTitle>
      <ul className="divide-border border-border divide-y border-y">
        <Example
          code={'<Eyebrow>'}
          use="Antetítulo en versalitas sobre un título o una cifra."
        >
          <Eyebrow>Colección</Eyebrow>
        </Example>
        <Example
          code={'<Eyebrow tone="accent">'}
          use="En dorado de texto, para destacar."
        >
          <Eyebrow tone="accent">Novedad</Eyebrow>
        </Example>
      </ul>
      <SubTitle>Icon</SubTitle>
      <Text size="small" tone="muted" className="mb-4 max-w-3xl">
        Juego propio de trazo fino (D5): 1,5 px a cualquier tamaño y el color
        del texto. Sin label es decorativo (aria-hidden) y el nombre lo lleva el
        control; con label es una imagen con nombre.
      </Text>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
        {ICON_NAMES.map((name) => (
          <li
            key={name}
            className="border-border flex flex-col items-center gap-3 border px-2 py-5"
          >
            <Icon name={name} size="lg" />
            <code className="text-xs">{name}</code>
          </li>
        ))}
      </ul>
      <ul className="divide-border border-border mt-6 divide-y border-y">
        <Example
          code={'<Icon name="arrow" size="sm | md | lg">'}
          use="16, 20 y 24 px; md por defecto."
        >
          <span className="flex items-end gap-6">
            {ICON_SIZES.map(({ size, px }) => (
              <span key={size} className="flex flex-col items-center gap-2">
                <Icon name="arrow" size={size} />
                <Text as="span" size="caption" tone="muted">
                  {px} px
                </Text>
              </span>
            ))}
          </span>
        </Example>
        <Example
          code={'<Icon name="chevron" direction="left | up | down">'}
          use="Flechas y chevrones apuntan a la derecha salvo que se indique."
        >
          <span className="flex gap-6">
            <Icon name="chevron" direction="left" />
            <Icon name="chevron" direction="up" />
            <Icon name="chevron" />
            <Icon name="chevron" direction="down" />
          </span>
        </Example>
        <Example
          code={'<Icon name="alert" label="Atención">'}
          use="Con nombre propio cuando no hay texto al lado."
        >
          <span className="text-warning">
            <Icon name="alert" label="Atención" />
          </span>
        </Example>
      </ul>
      <SubTitle>Estrella</SubTitle>
      <ul className="divide-border border-border divide-y border-y">
        <Example code={'<StarList items={…}>'} use="Viñeta de listas cortas.">
          <StarList
            items={['Primera idea', 'Segunda idea', 'Tercera idea']}
            className="text-sm"
          />
        </Example>
        <Example code={'<StarDivider>'} use="Separador entre bloques.">
          <StarDivider />
        </Example>
        <Example
          code={'<StarLoader label="Cargando">'}
          use="Cargador: titila; quieta con «reducir movimiento»."
        >
          <StarLoader label="Cargando la demostración" />
        </Example>
      </ul>
      <SubTitle>Button</SubTitle>
      <Text size="small" tone="muted" className="mb-4 max-w-3xl">
        Cinco variantes con los semánticos, así que funcionan en todos los
        tonos. md y lg miden 44 y 48 px; sm (36 px) es para tablas y barras
        compactas. Con href es un enlace con aspecto de botón.
      </Text>
      <div id="acciones" className="flex scroll-mt-8 flex-col gap-6">
        {(Object.keys(BUTTON_VARIANTS) as ButtonVariant[]).map((variant) => (
          <div key={variant} className="flex flex-wrap items-center gap-3">
            <code className="w-20 shrink-0 text-xs">{variant}</code>
            {(Object.keys(BUTTON_SIZES) as ButtonSize[]).map((size) => (
              <Button key={size} variant={variant} size={size}>
                Añadir {size}
              </Button>
            ))}
          </div>
        ))}
      </div>
      <ul className="divide-border border-border mt-6 divide-y border-y">
        <Example
          code={'<Button loading loadingLabel="Enviando…">'}
          use="Carga: la estrella titila y el botón no responde."
        >
          <Button loading loadingLabel="Enviando…">
            Enviar
          </Button>
        </Example>
        <Example
          code={'<Button disabled>'}
          use="Deshabilitado: fuera del tabulador y atenuado."
        >
          <Button variant="outline" disabled>
            No disponible
          </Button>
        </Example>
        <Example
          code={'<SubmitButton pendingLabel="…">'}
          use="En formularios: toma el estado de envío del formulario."
        >
          <Text size="small" tone="muted">
            Es el que ya usa el panel en todos sus formularios.
          </Text>
        </Example>
      </ul>
      <SubTitle>Teclado</SubTitle>
      <Text size="small" tone="muted" className="mb-4 max-w-3xl">
        Tab recorre los botones en orden; Intro y Espacio los activan; el foco
        se ve con 2 px.
      </Text>
      <ButtonPlayground />
      <SubTitle>TextLink</SubTitle>
      <ul className="divide-border border-border divide-y border-y">
        <Example
          code={'<TextLink href="…">'}
          use="Enlace en el texto: el subrayado se dibuja al pasar o enfocar."
        >
          <Text size="small">
            Consulta la{' '}
            <TextLink href="#componentes">lista de componentes</TextLink>.
          </Text>
        </Example>
        <Example
          code={'<TextLink tone="muted">'}
          use="Atenuado, para pies y ayudas."
        >
          <TextLink href="#marca" tone="muted">
            Reglas de la marca
          </TextLink>
        </Example>
        <Example
          code={'<TextLink external newTabLabel="…">'}
          use="Abre otra pestaña y lo anuncia a los lectores de pantalla."
        >
          <TextLink href="/es" external>
            Tienda pública
          </TextLink>
        </Example>
      </ul>
      <FormComponents />
      <div id="superposiciones" className="scroll-mt-8">
        <SubTitle>Dialog, Sheet y Toast</SubTitle>
        <Text size="small" tone="muted" className="mb-4 max-w-3xl">
          Dialog y Sheet usan el dialog nativo: el resto de la página queda
          inerte, el foco no sale, Esc o tocar fuera cierran y el foco vuelve al
          botón que los abrió. useConfirm sustituye a window.confirm y empieza
          en «Cancelar». Los avisos de éxito se van solos a los 5 s; los errores
          se quedan hasta cerrarlos. Con «reducir movimiento» nada se desplaza.
        </Text>
        <OverlayPlayground />
      </div>
      <DataComponents />
    </Section>
  );
}
