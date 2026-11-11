import { z } from 'zod';
import type { BasisPoints, Cents } from '@/lib/money';
import { formatEuros, parseEuros } from '@/lib/money';

/*
 * Códigos de descuento para las campañas del club (DECISIONS §149–152). La
 * base es la única que calcula el descuento (web_order_create); aquí solo hay
 * lo que comparten la tienda y el panel: el formato del código, los motivos
 * de rechazo, el estado para el panel y el formulario de alta.
 */

export const DISCOUNT_KINDS = ['percent', 'amount'] as const;
export type DiscountKind = (typeof DISCOUNT_KINDS)[number];

/** Igual que la restricción de discount_codes.code (en mayúsculas). */
export const DISCOUNT_CODE_PATTERN = /^[A-Z0-9]+(-[A-Z0-9]+)*$/;
export const DISCOUNT_CODE_MIN = 4;
export const DISCOUNT_CODE_MAX = 30;

/** «  club10 » → «CLUB10»; null si no puede ser un código. */
export function normalizeDiscountCode(input: string): string | null {
  const code = input.trim().toUpperCase();
  return code.length >= DISCOUNT_CODE_MIN &&
    code.length <= DISCOUNT_CODE_MAX &&
    DISCOUNT_CODE_PATTERN.test(code)
    ? code
    : null;
}

/** Motivos por los que la tienda no aplica un código (messages → checkout.discount.errors). */
export const DISCOUNT_ERRORS = [
  'invalid',
  'notStarted',
  'expired',
  'exhausted',
  'minimum',
  'notApplicable',
  'used',
  'busy',
  'generic',
] as const;
export type DiscountError = (typeof DISCOUNT_ERRORS)[number];

const DB_DISCOUNT_ERRORS: Record<string, DiscountError> = {
  discount_invalid: 'invalid',
  discount_not_started: 'notStarted',
  discount_expired: 'expired',
  discount_exhausted: 'exhausted',
  discount_minimum: 'minimum',
  discount_not_applicable: 'notApplicable',
  discount_used: 'used',
};

/** Error de la base → motivo para la tienda; null si no es de un código. */
export function discountErrorFromDb(message: string): DiscountError | null {
  return DB_DISCOUNT_ERRORS[message] ?? null;
}

/** Código aplicado en «Finalizar compra», tal y como lo calculó la base. */
export type AppliedDiscount = {
  code: string;
  discountCents: Cents;
  excludesSaleItems: boolean;
};

export type DiscountQuote =
  | ({ status: 'applied' } & AppliedDiscount)
  | { status: 'error'; error: DiscountError; minimumCents?: Cents };

/** 1000 pb → «10 %»; 1250 → «12,5 %» (en: «12.5%»). */
export function formatPercent(bp: BasisPoints, locale: string): string {
  return new Intl.NumberFormat(locale === 'en' ? 'en-GB' : `${locale}-ES`, {
    style: 'percent',
    maximumFractionDigits: 2,
  }).format(bp / 10_000);
}

export function formatDiscountValue(
  code: {
    kind: DiscountKind;
    percentBp: BasisPoints | null;
    amountCents: Cents | null;
  },
  locale = 'es',
): string {
  return code.kind === 'percent'
    ? formatPercent(code.percentBp ?? 0, locale)
    : formatEuros(code.amountCents ?? 0, locale);
}

/** Un código del panel con sus usos (admin_list_discount_codes). */
export type DiscountCode = {
  id: string;
  code: string;
  description: string | null;
  kind: DiscountKind;
  percentBp: BasisPoints | null;
  amountCents: Cents | null;
  minItemsCents: Cents | null;
  startsAt: string | null;
  endsAt: string | null;
  maxUses: number | null;
  oncePerEmail: boolean;
  excludeSaleItems: boolean;
  active: boolean;
  createdAt: string;
  /** Usos que cuentan para los límites: pedidos vivos o cobrados. */
  uses: number;
  paidUses: number;
  paidDiscountCents: Cents;
};

