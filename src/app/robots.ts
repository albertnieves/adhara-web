import type { MetadataRoute } from 'next';
import { indexingEnabled } from '@/modules/i18n/indexing';
import { siteUrl } from '@/modules/i18n/seo';

export const revalidate = 300;
export default function robots(): MetadataRoute.Robots {
  if (!indexingEnabled()) return { rules: { userAgent: '*', disallow: '/' } };
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api/', '/auth/'],
    },
    sitemap: new URL('/sitemap.xml', siteUrl()).href,
  };
}
