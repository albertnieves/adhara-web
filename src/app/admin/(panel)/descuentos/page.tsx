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
import type {
  DiscountBatchStatus,
  DiscountCode,
  DiscountStatus,
  PromotionStatus,
} from '@/modules/promotions';
import {
  discountBatchStatus,
  discountStatus,
  formatDiscountValue,
  promotionStatus,
} from '@/modules/promotions';
import {
  listDiscountBatches,
  listDiscountCodes,
  listPromotions,
} from '@/modules/promotions/server';

export const metadata: Metadata = { title: 'Descuentos y promociones' };

const DATE = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Madrid',
});

const STATUS: Record<
  DiscountStatus | DiscountBatchStatus,
  { label: string; tone: BadgeTone }
> = {
  active: { label: 'Activo', tone: 'success' },
  scheduled: { label: 'Programado', tone: 'accent' },
  expired: { label: 'Caducado', tone: 'neutral' },
  exhausted: { label: 'Agotado', tone: 'warning' },
  inactive: { label: 'Apagado', tone: 'neutral' },
};

const PROMOTION_STATUS: Record<
  PromotionStatus,
  { label: string; tone: BadgeTone }
> = {
  active: { label: 'Activa', tone: 'success' },
  scheduled: { label: 'Programada', tone: 'accent' },
  expired: { label: 'Terminada', tone: 'neutral' },
  inactive: { label: 'Apagada', tone: 'neutral' },
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
function validity(code: Pick<DiscountCode, 'startsAt' | 'endsAt'>) {
  const from = code.startsAt ? DATE.format(new Date(code.startsAt)) : null;
  const to = code.endsAt ? DATE.format(new Date(code.endsAt)) : null;
  if (from && to) return `Del ${from} al ${to}`;
  if (from) return `Desde el ${from}`;
  if (to) return `Hasta el ${to}`;
  return 'Sin fechas';
}

/**
 * Descuentos de la tienda: promociones automáticas (DECISIONS §186), que la
 * tienda aplica sola desde un importe, y códigos para las campañas del club
 * (§149–152, lotes §185), que el cliente escribe en «Finalizar compra». No se
 * suman: cada pedido lleva el que más descuenta.
 */
export default async function DiscountCodes() {
  const { supabase } = await requirePermission('promotions.manage');
  const [promotions, codes, batches] = await Promise.all([
    listPromotions(supabase),
    listDiscountCodes(supabase),
    listDiscountBatches(supabase),
  ]);
  const checkout = checkoutEnabled();

  return (
    <main>
      <PageHeader eyebrow="Web" title="Descuentos y promociones">
        <Link
          href="/admin/descuentos/lotes/nuevo"
          className={buttonClass('outline')}
        >
          Nuevo lote de códigos únicos
        </Link>
        <Link href="/admin/descuentos/nuevo" className={buttonClass('outline')}>
          Nuevo código
        </Link>
        <Link
          href="/admin/descuentos/promociones/nueva"
          className={buttonClass()}
        >
          Nueva promoción
        </Link>
      </PageHeader>

      <Card className="mb-10">
        <div className="max-w-3xl space-y-3 text-sm leading-relaxed">
          <p>
            <strong className="font-semibold">Promociones:</strong> la tienda
            las aplica sola cuando los artículos llegan a un importe (por
            ejemplo, −10 % desde 100 €), con fechas y, si quieres, solo para una
            casa. La cesta avisa de cuánto falta para conseguirla.
          </p>
          <p>
            <strong className="font-semibold">Códigos:</strong> crea el código
            aquí y escríbelo en la campaña de Sender con sus condiciones:
            descuento, fechas, compra mínima y si es de un uso por email. El
            cliente lo escribe en «Finalizar compra» y la tienda lo comprueba
            antes de pagar y otra vez al crear el pedido.
          </p>
          <p className="text-fg-muted">
            No se suman: cada pedido lleva un solo descuento, el que más
            descuenta (si empatan, la promoción, y el código queda sin gastar).
            El descuento es sobre los artículos, nunca sobre el envío, y el
            envío gratis se calcula con el descuento ya aplicado. Un código
            compartido vale para quien lo tenga: limita los usos o las fechas si
            no debe circular, o crea un lote de códigos únicos (uno por
            suscriptor del Club, de un solo uso) para importarlo en Sender.
          </p>
          {!checkout && (
            <p className="text-warning">
              La compra online está apagada: las promociones y los códigos se
              pueden preparar, pero nadie los puede usar hasta que se encienda.
            </p>
          )}
        </div>
      </Card>

      <section aria-labelledby="promociones" className="mb-14">
        <h2 id="promociones" className="mb-6 text-2xl font-light">
          Promociones automáticas
        </h2>
        {promotions.length === 0 ? (
          <p className="text-fg-muted text-sm">
            Todavía no hay promociones. Una promoción descuenta sola desde un
            importe, sin que el cliente escriba nada.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table caption="Promociones automáticas" className="min-w-[56rem]">
              <thead>
                <tr>
                  <th>Promoción</th>
                  <th>Descuento</th>
                  <th>Vigencia</th>
                  <th className="text-right">Pedidos</th>
                  <th className="text-right">Cobrados</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {promotions.map((promotion) => {
                  const status = PROMOTION_STATUS[promotionStatus(promotion)];
                  return (
                    <tr key={promotion.id}>
                      <td>
                        <TextLink
                          href={`/admin/descuentos/promociones/${promotion.id}`}
                        >
                          {promotion.name}
                        </TextLink>
                      </td>
                      <td className="text-sm">
                        −{formatDiscountValue(promotion)} desde{' '}
                        {formatEuros(promotion.minItemsCents, 'es')}
                        <p className="text-fg-muted text-xs">
                          {[
                            promotion.brandName ?? 'todas las casas',
                            promotion.excludeSaleItems && 'sin rebajados',
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      </td>
                      <td className="text-sm tabular-nums">
                        {validity(promotion)}
                      </td>
                      <td className="text-right text-sm tabular-nums">
                        {promotion.uses}
                      </td>
                      <td className="text-right text-sm tabular-nums">
                        {promotion.paidUses}
                        {promotion.paidDiscountCents > 0 && (
                          <p className="text-fg-muted text-xs">
                            −{formatEuros(promotion.paidDiscountCents, 'es')}
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
      </section>

      <h2 id="codigos" className="mb-6 text-2xl font-light">
        Códigos de descuento
      </h2>
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

      <section
        aria-labelledby="lotes"
        className="border-border mt-14 border-t pt-10"
      >
        <h2 id="lotes" className="mb-6 text-2xl font-light">
          Lotes de códigos únicos
        </h2>
        {batches.length === 0 ? (
          <p className="text-fg-muted text-sm">
            Todavía no hay lotes. Un lote da un código distinto, de un solo uso,
            a cada suscriptor del Club o crea un número de ellos.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table caption="Lotes de códigos únicos" className="min-w-[56rem]">
              <thead>
                <tr>
                  <th>Lote</th>
                  <th>Descuento</th>
                  <th>Vigencia</th>
                  <th className="text-right">Usados</th>
                  <th className="text-right">Cobrados</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((batch) => {
                  const status = STATUS[discountBatchStatus(batch)];
                  return (
                    <tr key={batch.id}>
                      <td>
                        <TextLink href={`/admin/descuentos/lotes/${batch.id}`}>
                          {batch.name}
                        </TextLink>
                        <p className="text-fg-muted font-mono text-xs">
                          {batch.prefix}-XXXXXXXX ·{' '}
                          {batch.audience === 'subscribers'
                            ? 'Club'
                            : 'sin destinatario'}
                        </p>
                      </td>
                      <td className="text-sm">{formatDiscountValue(batch)}</td>
                      <td className="text-sm tabular-nums">
                        {validity(batch)}
                      </td>
                      <td className="text-right text-sm tabular-nums">
                        {batch.usedCodes} / {batch.codes}
                      </td>
                      <td className="text-right text-sm tabular-nums">
                        {batch.paidUses}
                        {batch.paidDiscountCents > 0 && (
                          <p className="text-fg-muted text-xs">
                            −{formatEuros(batch.paidDiscountCents, 'es')}
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
      </section>
    </main>
  );
}