export type DiscountStatus =
  'active' | 'scheduled' | 'expired' | 'exhausted' | 'inactive';

/** Estado del código para el panel, en este momento. */
export function discountStatus(
  code: Pick<
    DiscountCode,
    'active' | 'startsAt' | 'endsAt' | 'maxUses' | 'uses'
  >,
  now: Date = new Date(),
): DiscountStatus {
  if (!code.active) return 'inactive';
  if (code.endsAt && new Date(code.endsAt) <= now) return 'expired';
  if (code.maxUses !== null && code.uses >= code.maxUses) return 'exhausted';
  if (code.startsAt && new Date(code.startsAt) > now) return 'scheduled';
  return 'active';
}

/*
 * Formulario del panel. Fechas en hora de Madrid («2026-11-01T09:00» de un
 * <input type="datetime-local">); el porcentaje admite dos decimales.
 */

const PERCENT_PATTERN = /^(\d{1,2})(?:[.,](\d{1,2}))?$/;

/** «10» → 1000 pb; «12,5» → 1250. null si no es un porcentaje. */
export function parsePercent(input: string): BasisPoints | null {
  const match = PERCENT_PATTERN.exec(input.replace(/%/g, '').trim());
  if (!match) return null;
  const [, whole = '0', decimals = ''] = match;
  return Number(whole) * 100 + Number(decimals.padEnd(2, '0'));
}

/** Diferencia de Madrid con UTC en ese instante, en minutos. */
function madridOffsetMinutes(utc: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    timeZoneName: 'shortOffset',
  })
    .formatToParts(utc)
    .find((part) => part.type === 'timeZoneName')?.value;
  const match = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(parts ?? '');
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3] ?? 0);
  return match[1] === '-' ? -minutes : minutes;
}

/** «2026-11-01T09:00» en hora de Madrid → ISO en UTC; null si no es una fecha. */
export function madridLocalToIso(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, y, mo, d, h, mi] = match.map(Number) as number[];
  const naive = Date.UTC(y!, mo! - 1, d!, h!, mi!);
  if (Number.isNaN(naive)) return null;
  // Primera aproximación con el desfase de ese instante; se corrige una vez
  // por si el cambio de hora cae entre medias.
  let utc = naive - madridOffsetMinutes(new Date(naive)) * 60_000;
  utc = naive - madridOffsetMinutes(new Date(utc)) * 60_000;
  return new Date(utc).toISOString();
}

/** ISO → «2026-11-01T09:00» en hora de Madrid, para rellenar el formulario. */
export function isoToMadridLocal(iso: string | null): string {
  if (!iso) return '';
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Madrid',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(iso))
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null);

const optionalDate = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (!value) return null;
    const iso = madridLocalToIso(value);
    if (!iso) {
      ctx.addIssue({ code: 'custom', message: 'Fecha no válida.' });
      return z.NEVER;
    }
    return iso;
  });

