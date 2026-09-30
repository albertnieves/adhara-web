'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { parseEuros } from '@/lib/money';
import type { ActionState } from '@/modules/admin';
import { describeDbError, fail, ok } from '@/modules/admin';
import { isAllowed } from '@/modules/auth';
import { requirePermission } from '@/modules/auth/server';
import type { PricePeriod, PriceIssue } from '@/modules/pricing';
import {
  PRICE_ISSUE_LABELS,
  PROVISIONAL_PRICING_POLICY,
  VAT_GENERAL_BP,
  hasBlockingIssues,
  missingConfirmations,
  reviewPriceChange,
} from '@/modules/pricing';
import { UNBOXING_SCENES } from '@/modules/unboxing';
import {
  AUDIENCES,
  CONCENTRATIONS,
  MEDIA_ORIGINS,
  PRODUCT_STATUSES,
  slugify,
} from '../domain/product';

/*
 * Acciones del catálogo. Cada una comprueba el permiso en servidor; RLS y los
 * triggers lo vuelven a comprobar en la base de datos (precio y publicación).
 */

const LOCALES = ['es', 'ca', 'en'] as const;

/** La tienda se regenera al cambiar el catálogo (home, colección y fichas). */
function refreshStorefront(productId?: string) {
  revalidatePath('/', 'layout');
  revalidatePath('/admin/catalogo');
  if (productId) revalidatePath(`/admin/catalogo/${productId}`);
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null);

const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .string()
    .transform((value) => value || null)
    .pipe(z.enum(values).nullable());

const productFields = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio.').max(120),
  brandId: z.string().trim(),
  newBrand: z.string().trim().max(80),
  concentration: optionalEnum(CONCENTRATIONS),
  audience: optionalEnum(AUDIENCES),
  unboxingScene: optionalEnum(UNBOXING_SCENES),
  sourceRef: optionalText(500),
  featured: z.boolean(),
  position: z.coerce.number().int().min(0).max(100000),
});

function readProduct(formData: FormData) {
  return productFields.safeParse({
    name: formData.get('name') ?? '',
    brandId: formData.get('brandId') ?? '',
    newBrand: formData.get('newBrand') ?? '',
    concentration: formData.get('concentration') ?? '',
    audience: formData.get('audience') ?? '',
    unboxingScene: formData.get('unboxingScene') ?? '',
    sourceRef: formData.get('sourceRef') ?? '',
    featured: formData.get('featured') === 'on',
    position: formData.get('position') || 0,
  });
}

type Supabase = Awaited<ReturnType<typeof requirePermission>>['supabase'];

/** Marca existente o nueva (se crea con su slug). */
async function resolveBrand(
  supabase: Supabase,
  brandId: string,
  newBrand: string,
): Promise<{ id: string } | { error: string }> {
  if (newBrand) {
    const slug = slugify(newBrand);
    if (!slug) return { error: 'El nombre de la marca no es válido.' };
    const existing = await supabase
      .from('brands')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (existing.data) return { id: existing.data.id };
    const created = await supabase
      .from('brands')
      .insert({ slug, name: newBrand })
      .select('id')
      .single();
    if (created.error) return { error: describeDbError(created.error) };
    return { id: created.data.id };
  }
  if (!z.uuid().safeParse(brandId).success) {
    return { error: 'Elige una marca o escribe una nueva.' };
  }
  return { id: brandId };
}

