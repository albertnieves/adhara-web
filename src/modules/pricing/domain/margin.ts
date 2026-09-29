import type { BasisPoints, Cents } from '@/lib/money';
import { grossToNet, ratioBp } from '@/lib/money';

/** Sin coste registrado el margen es desconocido, nunca 0. */
export type Margin =
  | { kind: 'unknown'; netRevenueCents: Cents }
  | {
      kind: 'known';
      netRevenueCents: Cents;
      costNetCents: Cents;
      marginCents: Cents;
      marginBp: BasisPoints | null;
    };

export function computeMargin(input: {
  retailGrossCents: Cents;
  vatBp: BasisPoints;
  costNetCents: Cents | null;
}): Margin {
  const netRevenueCents = grossToNet(input.retailGrossCents, input.vatBp);
  if (input.costNetCents === null) return { kind: 'unknown', netRevenueCents };
  const marginCents = netRevenueCents - input.costNetCents;
  return {
    kind: 'known',
    netRevenueCents,
    costNetCents: input.costNetCents,
    marginCents,
    marginBp:
      netRevenueCents > 0 ? ratioBp(marginCents, netRevenueCents) : null,
  };
}