/** Datos del formulario de alta o cambio, ya en céntimos, puntos básicos e ISO. */
export const discountCodeInput = z
  .object({
    id: z.union([z.uuid(), z.literal('').transform(() => null)]),
    code: z.string().transform((value, ctx) => {
      const code = normalizeDiscountCode(value);
      if (!code) {
        ctx.addIssue({
          code: 'custom',
          message: `De ${DISCOUNT_CODE_MIN} a ${DISCOUNT_CODE_MAX} letras o números, con guiones entre medias (sin espacios ni tildes).`,
        });
        return z.NEVER;
      }
      return code;
    }),
    description: optionalText(200),
    kind: z.enum(DISCOUNT_KINDS),
    value: z.string().trim(),
    minItems: z.string().trim(),
    startsAt: optionalDate,
    endsAt: optionalDate,
    maxUses: z.string().trim(),
    oncePerEmail: z.boolean(),
    excludeSaleItems: z.boolean(),
    active: z.boolean(),
  })
  .transform((input, ctx) => {
    const issue = (path: string, message: string) => {
      ctx.addIssue({ code: 'custom', path: [path], message });
      return z.NEVER;
    };
    let percentBp: BasisPoints | null = null;
    let amountCents: Cents | null = null;
    if (input.kind === 'percent') {
      percentBp = parsePercent(input.value);
      if (percentBp === null || percentBp < 100 || percentBp > 9000)
        return issue('value', 'Entre el 1 % y el 90 %.');
    } else {
      amountCents = parseEuros(input.value);
      if (amountCents === null || amountCents < 100 || amountCents > 100_000)
        return issue('value', 'Entre 1 € y 1.000 €.');
    }
    let minItemsCents: Cents | null = null;
    if (input.minItems) {
      minItemsCents = parseEuros(input.minItems);
      if (minItemsCents === null || minItemsCents < 1)
        return issue('minItems', 'Escribe un importe, por ejemplo 50 o 49,90.');
    }
    let maxUses: number | null = null;
    if (input.maxUses) {
      maxUses = Number(input.maxUses);
      if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 1_000_000)
        return issue('maxUses', 'Un número entero a partir de 1.');
    }
    if (
      input.startsAt &&
      input.endsAt &&
      new Date(input.endsAt) <= new Date(input.startsAt)
    )
      return issue('endsAt', 'El final tiene que ir después del inicio.');
    return {
      id: input.id,
      code: input.code,
      description: input.description,
      kind: input.kind,
      percentBp,
      amountCents,
      minItemsCents,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      maxUses,
      oncePerEmail: input.oncePerEmail,
      excludeSaleItems: input.excludeSaleItems,
      active: input.active,
    };
  });
export type DiscountCodeInput = z.infer<typeof discountCodeInput>;

/*
 * Lotes de códigos únicos (DECISIONS §185): códigos normales de un solo uso
 * con las mismas condiciones, uno para cada suscriptor activo del Club (para
 * importarlos en Sender) o un número fijo. Los crea la base
 * (admin_create_discount_batch); aquí, el formulario y el CSV.
 */

export const DISCOUNT_BATCH_AUDIENCES = ['subscribers', 'count'] as const;
export type DiscountBatchAudience = (typeof DISCOUNT_BATCH_AUDIENCES)[number];
export const DISCOUNT_BATCH_MAX = 5000;
export const DISCOUNT_BATCH_PREFIX = /^[A-Z0-9]{2,10}$/;

/** Un lote del panel con sus usos (admin_list_discount_batches). */
export type DiscountBatch = {
  id: string;
  name: string;
  prefix: string;
  audience: DiscountBatchAudience;
  createdAt: string;
  kind: DiscountKind;
  percentBp: BasisPoints | null;
  amountCents: Cents | null;
  minItemsCents: Cents | null;
  startsAt: string | null;
  endsAt: string | null;
  excludeSaleItems: boolean;
  codes: number;
  activeCodes: number;
  /** Códigos con un pedido vivo o cobrado. */
  usedCodes: number;
  paidUses: number;
  paidDiscountCents: Cents;
};

export type DiscountBatchStatus =
  'active' | 'scheduled' | 'expired' | 'exhausted' | 'inactive';

/** Estado del lote: apagado si no queda ningún código encendido. */
export function discountBatchStatus(
  batch: Pick<
    DiscountBatch,
    'activeCodes' | 'codes' | 'usedCodes' | 'startsAt' | 'endsAt'
  >,
  now: Date = new Date(),
): DiscountBatchStatus {
  if (batch.activeCodes === 0) return 'inactive';
  if (batch.endsAt && new Date(batch.endsAt) <= now) return 'expired';
  if (batch.usedCodes >= batch.codes) return 'exhausted';
  if (batch.startsAt && new Date(batch.startsAt) > now) return 'scheduled';
  return 'active';
}

