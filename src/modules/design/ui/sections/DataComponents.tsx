import {
  BADGE_TONES,
  Badge,
  Button,
  Card,
  EmptyState,
  Price,
  Skeleton,
  Table,
  Tag,
  Td,
  Text,
  Th,
} from '@/components/ui';
import type { BadgeTone } from '@/components/ui';
import { Example } from '../Example';
import { SubTitle } from '../Section';

/** Estados reales del dominio con su tono; los textos son los de la tienda. */
const STATES: { group: string; items: { label: string; tone: BadgeTone }[] }[] =
  [
    {
      group: 'Publicación',
      items: [
        { label: 'Borrador', tone: 'neutral' },
        { label: 'Publicado', tone: 'success' },
        { label: 'Archivado', tone: 'neutral' },
      ],
    },
    {
      group: 'Existencias',
      items: [
        { label: 'Disponible', tone: 'success' },
        { label: 'Últimas unidades', tone: 'warning' },
        { label: 'Agotado', tone: 'neutral' },
      ],
    },
    {
      group: 'Pedido',
      items: [
        { label: 'Pendiente de pago', tone: 'warning' },
        { label: 'Pagado', tone: 'accent' },
        { label: 'Listo para recoger', tone: 'accent' },
        { label: 'Completado', tone: 'success' },
        { label: 'Cancelado', tone: 'neutral' },
        { label: 'Requiere atención', tone: 'danger' },
      ],
    },
  ];

const LABELS = {
  es: { from: 'Desde', before: 'Antes' },
  ca: { from: 'Des de', before: 'Abans' },
  en: { from: 'From', before: 'Was' },
};

/** Filas de muestra: importes de ejemplo, sin productos inventados. */
const ROWS = [
  { name: 'Formato A', size: 50, stock: 12, tone: 'success' as const },
  { name: 'Formato B', size: 100, stock: 2, tone: 'warning' as const },
  { name: 'Formato C', size: 10, stock: 0, tone: 'neutral' as const },
];

/**
 * Datos y comercio (Fase 2, DS-09): estados, etiquetas, precio, tarjeta,
 * tabla, vacío y carga. Los importes son de ejemplo y no son de ningún
 * perfume.
 */
export function DataComponents() {
  return (
    <div id="datos" className="scroll-mt-8">
      <SubTitle>Badge y Tag</SubTitle>
      <Text size="small" tone="muted" className="mb-4 max-w-3xl">
        Badge es un estado (publicación, existencias, pedido) y el color
        acompaña siempre al texto. Tag es descriptivo (casa, concentración,
        público), sin significado de estado. StatusBadge del panel ya usa Badge.
      </Text>
      <ul className="divide-border border-border divide-y border-y">
        <Example code={'<Badge tone="…">'} use="Los cinco tonos.">
          <span className="flex flex-wrap gap-2">
            {BADGE_TONES.map((tone) => (
              <Badge key={tone} tone={tone}>
                {tone}
              </Badge>
            ))}
          </span>
        </Example>
        {STATES.map(({ group, items }) => (
          <Example
            key={group}
            code={'<Badge tone>'}
            use={`Estados de ${group.toLowerCase()}.`}
          >
            <span className="flex flex-wrap gap-2">
              {items.map(({ label, tone }) => (
                <Badge key={label} tone={tone}>
                  {label}
                </Badge>
              ))}
            </span>
          </Example>
        ))}
        <Example code={'<Tag>'} use="Etiquetas descriptivas.">
          <span className="flex flex-wrap gap-2">
            <Tag>Eau de Parfum</Tag>
            <Tag>Unisex</Tag>
            <Tag>Aceite perfumado</Tag>
          </span>
        </Example>
      </ul>

      <SubTitle>Price</SubTitle>
      <Text size="small" tone="muted" className="mb-4 max-w-3xl">
        PVP en el formato de cada idioma y con cifras tabulares. El precio
        anterior solo sale si es mayor (rebaja con la regla Ómnibus), tachado y
        con «antes» para el lector de pantalla.
      </Text>
      <ul className="divide-border border-border divide-y border-y">
        {(['es', 'ca', 'en'] as const).map((locale) => (
          <Example
            key={locale}
            code={`<Price locale="${locale}" compareAtCents from>`}
            use={`Idioma ${locale}: precio, rebaja y «desde».`}
          >
            <span className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
              <Price cents={4990} locale={locale} labels={LABELS[locale]} />
              <Price
                cents={3990}
                compareAtCents={4990}
                locale={locale}
                labels={LABELS[locale]}
              />
              <Price
                cents={2950}
                from
                locale={locale}
                labels={LABELS[locale]}
              />
            </span>
          </Example>
        ))}
        <Example code={'<Price size="lg">'} use="En la ficha del perfume.">
          <Price
            cents={12500}
            compareAtCents={14900}
            size="lg"
            locale="es"
            labels={LABELS.es}
          />
        </Example>
      </ul>

      <SubTitle>Card y Table</SubTitle>
      <Text size="small" tone="muted" className="mb-4 max-w-3xl">
        Card sustituye a .panel-card. En el móvil, cada fila de la tabla pasa a
        ficha: la celda principal encabeza y las demás llevan su etiqueta, sin
        desplazamiento horizontal.
      </Text>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <Text size="caption" tone="muted">
            Tarjeta
          </Text>
          <p className="font-display mt-2 text-3xl font-light">Contenido</p>
        </Card>
        <Card padding="sm" interactive>
          <Text size="small">
            Con interactive, el borde se marca al pasar el ratón.
          </Text>
        </Card>
      </div>
      <div className="mt-6">
        <Table caption="Formatos de ejemplo">
          <thead>
            <tr>
              <Th>Formato</Th>
              <Th numeric>ml</Th>
              <Th numeric>Stock</Th>
              <Th>Estado</Th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.name}>
                <Td primary>{row.name}</Td>
                <Td label="ml" numeric>
                  {row.size}
                </Td>
                <Td label="Stock" numeric>
                  {row.stock}
                </Td>
                <Td label="Estado">
                  <Badge tone={row.tone}>
                    {row.stock === 0
                      ? 'Agotado'
                      : row.stock < 5
                        ? 'Últimas unidades'
                        : 'Disponible'}
                  </Badge>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      <SubTitle>EmptyState y Skeleton</SubTitle>
      <div className="grid gap-6 lg:grid-cols-2">
        <EmptyState
          title="Todavía no hay pedidos"
          description="Cuando llegue el primero, aparecerá aquí."
          action={
            <Button variant="outline" size="sm" href="#datos">
              Volver arriba
            </Button>
          }
        />
        <Card>
          <div className="flex flex-col gap-3">
            <Skeleton className="w-24" />
            <Skeleton className="h-8 w-2/3" />
            <Skeleton />
            <Skeleton className="w-5/6" />
          </div>
          <Text size="caption" tone="muted" className="mt-4">
            Skeleton es decorativo: el contenedor anuncia la carga una vez. Con
            «reducir movimiento» no late.
          </Text>
        </Card>
      </div>
    </div>
  );
}
