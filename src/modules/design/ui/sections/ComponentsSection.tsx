import { Eyebrow, Heading, Text } from '@/components/ui';
import type { HeadingSize, TextSize, TextTone } from '@/components/ui';
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

/** Las que añaden las tareas siguientes del plan de la Fase 2. */
const UPCOMING = [
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