/** Datos del formulario del lote, ya en céntimos, puntos básicos e ISO. */
export const discountBatchInput = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Ponle un nombre a la campaña.')
      .max(120, 'Como mucho 120 caracteres.'),
    prefix: z
      .string()
      .trim()
      .transform((value) => value.toUpperCase())
      .refine((value) => DISCOUNT_BATCH_PREFIX.test(value), {
        message: 'De 2 a 10 letras o números, sin guiones ni espacios.',
      }),
    kind: z.enum(DISCOUNT_KINDS),
    value: z.string().trim(),
    minItems: z.string().trim(),
    startsAt: optionalDate,
    endsAt: optionalDate,
    excludeSaleItems: z.boolean(),
    audience: z.enum(DISCOUNT_BATCH_AUDIENCES),
    count: z.string().trim(),
  })
  .transform((input, ctx) => {
    const issue = (path: string, message: string) => {
      ctx.addIssue({ code: 'custom', path: [path], message });
      return z.NEVER;
    };
    let percentBp: BasisPoints | null = null;
    let amountCents: Cents | null = null;
    if (input.kind === 'percent') {
      percentBp = parsePercent(input.value);
      if (percentBp === null || percentBp < 100 || percentBp > 9000)
        return issue('value', 'Entre el 1 % y el 90 %.');
    } else {
      amountCents = parseEuros(input.value);
      if (amountCents === null || amountCents < 100 || amountCents > 100_000)
        return issue('value', 'Entre 1 € y 1.000 €.');
    }
    let minItemsCents: Cents | null = null;
    if (input.minItems) {
      minItemsCents = parseEuros(input.minItems);
      if (minItemsCents === null || minItemsCents < 1)
        return issue('minItems', 'Escribe un importe, por ejemplo 50 o 49,90.');
    }
    if (
      input.startsAt &&
      input.endsAt &&
      new Date(input.endsAt) <= new Date(input.startsAt)
    )
      return issue('endsAt', 'El final tiene que ir después del inicio.');
    let count: number | null = null;
    if (input.audience === 'count') {
      count = Number(input.count);
      if (!Number.isInteger(count) || count < 1 || count > DISCOUNT_BATCH_MAX)
        return issue(
          'count',
          `Un número entero de 1 a ${DISCOUNT_BATCH_MAX.toLocaleString('es-ES')}.`,
        );
    }
    return {
      name: input.name,
      prefix: input.prefix,
      kind: input.kind,
      percentBp,
      amountCents,
      minItemsCents,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      excludeSaleItems: input.excludeSaleItems,
      audience: input.audience,
      count,
    };
  });
export type DiscountBatchInput = z.infer<typeof discountBatchInput>;

/** Una fila del CSV del lote (admin_discount_batch_codes). */
export type DiscountBatchCode = {
  code: string;
  /** null sin destinatario o sin permiso de clientes. */
  email: string | null;
  active: boolean;
  used: boolean;
};

/**
 * Filas del CSV para Sender: «email» y «codigo» (los dos campos que se
 * importan) y, para el equipo, si está usado o apagado.
 */
export function discountBatchCsvRows(codes: readonly DiscountBatchCode[]) {
  return [
    ['email', 'codigo', 'usado', 'activo'],
    ...codes.map((row) => [
      row.email ?? '',
      row.code,
      row.used ? 'sí' : 'no',
      row.active ? 'sí' : 'no',
    ]),
  ];
}

/** «codigos-club-2026-11-02.csv». */
export function discountBatchFileName(prefix: string, now: Date): string {
  return `codigos-${prefix.toLowerCase()}-${now.toISOString().slice(0, 10)}.csv`;
}

/*
 * Promociones automáticas (DECISIONS §186): un descuento sin código desde un
 * importe de artículos, con fechas y, si se quiere, de una sola casa. La base
 * calcula lo que cuenta y lo que descuenta (web_promotions_quote para la
 * tienda, web_order_create para el pedido); aquí, el formulario del panel, lo
 * que enseña la tienda y la regla con los códigos: no se suman, va el que más
 * descuenta y, si empatan, la promoción.
 */