export async function createProduct(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requirePermission('catalog.edit');
  const parsed = readProduct(formData);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? 'Revisa los datos.');
  }
  const input = parsed.data;
  const brand = await resolveBrand(supabase, input.brandId, input.newBrand);
  if ('error' in brand) return fail(brand.error);

  const base = slugify(input.name);
  if (!base) return fail('El nombre no permite crear una dirección web.');
  // Si el slug ya existe (otra marca con el mismo nombre), se añade un sufijo.
  const taken = await supabase
    .from('products')
    .select('slug')
    .like('slug', `${base}%`);
  const used = new Set((taken.data ?? []).map((row) => row.slug));
  let slug = base;
  for (let n = 2; used.has(slug); n += 1) slug = `${base}-${n}`;

  const { data, error } = await supabase
    .from('products')
    .insert({
      brand_id: brand.id,
      slug,
      name: input.name,
      concentration: input.concentration,
      audience: input.audience,
      unboxing_scene: input.unboxingScene,
      source_ref: input.sourceRef,
      featured: input.featured,
      position: input.position,
    })
    .select('id')
    .single();
  if (error) return fail(describeDbError(error));
  await supabase.rpc('record_audit_event', {
    action: 'catalog.product_created',
    entity: 'product',
    entity_id: data.id,
    after: { slug, name: input.name },
  });
  refreshStorefront();
  redirect(`/admin/catalogo/${data.id}`);
}

export async function updateProduct(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requirePermission('catalog.edit');
  const id = z.uuid().safeParse(formData.get('id'));
  const parsed = readProduct(formData);
  if (!id.success) return fail('Perfume no válido.');
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? 'Revisa los datos.');
  }
  const input = parsed.data;
  const brand = await resolveBrand(supabase, input.brandId, input.newBrand);
  if ('error' in brand) return fail(brand.error);
  const { error } = await supabase
    .from('products')
    .update({
      brand_id: brand.id,
      name: input.name,
      concentration: input.concentration,
      audience: input.audience,
      unboxing_scene: input.unboxingScene,
      source_ref: input.sourceRef,
      featured: input.featured,
      position: input.position,
    })
    .eq('id', id.data);
  if (error) return fail(describeDbError(error));
  refreshStorefront(id.data);
  return ok('Cambios guardados.');
}

const statusInput = z.object({
  id: z.uuid(),
  status: z.enum(PRODUCT_STATUSES),
});

export async function setProductStatus(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requirePermission('catalog.publish');
  const parsed = statusInput.safeParse({
    id: formData.get('id'),
    status: formData.get('status'),
  });
  if (!parsed.success) return fail('Estado no válido.');
  const { error } = await supabase
    .from('products')
    .update({ status: parsed.data.status })
    .eq('id', parsed.data.id);
  if (error) return fail(describeDbError(error));
  await supabase.rpc('record_audit_event', {
    action: `catalog.product_${parsed.data.status}`,
    entity: 'product',
    entity_id: parsed.data.id,
    after: { status: parsed.data.status },
  });
  refreshStorefront(parsed.data.id);
  return ok(
    parsed.data.status === 'published'
      ? 'Publicado: ya se ve en la tienda.'
      : parsed.data.status === 'archived'
        ? 'Archivado: ya no se ve en la tienda.'
        : 'Retirado de la tienda: vuelve a ser un borrador.',
  );
}

export async function deleteProduct(formData: FormData) {
  const { supabase } = await requirePermission('catalog.edit');
  const id = z.uuid().parse(formData.get('id'));
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) redirect(`/admin/catalogo/${id}?error=borrar`);
  await supabase.rpc('record_audit_event', {
    action: 'catalog.product_deleted',
    entity: 'product',
    entity_id: id,
  });
  refreshStorefront();
  redirect('/admin/catalogo');
}

const variantFields = z.object({
  productId: z.uuid(),
  sizeMl: z
    .string()
    .trim()
    .transform((v) => (v ? Number(v) : null))
    .pipe(z.number().int().positive().max(5000).nullable()),
  label: optionalText(60),
  sku: optionalText(60),
  ean: z
    .string()
    .trim()
    .regex(/^(\d{8}|\d{12,14})?$/, 'El EAN debe tener 8, 12, 13 o 14 dígitos.')
    .transform((v) => v || null),
  active: z.boolean(),
});

