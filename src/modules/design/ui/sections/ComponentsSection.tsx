import {
  Eyebrow,
  Heading,
  ICON_NAMES,
  Icon,
  StarDivider,
  StarList,
  StarLoader,
  Text,
} from '@/components/ui';
import type {
  HeadingSize,
  IconSize,
  TextSize,
  TextTone,
} from '@/components/ui';
import { Section, SubTitle } from '../Section';

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

/** Las que añaden las tareas siguientes del plan de la Fase 2. */
const UPCOMING = [
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

/** Una fila de la demostración: muestra, uso y cómo se escribe. */
function Example({
  code,
  use,
  children,
}: {
  code: string;
  use: string;
  children: React.ReactNode;
}) {
  return (
    <li className="grid gap-3 py-5 md:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] md:items-center md:gap-8">
      <div className="min-w-0">{children}</div>
      <div className="flex flex-col gap-1">
        <code className="text-xs wrap-anywhere">{code}</code>
        <Text size="caption" tone="muted">
          {use}
        </Text>
      </div>
    </li>
  );
}

export function ComponentsSection() {
  return (
    <Section
      id="componentes"
      title="Componentes"
      intro="Primitivas de src/components/ui, las mismas para la tienda y el panel. Cada tarea del plan añade aquí las suyas con todos sus estados; su className solo coloca (márgenes), el aspecto lo fija el componente."
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
      <SubTitle>Próximas</SubTitle>
      <ul className="divide-border border-border divide-y border-y">
        {UPCOMING.map((item) => (
          <li
            key={item.task}
            className="flex flex-col gap-1 py-4 sm:flex-row sm:gap-6"
          >
            <Text as="span" size="small" tone="muted" className="w-16 shrink-0">
              {item.task}
            </Text>
            <Text as="span" size="small">
              {item.name}
            </Text>
          </li>
        ))}
      </ul>
    </Section>
  );
}
