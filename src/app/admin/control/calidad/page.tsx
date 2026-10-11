import type { Metadata } from 'next';
import Link from 'next/link';
import type { QualityIssue, QualitySeverity } from '@/modules/control/server';
import { listDataQuality, requireControl } from '@/modules/control/server';
import {
  ConsoleHeader,
  ConsoleSection,
  FilterLinks,
  KeyFigure,
} from '@/modules/control/ui';
import { Badge, Table } from '@/components/ui';
import type { BadgeTone } from '@/components/ui';

export const metadata: Metadata = { title: 'Calidad de datos' };

const SEVERITIES: Record<
  QualitySeverity,
  { label: string; tone: BadgeTone; note: string }
> = {
  alta: {
    label: 'Alta',
    tone: 'danger',
    note: 'Afecta a la tienda o a las cifras ahora',
  },
  media: {
    label: 'Media',
    tone: 'warning',
    note: 'Resta precisión al margen o al catálogo',
  },
  baja: { label: 'Baja', tone: 'neutral', note: 'Pendiente de completar' },
};

/** Qué comprueba cada regla y dónde se arregla. */
const CHECKS: Record<string, { title: string; fix: string }> = {
  variant_without_price: {
    title: 'Formatos publicados sin PVP',
    fix: 'Pon el PVP en la ficha o en Precios; sin él no se puede vender.',
  },
  product_without_image: {
    title: 'Perfumes publicados sin imagen',
    fix: 'Sube una foto en la ficha del perfume.',
  },
  stock_mismatch: {
    title: 'Existencias que no cuadran con los movimientos',
    fix: 'Revisa los movimientos del formato: las existencias deben ser su suma.',
  },
  variant_without_cost: {
    title: 'Formatos sin coste',
    fix: 'Registra el coste (recepción de compra o coste manual): sin él el margen sale alto.',
  },
  missing_translation: {
    title: 'Traducciones que faltan',
    fix: 'Completa el texto de la ficha en los idiomas que faltan.',
  },
  draft_with_stock: {
    title: 'Borradores con existencias',
    fix: 'Publica el perfume o mueve sus existencias: no se puede vender.',
  },
  duplicate_ean: {
    title: 'EAN repetidos',
    fix: 'Cada formato debe tener su propio EAN.',
  },
  provisional_image: {
    title: 'Imágenes principales provisionales',
    fix: 'Sustitúyela por una foto propia cuando la haya.',
  },
  product_without_scent: {
    title: 'Perfumes sin perfil olfativo',
    fix: 'Añade notas y familias desde la ficha (solo con fuente verificada).',
  },
  variant_without_sku: {
    title: 'Formatos sin SKU',
    fix: 'Pon el SKU en la ficha del formato.',
  },
  source_to_review: {
    title: 'Procedencia por revisar',
    fix: 'Comprueba la fuente y actualiza la procedencia (source_ref).',
  },
};

const ORDER: QualitySeverity[] = ['alta', 'media', 'baja'];

export default async function QualityPage({
  searchParams,
}: {
  searchParams: Promise<{ gravedad?: string }>;
}) {
  const { supabase } = await requireControl();
  const { gravedad } = await searchParams;
  const filter = ORDER.find((s) => s === gravedad) ?? null;
  const issues = await listDataQuality(supabase);

  const counts = Object.fromEntries(
    ORDER.map((s) => [s, issues.filter((i) => i.severity === s).length]),
  ) as Record<QualitySeverity, number>;
  const shown = filter ? issues.filter((i) => i.severity === filter) : issues;
  const groups = new Map<string, QualityIssue[]>();
  for (const issue of shown) {
    const list = groups.get(issue.check) ?? [];
    list.push(issue);
    groups.set(issue.check, list);
  }
  const products = new Set(issues.map((i) => i.productId).filter(Boolean));

  return (
    <main>
      <ConsoleHeader
        section="Sistema"
        title="Calidad de datos"
        description="Huecos del catálogo y del stock que restan precisión a las métricas o se ven en la tienda. Ningún dato se rellena solo: se completa con su fuente."
      >
        <FilterLinks
          label="Gravedad"
          options={[
            {
              href: '/admin/control/calidad',
              label: 'Todas',
              active: filter === null,
            },
            ...ORDER.map((s) => ({
              href: `/admin/control/calidad?gravedad=${s}`,
              label: `${SEVERITIES[s].label} (${counts[s]})`,
              active: filter === s,
            })),
          ]}
        />
      </ConsoleHeader>

      <div className="grid grid-cols-4 gap-3">
        {ORDER.map((s) => (
          <KeyFigure
            key={s}
            label={`Gravedad ${SEVERITIES[s].label.toLowerCase()}`}
            value={counts[s]}
            tone={s === 'alta' && counts[s] > 0 ? 'alert' : 'default'}
            note={SEVERITIES[s].note}
            href={`/admin/control/calidad?gravedad=${s}`}
          />
        ))}
        <KeyFigure
          label="Perfumes afectados"
          value={products.size}
          note={`${issues.length} incidencias en total`}
        />
      </div>

      {shown.length === 0 ? (
        <p className="text-fg-muted border-border mt-10 border-y py-10 text-center text-sm">
          {issues.length === 0
            ? 'No hay incidencias: el catálogo y el stock cuadran.'
            : 'No hay incidencias con esta gravedad.'}
        </p>
      ) : (
        [...groups.entries()].map(([check, list]) => {
          const info = CHECKS[check] ?? { title: check, fix: '' };
          const severity = SEVERITIES[list[0]!.severity];
          return (
            <ConsoleSection
              key={check}
              id={`regla-${check}`}
              title={`${info.title} (${list.length})`}
              action={<Badge tone={severity.tone}>{severity.label}</Badge>}
            >
              {info.fix && (
                <p className="text-fg-muted -mt-1 mb-3 text-xs">{info.fix}</p>
              )}
              <Table caption={info.title} stacked={false} density="compact">
                <thead>
                  <tr>
                    <th className="w-1/2">Perfume o formato</th>
                    <th>Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((issue) => (
                    <tr
                      key={`${issue.productId}-${issue.variantId}-${issue.detail}`}
                    >
                      <td>
                        {issue.productId ? (
                          <Link
                            href={`/admin/catalogo/${issue.productId}`}
                            className="hover:text-accent-fg underline-offset-4 hover:underline"
                          >
                            {issue.label}
                          </Link>
                        ) : (
                          issue.label
                        )}
                      </td>
                      <td className="text-fg-muted">{issue.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </ConsoleSection>
          );
        })
      )}
    </main>
  );
}
