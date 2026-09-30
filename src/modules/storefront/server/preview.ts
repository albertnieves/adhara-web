'use server';

import { draftMode } from 'next/headers';
import { redirect } from 'next/navigation';
import { requirePermission } from '@/modules/auth/server';
import { storefrontPath } from '../domain/preview-path';

/*
 * Vista previa de la tienda para el personal (Draft Mode). Entrar exige
 * catalog.edit con MFA; aun así, lo que se ve lo decide RLS con la sesión
 * (modules/catalog/server/storefront.ts). Salir no exige nada.
 */

export async function enterStorefrontPreview(formData: FormData) {
  await requirePermission('catalog.edit');
  (await draftMode()).enable();
  redirect(storefrontPath(formData.get('path')));
}

export async function exitStorefrontPreview(formData: FormData) {
  (await draftMode()).disable();
  redirect(storefrontPath(formData.get('path')));
}
