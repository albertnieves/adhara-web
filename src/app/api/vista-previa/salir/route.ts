import { draftMode } from 'next/headers';
import { NextResponse } from 'next/server';
import { storefrontPath } from '@/modules/storefront/domain/preview-path';

/**
 * Salir de la vista previa con una navegación completa (303): una Server
 * Action redirigiría renderizando con la cookie de la petición y seguiría
 * mostrando borradores hasta la siguiente navegación.
 */
export async function POST(request: Request) {
  (await draftMode()).disable();
  const form = await request.formData().catch(() => null);
  const path = storefrontPath(form?.get('path'));
  return NextResponse.redirect(new URL(path, request.url), 303);
}