function readVariant(formData: FormData) {
  return variantFields.safeParse({
    productId: formData.get('productId'),
    sizeMl: formData.get('sizeMl') ?? '',
    label: formData.get('label') ?? '',
    sku: formData.get('sku') ?? '',
    ean: formData.get('ean') ?? '',
    // Sin el campo (alta) el formato nace activo; con él, manda la casilla.
    active: formData.has('activeField')
      ? formData.get('active') === 'on'
      : true,
  });
}

export async function addVariant(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requirePermission('catalog.edit');
  const parsed = readVariant(formData);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? 'Revisa el formato.');
  }
  const v = parsed.data;
  if (!v.sizeMl && !v.label) return fail('Indica los ml o una etiqueta.');
  const count = await supabase
    .from('product_variants')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', v.productId);
  const { error } = await supabase.from('product_variants').insert({
    product_id: v.productId,
    size_ml: v.sizeMl,
    label: v.label,
    sku: v.sku,
    ean: v.ean,
    active: v.active,
    position: count.count ?? 0,
  });
  if (error) return fail(describeDbError(error));
  refreshStorefront(v.productId);
  return ok('Formato añadido. Ahora fija su PVP.');
}

export async function updateVariant(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requirePermission('catalog.edit');
  const id = z.uuid().safeParse(formData.get('id'));
  const parsed = readVariant(formData);
  if (!id.success || !parsed.success) {
    return fail(
      (!parsed.success && parsed.error.issues[0]?.message) ||
        'Revisa el formato.',
    );
  }
  const v = parsed.data;
  const { error } = await supabase
    .from('product_variants')
    .update({
      size_ml: v.sizeMl,
      label: v.label,
      sku: v.sku,
      ean: v.ean,
      active: v.active,
    })
    .eq('id', id.data);
  if (error) return fail(describeDbError(error));
  refreshStorefront(v.productId);
  return ok('Formato guardado.');
}

export async function deleteVariant(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requirePermission('catalog.edit');
  const id = z.uuid().safeParse(formData.get('id'));
  const productId = z.uuid().safeParse(formData.get('productId'));
  if (!id.success || !productId.success) return fail('Formato no válido.');
  const { error } = await supabase
    .from('product_variants')
    .delete()
    .eq('id', id.data);
  if (error) return fail(describeDbError(error));
  refreshStorefront(productId.data);
  return ok('Formato eliminado.');
}

const ISSUE_LABELS = PRICE_ISSUE_LABELS;

const priceInput = z.object({
  id: z.uuid(),
  productId: z.uuid(),
  price: z.string(),
  compareAt: z.string(),
});

