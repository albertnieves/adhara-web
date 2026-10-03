import { Badge } from '@/components/ui';
import type { BadgeTone } from '@/components/ui';

/** Estado de publicación de un perfume con el `Badge` del sistema (DS-09). */
const STATUSES: Record<string, { label: string; tone: BadgeTone }> = {
  draft: { label: 'Borrador', tone: 'neutral' },
  published: { label: 'Publicado', tone: 'success' },
  archived: { label: 'Archivado', tone: 'neutral' },
};

export function StatusBadge({ status }: { status: string }) {
  const { label, tone } = STATUSES[status] ?? STATUSES.draft!;
  return <Badge tone={tone}>{label}</Badge>;
}