/** Una promoción del panel con sus usos (admin_list_promotions). */
export type Promotion = {
  id: string;
  name: string;
  kind: DiscountKind;
  percentBp: BasisPoints | null;
  amountCents: Cents | null;
  minItemsCents: Cents;
  brandId: string | null;
  brandName: string | null;
  excludeSaleItems: boolean;
  startsAt: string | null;
  endsAt: string | null;
  active: boolean;
  createdAt: string;
  /** Pedidos vivos o cobrados con la promoción. */
  uses: number;
  paidUses: number;
  paidDiscountCents: Cents;
};

export type PromotionStatus = 'active' | 'scheduled' | 'expired' | 'inactive';

/** Estado de la promoción para el panel, en este momento. */
export function promotionStatus(
  promotion: Pick<Promotion, 'active' | 'startsAt' | 'endsAt'>,
  now: Date = new Date(),
): PromotionStatus {
  if (!promotion.active) return 'inactive';
  if (promotion.endsAt && new Date(promotion.endsAt) <= now) return 'expired';
  if (promotion.startsAt && new Date(promotion.startsAt) > now)
    return 'scheduled';
  return 'active';
}

/** «−10 % desde 100 € · Casa A · sin rebajados», para el panel. */
export function promotionSummary(
  promotion: Pick<
    Promotion,
    | 'kind'
    | 'percentBp'
    | 'amountCents'
    | 'minItemsCents'
    | 'brandName'
    | 'excludeSaleItems'
  >,
): string {
  return [
    `−${formatDiscountValue(promotion)} desde ${formatEuros(promotion.minItemsCents, 'es')}`,
    promotion.brandName ? `solo ${promotion.brandName}` : 'todas las casas',
    promotion.excludeSaleItems && 'sin rebajados',
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Datos del formulario de alta o cambio, ya en céntimos, puntos básicos e ISO. */
export const promotionInput = z
  .object({
    id: z.union([z.uuid(), z.literal('').transform(() => null)]),
    name: z
      .string()
      .trim()
      .min(1, 'Ponle un nombre (lo ve solo el equipo).')
      .max(80, 'Como mucho 80 caracteres.'),
    kind: z.enum(DISCOUNT_KINDS),
    value: z.string().trim(),
    minItems: z.string().trim(),
    brandId: z.union([z.uuid(), z.literal('').transform(() => null)]),
    excludeSaleItems: z.boolean(),
    startsAt: optionalDate,
    endsAt: optionalDate,
    active: z.boolean(),
  })
  .transform((input, ctx) => {
    const issue = (path: string, message: string) => {
      ctx.addIssue({ code: 'custom', path: [path], message });
      return z.NEVER;
    };
    let percentBp: BasisPoints | null = null;
    let amountCents: Cents | null = null;
    if (input.kind === 'percent') {
      percentBp = parsePercent(input.value);
      if (percentBp === null || percentBp < 100 || percentBp > 9000)
        return issue('value', 'Entre el 1 % y el 90 %.');
    } else {
      amountCents = parseEuros(input.value);
      if (amountCents === null || amountCents < 100 || amountCents > 100_000)
        return issue('value', 'Entre 1 € y 1.000 €.');
    }
    const minItemsCents = parseEuros(input.minItems);
    if (
      minItemsCents === null ||
      minItemsCents < 100 ||
      minItemsCents > 10_000_000
    )
      return issue(
        'minItems',
        'Escribe desde cuánto vale, por ejemplo 100 o 49,90 (mínimo 1 €).',
      );
    if (amountCents !== null && minItemsCents <= amountCents)
      return issue(
        'minItems',
        'El importe mínimo tiene que ser mayor que el descuento.',
      );
    if (
      input.startsAt &&
      input.endsAt &&
      new Date(input.endsAt) <= new Date(input.startsAt)
    )
      return issue('endsAt', 'El final tiene que ir después del inicio.');
    return {
      id: input.id,
      name: input.name,
      kind: input.kind,
      percentBp,
      amountCents,
      minItemsCents,
      brandId: input.brandId,
      excludeSaleItems: input.excludeSaleItems,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      active: input.active,
    };
  });
export type PromotionInput = z.infer<typeof promotionInput>;

/** Una promoción viva para una cesta, tal y como la calculó la base. */
export type PromotionOffer = {
  id: string;
  kind: DiscountKind;
  percentBp: BasisPoints | null;
  amountCents: Cents | null;
  minItemsCents: Cents;
  /** null: cuentan todas las casas. */
  brandName: string | null;
  excludeSaleItems: boolean;
  endsAt: string | null;
  /** Lo que cuenta de la cesta para llegar al mínimo. */
  eligibleCents: Cents;
  /** 0 si aún no llega al mínimo. */
  discountCents: Cents;
};

const offerRow = z.object({
  id: z.uuid(),
  kind: z.enum(DISCOUNT_KINDS),
  percent_bp: z.number().int().nullable(),
  amount_cents: z.number().int().nullable(),
  min_items_cents: z.number().int(),
  brand_name: z.string().nullable(),
  exclude_sale_items: z.boolean(),
  ends_at: z.string().nullable(),
  eligible_cents: z.number().int(),
  discount_cents: z.number().int(),
});

/** Respuesta de web_promotions_quote → promociones; [] si no se entiende. */
export function parsePromotionOffers(data: unknown): PromotionOffer[] {
  const parsed = z.array(offerRow).safeParse(data);
  if (!parsed.success) return [];
  return parsed.data.map((row) => ({
    id: row.id,
    kind: row.kind,
    percentBp: row.percent_bp,
    amountCents: row.amount_cents,
    minItemsCents: row.min_items_cents,
    brandName: row.brand_name,
    excludeSaleItems: row.exclude_sale_items,
    endsAt: row.ends_at,
    eligibleCents: row.eligible_cents,
    discountCents: row.discount_cents,
  }));
}

/** Lo que falta en artículos que cuentan para llegar al mínimo (0 si llega). */
export function missingCents(offer: PromotionOffer): Cents {
  return Math.max(offer.minItemsCents - offer.eligibleCents, 0);
}

/** La que más descuenta en esta cesta (empate: la primera), o null. */
export function bestOffer(
  offers: readonly PromotionOffer[],
): PromotionOffer | null {
  return offers.reduce<PromotionOffer | null>(
    (best, offer) =>
      offer.discountCents > 0 &&
      (!best || offer.discountCents > best.discountCents)
        ? offer
        : best,
    null,
  );
}

/**
 * La que aún no se alcanza con lo que menos falta, solo si en esta cesta
 * descontaría más que la que ya se aplica (para «te faltan…»); null si no hay.
 */
export function nextOffer(
  offers: readonly PromotionOffer[],
): PromotionOffer | null {
  const best = bestOffer(offers);
  return offers.reduce<PromotionOffer | null>((next, offer) => {
    if (offer.discountCents > 0 || offer.eligibleCents <= 0) return next;
    // Lo que descontaría justo al llegar al mínimo.
    const atMinimum =
      offer.kind === 'percent'
        ? Math.round((offer.minItemsCents * (offer.percentBp ?? 0)) / 10_000)
        : (offer.amountCents ?? 0);
    if (best && atMinimum <= best.discountCents) return next;
    return !next || missingCents(offer) < missingCents(next) ? offer : next;
  }, null);
}

/**
 * Qué descuento lleva el pedido: el código si descuenta más que la mejor
 * promoción; si empatan, la promoción (el código queda sin gastar). Igual que
 * web_order_create.
 */
export function chooseDiscount(
  code: AppliedDiscount | null,
  promotion: PromotionOffer | null,
):
  | { source: 'code'; discountCents: Cents }
  | { source: 'promotion'; discountCents: Cents }
  | { source: null; discountCents: 0 } {
  const promotionCents = promotion?.discountCents ?? 0;
  if (code && code.discountCents > promotionCents)
    return { source: 'code', discountCents: code.discountCents };
  if (promotion && promotionCents > 0)
    return { source: 'promotion', discountCents: promotionCents };
  return { source: null, discountCents: 0 };
}