export async function setVariantPrice(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, role } = await requirePermission('pricing.edit_retail');
  const parsed = priceInput.safeParse({
    id: formData.get('id'),
    productId: formData.get('productId'),
    price: formData.get('price') ?? '',
    compareAt: formData.get('compareAt') ?? '',
  });
  if (!parsed.success) return fail('Datos de precio no válidos.');
  const price = parseEuros(parsed.data.price);
  const compareAt = parsed.data.compareAt.trim()
    ? parseEuros(parsed.data.compareAt)
    : null;
  if (price === null || price <= 0) return fail('Escribe un PVP como 49,90.');
  if (parsed.data.compareAt.trim() && compareAt === null) {
    return fail('El precio anterior no es un importe válido.');
  }

  const current = await supabase
    .from('product_variants')
    .select('retail_price_cents, compare_at_price_cents')
    .eq('id', parsed.data.id)
    .single();
  if (current.error) return fail(describeDbError(current.error));
  const history = await supabase.rpc('admin_variant_price_history', {
    p_variant_id: parsed.data.id,
  });
  if (history.error) return fail(describeDbError(history.error));
  const periods: PricePeriod[] = history.data
    .filter((row) => row.price_cents !== null)
    .map((row) => ({
      retailGrossCents: row.price_cents,
      from: new Date(row.valid_from),
      to: row.valid_to ? new Date(row.valid_to) : null,
    }));

  // Solo quien puede ver costes recibe avisos de margen: «por debajo del
  // coste» ya revela información del coste.
  let costNetCents: number | null = null;
  if (isAllowed({ role, aal: 'aal2' }, 'pricing.view_cost')) {
    const cost = await supabase.rpc('admin_variant_costs', {
      p_variant_ids: [parsed.data.id],
    });
    if (cost.error) return fail(describeDbError(cost.error));
    costNetCents = cost.data[0]?.cost_net_cents ?? null;
  }

  const review = reviewPriceChange({
    currentRetailGrossCents: current.data.retail_price_cents,
    proposedRetailGrossCents: price,
    proposedCompareAtGrossCents: compareAt,
    vatBp: VAT_GENERAL_BP,
    costNetCents,
    history: periods,
    at: new Date(),
    policy: PROVISIONAL_PRICING_POLICY,
  });
  if (hasBlockingIssues(review)) {
    return fail(
      review.issues
        .filter((issue) => issue.severity === 'error')
        .map((issue) => ISSUE_LABELS[issue.code])
        .join(' '),
    );
  }
  const confirmed = formData
    .getAll('confirm')
    .map(String) as PriceIssue['code'][];
  const missing = missingConfirmations(review, confirmed);
  if (missing.length > 0) {
    return {
      status: 'confirm',
      message: 'Revisa y confirma antes de guardar:',
      confirm: missing.map((code) => ({ code, label: ISSUE_LABELS[code] })),
    };
  }

  const { error } = await supabase
    .from('product_variants')
    .update({
      retail_price_cents: price,
      compare_at_price_cents: compareAt,
    })
    .eq('id', parsed.data.id);
  if (error) return fail(describeDbError(error));
  await supabase.rpc('record_audit_event', {
    action: 'pricing.retail_changed',
    entity: 'product_variant',
    entity_id: parsed.data.id,
    before: {
      retail_price_cents: current.data.retail_price_cents,
      compare_at_price_cents: current.data.compare_at_price_cents,
    },
    after: {
      retail_price_cents: price,
      compare_at_price_cents: compareAt,
      confirmed,
    },
  });
  refreshStorefront(parsed.data.productId);
  return ok('PVP guardado.');
}

const costInput = z.object({
  id: z.uuid(),
  productId: z.uuid(),
  cost: z.string().trim().min(1).max(20),
  note: optionalText(200),
});

/**
 * Coste de compra neto (sin IVA). Vive en internal y no afecta a la tienda:
 * solo se revalida la página del panel.
 */
export async function recordVariantCost(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requirePermission('pricing.edit_cost');
  const parsed = costInput.safeParse({
    id: formData.get('id'),
    productId: formData.get('productId'),
    cost: formData.get('cost') ?? '',
    note: formData.get('note') ?? '',
  });
  if (!parsed.success) return fail('Escribe un coste como 18,40.');
  const cost = parseEuros(parsed.data.cost);
  if (cost === null) return fail('Escribe un coste como 18,40.');
  const { error } = await supabase.rpc('admin_record_variant_cost', {
    p_variant_id: parsed.data.id,
    p_cost_net_cents: cost,
    p_note: parsed.data.note ?? undefined,
  });
  if (error) return fail(describeDbError(error));
  revalidatePath(`/admin/catalogo/${parsed.data.productId}`);
  return ok('Coste registrado.');
}

const translationInput = z.object({
  productId: z.uuid(),
  locale: z.enum(LOCALES),
  tagline: optionalText(200),
  description: optionalText(4000),
});

export async function saveTranslation(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requirePermission('catalog.edit');
  const parsed = translationInput.safeParse({
    productId: formData.get('productId'),
    locale: formData.get('locale'),
    tagline: formData.get('tagline') ?? '',
    description: formData.get('description') ?? '',
  });
  if (!parsed.success) return fail('Texto no válido.');
  const t = parsed.data;
  const { error } = await supabase.from('product_translations').upsert({
    product_id: t.productId,
    locale: t.locale,
    tagline: t.tagline,
    description: t.description,
  });
  if (error) return fail(describeDbError(error));
  refreshStorefront(t.productId);
  return ok('Texto guardado.');
}

