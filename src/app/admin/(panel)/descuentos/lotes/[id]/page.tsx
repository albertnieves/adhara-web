import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { Badge, Card, Eyebrow, buttonClass } from '@/components/ui';
import type { BadgeTone } from '@/components/ui';
import { formatEuros } from '@/lib/money';
import { PageHeader } from '@/modules/admin';
import { isAllowed } from '@/modules/auth';
import { requirePermission } from '@/modules/auth/server';
import { checkoutEnabled } from '@/modules/checkout/server';
import type { DiscountBatchStatus } from '@/modules/promotions';
import { discountBatchStatus, formatDiscountValue } from '@/modules/promotions';
import { getDiscountBatch } from '@/modules/promotions/server';
import { DiscountBatchToggle } from '@/modules/promotions/ui';

export const metadata: Metadata = { title: 'Lote de códigos únicos' };

const DATE = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Madrid',
});

const STATUS: Record<DiscountBatchStatus, { label: string; tone: BadgeTone }> =
  {
    active: { label: 'Activo', tone: 'success' },
    scheduled: { label: 'Programado', tone: 'accent' },
    expired: { label: 'Caducado', tone: 'neutral' },
    exhausted: { label: 'Todos usados', tone: 'warning' },
    inactive: { label: 'Apagado', tone: 'neutral' },
  };

/**
 * Ficha de un lote de códigos únicos (DECISIONS §185): condiciones, usos,
 * CSV para Sender y apagarlo o encenderlo entero.
 */
export default async function DiscountBatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ creado?: string }>;
}) {
  const staff = await requirePermission('promotions.manage');
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const batch = await getDiscountBatch(staff.supabase, id);
  if (!batch) notFound();
  const { creado } = await searchParams;
  const people = isAllowed({ role: staff.role, aal: 'aal2' }, 'customers.view');
  const status = STATUS[discountBatchStatus(batch)];
  const from = batch.startsAt ? DATE.format(new Date(batch.startsAt)) : null;
  const to = batch.endsAt ? DATE.format(new Date(batch.endsAt)) : null;

  return (
    <main>
      <PageHeader eyebrow="Lote de códigos únicos" title={batch.name}>
        <Link href="/admin/descuentos" className={buttonClass('outline')}>
          Volver a los códigos
        </Link>
        {/* Descarga de un Route Handler: enlace normal, sin precarga. */}
        <a
          href={`/admin/descuentos/lotes/${batch.id}/exportar`}
          className={buttonClass('primary')}
        >
          Descargar CSV
        </a>
      </PageHeader>

      {creado && (
        <p role="status" className="text-success mb-8 text-sm">
          Lote creado: {batch.codes.toLocaleString('es-ES')}{' '}
          {batch.codes === 1 ? 'código' : 'códigos'}.
        </p>
      )}

      <dl className="mb-10 grid gap-6 text-sm sm:grid-cols-2 xl:grid-cols-4">
        <div>
          <Eyebrow as="dt">Estado</Eyebrow>
          <dd className="mt-2">
            <Badge tone={status.tone}>{status.label}</Badge>
          </dd>
        </div>
        <div>
          <Eyebrow as="dt">Descuento</Eyebrow>
          <dd className="mt-2">
            {formatDiscountValue(batch)}
            <span className="text-fg-muted block text-xs">
              {[
                'un pedido por código',
                batch.minItemsCents !== null &&
                  `mín. ${formatEuros(batch.minItemsCents, 'es')}`,
                batch.excludeSaleItems && 'sin rebajados',
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </dd>
        </div>
        <div>
          <Eyebrow as="dt">Vigencia</Eyebrow>
          <dd className="mt-2 tabular-nums">
            {from && to
              ? `Del ${from} al ${to}`
              : from
                ? `Desde el ${from}`
                : to
                  ? `Hasta el ${to}`
                  : 'Sin fechas'}
          </dd>
        </div>
        <div>
          <Eyebrow as="dt">Códigos</Eyebrow>
          <dd className="mt-2 tabular-nums">
            <span className="font-mono">{batch.prefix}-XXXXXXXX</span>
            <span className="block">
              {batch.codes.toLocaleString('es-ES')} ·{' '}
              {batch.audience === 'subscribers'
                ? 'uno por suscriptor'
                : 'sin destinatario'}
            </span>
          </dd>
        </div>
        <div>
          <Eyebrow as="dt">Usados</Eyebrow>
          <dd className="mt-2 tabular-nums">
            {batch.usedCodes.toLocaleString('es-ES')} de{' '}
            {batch.codes.toLocaleString('es-ES')}
          </dd>
        </div>
        <div>
          <Eyebrow as="dt">Pedidos cobrados</Eyebrow>
          <dd className="mt-2 tabular-nums">
            {batch.paidUses}
            {batch.paidDiscountCents > 0 &&
              ` · −${formatEuros(batch.paidDiscountCents, 'es')}`}
          </dd>
        </div>
        <div>
          <Eyebrow as="dt">Encendidos</Eyebrow>
          <dd className="mt-2 tabular-nums">
            {batch.activeCodes.toLocaleString('es-ES')} de{' '}
            {batch.codes.toLocaleString('es-ES')}
          </dd>
        </div>
        <div>
          <Eyebrow as="dt">Creado</Eyebrow>
          <dd className="mt-2 tabular-nums">
            {DATE.format(new Date(batch.createdAt))}
          </dd>
        </div>
      </dl>

      <Card className="mb-10">
        <div className="max-w-3xl space-y-3 text-sm leading-relaxed">
          {batch.audience === 'subscribers' ? (
            <>
              <p>
                <strong>Para enviarlos con Sender:</strong> descarga el CSV,
                añade en Sender un campo personalizado para el código e importa
                el archivo en tu lista uniendo la columna «codigo» con ese campo
                (los suscriptores se reconocen por su email). Después, pon ese
                campo en el correo con su etiqueta de personalización para que
                cada persona vea el suyo.
              </p>
              <p className="text-fg-muted">
                Cada descarga queda en la auditoría. Guarda el archivo solo el
                tiempo necesario: lleva datos personales.
              </p>
              {!people && (
                <p className="text-warning">
                  Sin el permiso de clientes, el CSV sale sin los emails.
                </p>
              )}
            </>
          ) : (
            <p>
              Descarga el CSV para imprimir o repartir los códigos. Cada uno
              vale para un solo pedido.
            </p>
          )}
          {!checkoutEnabled() && (
            <p className="text-warning">
              La compra online está apagada: los códigos se pueden preparar,
              pero nadie los puede usar hasta que se encienda.
            </p>
          )}
        </div>
      </Card>

      <DiscountBatchToggle id={batch.id} active={batch.activeCodes > 0} />
    </main>
  );
}
