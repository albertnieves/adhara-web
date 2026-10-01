import 'server-only';
import { draftMode } from 'next/headers';
import { cache } from 'react';
import { z } from 'zod';
import { createSupabasePublicClient } from '@/lib/supabase/public';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requirePermission } from '@/modules/auth/server';
import { homeContent, storeContent } from './domain';
import type { ContentKind } from './domain';

export const documentSchema = z.object({
  revision: z.number(),
  published_revision: z.number().nullable(),
  payload: z.record(z.string(), z.string()),
  updated_at: z.string(),
  updated_by: z.string().nullable(),
  history: z.array(
    z.object({
      id: z.number(),
      revision: z.number(),
      action: z.string(),
      at: z.string(),
      actor_id: z.string().nullable(),
    }),
  ),
});
export type ContentDocument = z.infer<typeof documentSchema>;
export async function getAdminContent(kind: ContentKind, locale: string) {
  const { supabase } = await requirePermission(
    kind === 'store' ? 'settings.manage' : 'content.edit',
  );
  const { data, error } = await supabase.rpc('admin_get_content', {
    p_kind: kind,
    p_locale: locale,
  });
  if (error) throw new Error('No se pudo cargar el contenido.');
  return documentSchema.parse(data);
}
export const readStoreContent = cache(
  async (kind: ContentKind, locale: string) => {
    const publicClient = createSupabasePublicClient();
    if (!publicClient) return null;
    let payload: unknown;
    let source = publicClient;
    if ((await draftMode()).isEnabled) {
      const staff = await createSupabaseServerClient();
      if (staff) {
        const { data: user } = await staff.auth.getUser();
        if (user.user) {
          const { data, error } = await staff.rpc('admin_get_content', {
            p_kind: kind,
            p_locale: locale,
          });
          const doc = documentSchema.safeParse(data);
          if (!error && doc.success) {
            payload = doc.data.payload;
            source = staff;
          }
        }
      }
    }
    if (!payload) {
      const { data, error } = await publicClient
        .from('store_content')
        .select('payload')
        .eq('kind', kind)
        .eq('locale', locale)
        .single();
      if (error) throw new Error('No se pudo leer el contenido de la tienda.');
      payload = data.payload;
    }
    const parsed = (kind === 'home' ? homeContent : storeContent).parse(
      payload,
    );
    let imageUrl: string | null = null;
    if ('imagePath' in parsed && parsed.imagePath) {
      const { data, error } = await source.storage
        .from('editorial')
        .createSignedUrl(parsed.imagePath, 600);
      if (error) throw new Error('No se pudo leer la imagen editorial.');
      imageUrl = data.signedUrl;
    }
    return { payload: parsed, imageUrl };
  },
);
