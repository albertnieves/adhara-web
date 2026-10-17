import 'server-only';
import { createSupabasePublicClient } from '@/lib/supabase/public';
import { fetchAll } from '@/lib/supabase/paginate';

/** Sin sesión ni Draft Mode: un sitemap nunca incluye borradores del personal. */
export async function listSitemapProducts() {
  const supabase = createSupabasePublicClient();
  if (!supabase) return [];
  return fetchAll((from, to) =>
    supabase
      .from('products')
      .select(
        'slug, brand:brands!inner(slug), translations:product_translations(locale, tagline, description)',
      )
      .eq('status', 'published')
      .order('id')
      .range(from, to),
  );
}
