/**
 * Propuestas de reposición del vigilante agrupadas por proveedor preferente.
 * El vigilante solo propone; una persona con permiso de compras revisa las
 * cantidades y crea los borradores de pedido (el mismo caso de uso que un
 * pedido manual, con su auditoría).
 */

export type SupplierRef = { id: string; name: string };

export type ReorderCandidate = {
  variantId: string;
  quantity: number;
  /** Proveedor preferente (o único) del formato; null si no tiene. */
  supplier: SupplierRef | null;
  packSize: number | null;
};

export type SupplierProposal = {
  supplier: SupplierRef;
  lines: { variantId: string; quantity: number; packSize: number | null }[];
  units: number;
};

export type GroupedProposals = {
  bySupplier: SupplierProposal[];
  /** Formatos que necesitan un proveedor antes de poder pedirse. */
  withoutSupplier: string[];
};

export function groupProposalsBySupplier(
  candidates: readonly ReorderCandidate[],
): GroupedProposals {
  const groups = new Map<string, SupplierProposal>();
  const withoutSupplier: string[] = [];
  for (const candidate of candidates) {
    if (!Number.isSafeInteger(candidate.quantity) || candidate.quantity <= 0) {
      continue;
    }
    if (!candidate.supplier) {
      withoutSupplier.push(candidate.variantId);
      continue;
    }
    const group = groups.get(candidate.supplier.id) ?? {
      supplier: candidate.supplier,
      lines: [],
      units: 0,
    };
    group.lines.push({
      variantId: candidate.variantId,
      quantity: candidate.quantity,
      packSize: candidate.packSize,
    });
    group.units += candidate.quantity;
    groups.set(candidate.supplier.id, group);
  }
  return {
    bySupplier: [...groups.values()].sort((a, b) =>
      a.supplier.name.localeCompare(b.supplier.name, 'es'),
    ),
    withoutSupplier,
  };
}

/** Redondea hacia arriba al múltiplo de compra (la persona puede cambiarlo). */
export function roundToPack(quantity: number, packSize: number | null): number {
  if (!packSize || packSize <= 1) return quantity;
  return Math.ceil(quantity / packSize) * packSize;
}
