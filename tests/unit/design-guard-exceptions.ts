/*
 * Excepciones de tests/unit/design-guard.test.ts. Cada número es el total
 * exacto de usos que quedan en ese archivo: la prueba falla si sube y también
 * si baja sin actualizar la lista, así que solo puede ir a menos.
 *
 * - temporal: se elimina en la tarea indicada del plan de la Fase 2.
 * - permanente: lleva su motivo.
 */

export const PERMANENT_COLOR_EXCEPTIONS: Readonly<
  Record<string, { count: number; reason: string }>
> = {
  'src/modules/storefront/ui/ProductStage.tsx': {
    count: 1,
    reason:
      'Fondo de la escena 3D: three.js no lee variables CSS (refleja --color-stage).',
  },
};

/** Tamaños de letra arbitrarios (text-[…]): a cero en DS-04. */
export const ARBITRARY_TEXT_SIZE: Readonly<Record<string, number>> = {
  'src/app/[locale]/page.tsx': 1,
  'src/app/[locale]/perfume/[slug]/page.tsx': 1,
  'src/app/admin/(panel)/inventario/page.tsx': 1,
  'src/app/admin/(panel)/layout.tsx': 1,
  'src/app/admin/(panel)/page.tsx': 1,
  'src/modules/admin/ui/Field.tsx': 1,
  'src/modules/admin/ui/StatusBadge.tsx': 1,
  'src/modules/assistant/ui/DailyReportView.tsx': 2,
  'src/modules/auth/ui/totp-enrollment.tsx': 1,
  'src/modules/brand/Logo.tsx': 2,
  'src/modules/catalog/ui/CatalogImport.tsx': 1,
  'src/modules/catalog/ui/MediaManager.tsx': 1,
  'src/modules/inventory/ui/Counter.tsx': 1,
  'src/modules/inventory/ui/ProductStock.tsx': 1,
  'src/modules/storefront/ui/CatalogBrowser.tsx': 1,
  'src/modules/storefront/ui/Footer.tsx': 1,
  'src/modules/storefront/ui/Header.tsx': 3,
  'src/modules/storefront/ui/Hero.tsx': 1,
  'src/modules/storefront/ui/ProductStage.tsx': 1,
  'src/modules/storefront/ui/PurchasePanel.tsx': 1,
};

/** Espaciados de letra arbitrarios (tracking-[…]): a cero en DS-04. */
export const ARBITRARY_TRACKING: Readonly<Record<string, number>> = {
  'src/app/[locale]/not-found.tsx': 1,
  'src/app/[locale]/page.tsx': 1,
  'src/app/[locale]/perfume/[slug]/page.tsx': 1,
  'src/app/admin/(panel)/asistente/page.tsx': 1,
  'src/app/admin/(panel)/catalogo/[id]/page.tsx': 2,
  'src/app/admin/(panel)/catalogo/etiquetas/page.tsx': 2,
  'src/app/admin/(panel)/catalogo/importar/page.tsx': 1,
  'src/app/admin/(panel)/catalogo/nuevo/page.tsx': 1,
  'src/app/admin/(panel)/catalogo/page.tsx': 1,
  'src/app/admin/(panel)/catalogo/precios/page.tsx': 1,
  'src/app/admin/(panel)/compras/[id]/page.tsx': 2,
  'src/app/admin/(panel)/compras/page.tsx': 3,
  'src/app/admin/(panel)/compras/proveedores/[id]/page.tsx': 1,
  'src/app/admin/(panel)/compras/proveedores/page.tsx': 1,
  'src/app/admin/(panel)/informes/auditoria/page.tsx': 3,
  'src/app/admin/(panel)/informes/compras/page.tsx': 1,
  'src/app/admin/(panel)/informes/inventario/page.tsx': 3,
  'src/app/admin/(panel)/informes/rotacion/page.tsx': 1,
  'src/app/admin/(panel)/inventario/page.tsx': 2,
  'src/app/admin/(panel)/layout.tsx': 3,
  'src/app/admin/(panel)/mostrador/page.tsx': 1,
  'src/app/admin/(panel)/movimientos/page.tsx': 2,
  'src/app/admin/(panel)/page.tsx': 5,
  'src/app/admin/(panel)/reposicion/page.tsx': 1,
  'src/app/admin/mfa/page.tsx': 1,
  'src/modules/admin/ui/AuthScreen.tsx': 1,
  'src/modules/admin/ui/Field.tsx': 1,
  'src/modules/admin/ui/PanelNav.tsx': 1,
  'src/modules/admin/ui/PrintButton.tsx': 1,
  'src/modules/admin/ui/StatusBadge.tsx': 1,
  'src/modules/admin/ui/SubmitButton.tsx': 1,
  'src/modules/assistant/ui/AssistantChat.tsx': 1,
  'src/modules/assistant/ui/DailyReportView.tsx': 3,
  'src/modules/auth/ui/totp-enrollment.tsx': 2,
  'src/modules/catalog/ui/BulkPricing.tsx': 1,
  'src/modules/catalog/ui/CatalogImport.tsx': 2,
  'src/modules/catalog/ui/PriceLabelCard.tsx': 2,
  'src/modules/catalog/ui/TranslationEditor.tsx': 1,
  'src/modules/catalog/ui/VariantEditor.tsx': 1,
  'src/modules/inventory/ui/Counter.tsx': 5,
  'src/modules/inventory/ui/ProductStock.tsx': 2,
  'src/modules/purchasing/ui/OrderLinesEditor.tsx': 2,
  'src/modules/purchasing/ui/SupplierTerms.tsx': 1,
  'src/modules/storefront/ui/CatalogBrowser.tsx': 3,
  'src/modules/storefront/ui/Footer.tsx': 1,
  'src/modules/storefront/ui/Header.tsx': 4,
  'src/modules/storefront/ui/Hero.tsx': 1,
  'src/modules/storefront/ui/PreviewBanner.tsx': 2,
  'src/modules/storefront/ui/ProductImage.tsx': 1,
  'src/modules/storefront/ui/ProductStage.tsx': 1,
  'src/modules/storefront/ui/PurchasePanel.tsx': 3,
};
