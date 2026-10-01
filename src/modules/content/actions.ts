'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requirePermission } from '@/modules/auth/server';
import type { ActionState } from '@/modules/admin';
import { fail, ok, describeDbError } from '@/modules/admin';
import {
  contentKind,
  contentLocale,
  homeContent,
  storeContent,
} from './domain';

export async function editContent(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const input = z
    .object({
      kind: contentKind,
      locale: contentLocale,
      expected: z.coerce.number().int().min(0),
      intent: z.enum(['save', 'publish', 'restore']),
    })
    .safeParse(Object.fromEntries(form));
  if (!input.success) return fail('Revisa los datos.');
  const { kind, locale, expected, intent } = input.data;
  const { supabase } = await requirePermission(
    kind === 'store' ? 'settings.manage' : 'content.edit',
  );
  let error;
  if (intent === 'publish') {
    ({ error } = await supabase.rpc('admin_publish_content', {
      p_kind: kind,
      p_locale: locale,
      p_expected: expected,
    }));
  } else if (intent === 'restore') {
    const id = z.coerce
      .number()
      .int()
      .positive()
      .safeParse(form.get('revisionId'));
    if (!id.success) return fail('Elige una revisión.');
    ({ error } = await supabase.rpc('admin_restore_content', {
      p_kind: kind,
      p_locale: locale,
      p_expected: expected,
      p_revision_id: id.data,
    }));
  } else {
    const schema = kind === 'home' ? homeContent : storeContent;
    const raw: Record<string, string> = {};
    for (const key of Object.keys(schema.shape))
      raw[key] = String(form.get(key) ?? '');
    if (form.get('removeImage') === 'on') raw.imagePath = '';
    if (!schema.safeParse(raw).success)
      return fail(
        'Revisa los campos: título y localidad obligatorios, email y enlaces https válidos.',
      );
    const file = form.get('image');
    if (kind === 'home' && file instanceof File && file.size > 0) {
      const types: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/avif': 'avif',
      };
      const extension = types[file.type];
      if (!extension || file.size > 3 * 1024 * 1024)
        return fail('Usa una imagen JPG, PNG, WebP o AVIF de hasta 3 MB.');
      if (!raw.imageAlt?.trim() || !raw.imageSource?.trim())
        return fail('Indica descripción y procedencia de la imagen.');
      const path = `${crypto.randomUUID()}.${extension}`;
      const upload = await supabase.storage
        .from('editorial')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upload.error) return fail('No se pudo subir la imagen.');
      raw.imagePath = path;
    }
    if (form.get('removeImage') === 'on') raw.imagePath = '';
    const parsed = schema.safeParse(raw);
    if (!parsed.success)
      return fail(parsed.error.issues[0]?.message ?? 'Revisa los textos.');
    ({ error } = await supabase.rpc('admin_save_content', {
      p_kind: kind,
      p_locale: locale,
      p_expected: expected,
      p_payload: parsed.data,
    }));
  }
  if (error) return fail(describeDbError(error));
  revalidatePath(
    kind === 'store' ? '/admin/configuracion' : '/admin/contenido',
  );
  if (intent === 'publish') revalidatePath('/', 'layout');
  return ok(
    intent === 'publish'
      ? 'Contenido publicado.'
      : 'Borrador guardado. Revisa la vista previa antes de publicar.',
  );
}
