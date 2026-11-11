import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { contentSecurityPolicy } from './src/lib/csp';
import { indexingHeaders } from './src/modules/i18n/indexing';
const withNextIntl = createNextIntlPlugin('./src/modules/i18n/request.ts');
const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Subida de imágenes desde el panel. Vercel limita el cuerpo de la
    // petición a 4,5 MB, así que el límite se queda por debajo.
    serverActions: { bodySizeLimit: '4mb' },
  },
  images: {
    // Imágenes subidas desde el panel al bucket público product-media.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/product-media/**',
      },
    ],
  },
  // Envíos en una sola sección del panel (DECISIONS §177): las direcciones
  // anteriores siguen llevando a su página.
  async redirects() {
    return [
      {
        source: '/admin/configuracion/envios',
        destination: '/admin/envios/transportistas',
        permanent: false,
      },
      {
        source: '/admin/configuracion/envios/:id',
        destination: '/admin/envios/transportistas/:id',
        permanent: false,
      },
      {
        source: '/admin/catalogo/pesos',
        destination: '/admin/envios/pesos',
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value:
              'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), hid=(), bluetooth=(), display-capture=()',
          },
          // Una web abierta desde otra no puede tocar esta ventana (window.opener).
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
          { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
          // HSTS explícito (Vercel ya lo pone en su dominio) y una CSP que no
          // obliga a renderizar cada página: scripts solo de la tienda y de
          // las etiquetas de medición, sin eval, formularios solo a la tienda
          // y al banco, sin marcos, sin plugins y sin <base> ajena
          // (DECISIONS §162 y §187).
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains',
          },
          {
            key: 'Content-Security-Policy',
            value: contentSecurityPolicy({
              dev: process.env.NODE_ENV === 'development',
              supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
            }),
          },
        ],
      },
      ...indexingHeaders(),
      // El token de los enlaces de Auth va en la dirección (DECISIONS §187).
      {
        source: '/auth/confirm',
        headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }],
      },
      {
        source: '/admin/:path*',
        headers: [{ key: 'Cache-Control', value: 'private, no-store' }],
      },
      {
        source: '/admin',
        headers: [{ key: 'Cache-Control', value: 'private, no-store' }],
      },
    ];
  },
};
export default withNextIntl(config);
