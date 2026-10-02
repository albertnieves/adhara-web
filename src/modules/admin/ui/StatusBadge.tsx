const STYLES: Record<string, { label: string; className: string }> = {
  draft: { label: 'Borrador', className: 'border-mist text-smoke' },
  published: { label: 'Publicado', className: 'border-success text-success' },
  archived: { label: 'Archivado', className: 'border-line text-fg-muted' },
};

export function StatusBadge({ status }: { status: string }) {
  const style = STYLES[status] ?? STYLES.draft!;
  return (
    <span
      className={`inline-flex items-center border px-2 py-0.5 text-[0.625rem] font-semibold tracking-[0.16em] uppercase ${style.className}`}
    >
      {style.label}
    </span>
  );
}