const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};
/** Por debajo del límite de 4,5 MB por petición de Vercel (next.config.ts). */
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

const mediaInput = z.object({
  productId: z.uuid(),
  origin: z.enum(MEDIA_ORIGINS),
  source: optionalText(500),
  alt: optionalText(200),
  role: z.enum(['hero', 'gallery', 'box']),
});

export async function uploadMedia(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requirePermission('media.edit');
  const parsed = mediaInput.safeParse({
    productId: formData.get('productId'),
    origin: formData.get('origin'),
    source: formData.get('source') ?? '',
    alt: formData.get('alt') ?? '',
    role: formData.get('role') ?? 'gallery',
  });
  const file = formData.get('file');
  if (!parsed.success) return fail('Datos de la imagen no válidos.');
  if (!(file instanceof File) || file.size === 0) {
    return fail('Elige una imagen.');
  }
  const extension = IMAGE_TYPES[file.type];
  if (!extension)
    return fail('Formato no admitido: usa JPG, PNG, WebP o AVIF.');
  if (file.size > MAX_IMAGE_BYTES)
    return fail('La imagen supera los 4 MB: redúcela antes de subirla.');
  const m = parsed.data;
  if (m.origin !== 'own_photo' && !m.source) {
    return fail('Indica la procedencia (URL o página del catálogo).');
  }

  const path = `${m.productId}/${crypto.randomUUID()}.${extension}`;
  const upload = await supabase.storage
    .from('product-media')
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upload.error) return fail(`No se pudo subir: ${upload.error.message}`);
  const { data: publicUrl } = supabase.storage
    .from('product-media')
    .getPublicUrl(path);

  const count = await supabase
    .from('product_media')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', m.productId);
  const { error } = await supabase.from('product_media').insert({
    product_id: m.productId,
    url: publicUrl.publicUrl,
    alt: m.alt,
    role: m.role,
    origin: m.origin,
    source: m.source,
    // Solo la foto propia deja de ser provisional.
    provisional: m.origin !== 'own_photo',
    position: count.count ?? 0,
  });
  if (error) {
    await supabase.storage.from('product-media').remove([path]);
    return fail(describeDbError(error));
  }
  refreshStorefront(m.productId);
  return ok('Imagen añadida.');
}

const mediaAction = z.object({
  id: z.uuid(),
  productId: z.uuid(),
  intent: z.enum(['hero', 'delete']),
});

export async function updateMedia(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requirePermission('media.edit');
  const parsed = mediaAction.safeParse({
    id: formData.get('id'),
    productId: formData.get('productId'),
    intent: formData.get('intent'),
  });
  if (!parsed.success) return fail('Acción no válida.');
  const { id, productId, intent } = parsed.data;
  if (intent === 'hero') {
    // Una sola imagen principal por perfume.
    const reset = await supabase
      .from('product_media')
      .update({ role: 'gallery' })
      .eq('product_id', productId)
      .eq('role', 'hero');
    if (reset.error) return fail(describeDbError(reset.error));
    const { error } = await supabase
      .from('product_media')
      .update({ role: 'hero' })
      .eq('id', id);
    if (error) return fail(describeDbError(error));
  } else {
    const row = await supabase
      .from('product_media')
      .select('url')
      .eq('id', id)
      .single();
    const { error } = await supabase
      .from('product_media')
      .delete()
      .eq('id', id);
    if (error) return fail(describeDbError(error));
    const marker = '/storage/v1/object/public/product-media/';
    const url = row.data?.url ?? '';
    if (url.includes(marker)) {
      await supabase.storage
        .from('product-media')
        .remove([url.split(marker)[1]!]);
    }
  }
  refreshStorefront(productId);
  return ok(
    intent === 'hero' ? 'Imagen principal cambiada.' : 'Imagen eliminada.',
  );
}
