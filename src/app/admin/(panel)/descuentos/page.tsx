import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Badge,
  Card,
  EmptyState,
  Table,
  TextLink,
  buttonClass,
} from '@/components/ui';
import type { BadgeTone } from '@/components/ui';
import { formatEuros } from '@/lib/money';
import { PageHeader } from '@/modules/admin';
import { requirePermission } from '@/modules/auth/server';
import { checkoutEnabled } from '@/modules/checkout/server';
import type { DiscountCode, DiscountStatus } from '@/modules/promotions';
import { discountStatus, formatDiscountValue } from '@/modules/promotions';
import { listDiscountCodes } from '@/modules/promotions/server';

export const metadata: Metadata = { title: 'Códigos de descuento' };

const DATE = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Madrid',
});

const STATUS: Record<DiscountStatus, { label: string; tone: BadgeTone }> = {
  active: { label: 'Activo', tone: 'success' },
  scheduled: { label: 'Programado', tone: 'accent' },
  expired: { label: 'Caducado', tone: 'neutral' },
  exhausted: { label: 'Agotado', tone: 'warning' },
  inactive: { label: 'Apagado', tone: 'neutral' },
};

/** «Mín. 50 € · un uso por email · sin rebajados». */
function conditions(code: DiscountCode) {
  return [
    code.minItemsCents !== null &&
      `mín. ${formatEuros(code.minItemsCents, 'es')}`,
    code.oncePerEmail && 'un uso por email',
    code.excludeSaleItems && 'sin rebajados',
  ]
    .filter(Boolean)
    .join(' · ');
}

/** «del 01/11 9:00 al 30/11 23:59», «hasta…», «desde…» o «sin fechas». */
function validity(code: DiscountCode) {
  const from = code.startsAt ? DATE.format(new Date(code.startsAt)) : null;
  const to = code.endsAt ? DATE.format(new Date(code.endsAt)) : null;
  if (from && to) return `Del ${from} al ${to}`;
  if (from) return `Desde el ${from}`;
  if (to) return `Hasta el ${to}`;
  return 'Sin fechas';
}

/**
 * Códigos de descuento para las campañas del club (DECISIONS §149–152):
 * se crean aquí, se ponen en el correo de Sender y la tienda los comprueba
 * en «Finalizar compra».
 */
export default async function DiscountCodes() {
  const { supabase } = await requirePermission('promotions.manage');
  const codes = await listDiscountCodes(supabase);
  const checkout = checkoutEnabled();

  return (
    <main>
      <PageHeader eyebrow="Web" title="Códigos de descuento">
        <Link href="/admin/descuentos/nuevo" className={buttonClass()}>
          Nuevo código
        </Link>
      </PageHeader>

      <Card className="mb-10">
        <div className="max-w-3xl space-y-3 text-sm leading-relaxed">
          <p>
            Crea el código aquí y escríbelo en la campaña de Sender con sus
            condiciones: descuento, fechas, compra mínima y si es de un uso por
            email. El cliente lo escribe en «Finalizar compra» y la tienda lo
            comprueba antes de pagar y otra vez al crear el pedido.
          </p>
          <p className="text-fg-muted">
            El descuento es sobre los artículos, nunca sobre el envío, y el
            envío gratis se calcula con el descuento ya aplicado. Un código por
            pedido. Un código compartido vale para quien lo tenga: limita los
            usos o las fechas si no debe circular.
          </p>
          {!checkout && (
            <p className="text-warning">
              La compra online está apagada: los códigos se pueden preparar,
              pero nadie los puede usar hasta que se encienda.
            </p>
          )}
        </div>
      </Card>

      {codes.length === 0 ? (
        <EmptyState title="Todavía no hay códigos de descuento." />
      ) : (
        <div className="overflow-x-auto">
          <Table caption="Códigos de descuento" className="min-w-[56rem]">
            <thead>
              <tr>
                <th>Código</th>
                <th>Descuento</th>
                <th>Vigencia</th>
                <th className="text-right">Usos</th>
                <th className="text-right">Cobrados</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {codes.map((code) => {
                const status = STATUS[discountStatus(code)];
                const rules = conditions(code);
                return (
                  <tr key={code.id}>
                    <td>
                      <TextLink
                        href={`/admin/descuentos/${code.id}`}
                        className="font-mono"
                      >
                        {code.code}
                      </TextLink>
                      {code.description && (
                        <p className="text-fg-muted text-xs">
                          {code.description}
                        </p>
                      )}
                    </td>
                    <td className="text-sm">
                      {formatDiscountValue(code)}
                      {rules && (
                        <p className="text-fg-muted text-xs">{rules}</p>
                      )}
                    </td>
                    <td className="text-sm tabular-nums">{validity(code)}</td>
                    <td className="text-right text-sm tabular-nums">
                      {code.uses}
                      {code.maxUses !== null && ` / ${code.maxUses}`}
                    </td>
                    <td className="text-right text-sm tabular-nums">
                      {code.paidUses}
                      {code.paidDiscountCents > 0 && (
                        <p className="text-fg-muted text-xs">
                          −{formatEuros(code.paidDiscountCents, 'es')}
                        </p>
                      )}
                    </td>
                    <td>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      )}
    </main>
  );
}
